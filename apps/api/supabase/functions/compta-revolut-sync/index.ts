// Paperasse Lot 2.1 - Edge Function compta-revolut-sync
//
// Rôle : récupère les transactions Revolut depuis la dernière sync, crée des
// source_events idempotents, applique les classification_rules déterministes,
// crée des accounting_proposals.
//
// verify_jwt = true (user authentifié tenant_owner)
//
// Requête : POST {}
//   (future extension : POST { from: "2026-01-01", to: "2026-04-20" })
//
// Réponse :
//   200 { ok: true, data: { new_events: N, new_proposals: N, skipped_duplicates: N } }
//   401/403/500 idem patterns précédents

import { createClient } from "npm:@supabase/supabase-js@2";
import { refreshAccessToken, revolutGet } from "../_shared/revolut.ts";
import { decryptToken, encryptToken } from "../_shared/crypto.ts";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

type RevolutTx = {
  id: string;
  type: string;
  state: string;
  request_id?: string;
  reason_code?: string;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
  reference?: string;
  legs?: Array<{
    leg_id: string;
    account_id: string;
    counterparty?: {
      id?: string;
      account_type?: string;
      account_id?: string;
    };
    amount: number;
    fee?: number;
    currency: string;
    description?: string;
    balance?: number;
  }>;
  merchant?: { name?: string; city?: string; category_code?: string };
};

type ClassificationRule = {
  id: string;
  rule_code: string;
  rule_version: string;
  trigger: {
    source: string;
    event_type: string;
    match: {
      revolut_type?: string[];
      direction?: "debit" | "credit";
    };
  };
  output: {
    kind: string;
    pcg_debit: string;
    pcg_credit: string;
    journal_code: string;
    proposal_status: "review_required" | "ready_to_post";
    confidence_level: "low" | "medium" | "high";
    confidence_score: number;
  };
  priority: number;
};

// Trouve la règle matching pour une transaction Revolut (la + prioritaire)
function pickRule(tx: RevolutTx, rules: ClassificationRule[]): ClassificationRule | null {
  // Déterminer le signe/direction depuis legs[0].amount (négatif = débit banque)
  let direction: "debit" | "credit" = "credit";
  if (tx.legs && tx.legs.length > 0) {
    direction = tx.legs[0].amount < 0 ? "debit" : "credit";
  }
  const candidates = rules
    .filter((r) => {
      const types = r.trigger.match.revolut_type;
      if (types && !types.includes(tx.type)) return false;
      if (r.trigger.match.direction && r.trigger.match.direction !== direction) return false;
      return true;
    })
    .sort((a, b) => a.priority - b.priority);
  return candidates[0] ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const clientId = Deno.env.get("REVOLUT_CLIENT_ID");
  const privateKeyPem = Deno.env.get("REVOLUT_PRIVATE_KEY");

  if (!clientId || !privateKeyPem) {
    return json({ error: "revolut_not_configured" }, 500);
  }

  const userClient = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return json({ error: "unauthorized" }, 401);
  }
  const userId = userData.user.id;

  // Tenant du user
  const { data: memberships } = await userClient
    .from("compta_memberships_v")
    .select("tenant_id")
    .eq("role", "tenant_owner")
    .is("revoked_at", null)
    .limit(1);
  if (!memberships || memberships.length === 0) {
    return json({ error: "no_tenant" }, 403);
  }
  const tenantId = memberships[0].tenant_id as string;

  // Service role pour bypass RLS
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Récupérer l'intégration connected
  const { data: integration, error: intErr } = await admin
    .schema("compta")
    .from("bank_integrations")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("provider", "revolut_business")
    .eq("status", "connected")
    .maybeSingle();

  if (intErr || !integration) {
    return json({
      error: "no_integration",
      message: "Aucune intégration Revolut connectée pour ce tenant",
    }, 404);
  }

  // legal_entity
  const { data: le } = await admin
    .schema("compta")
    .from("legal_entities")
    .select("id")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!le) {
    return json({ error: "no_legal_entity" }, 500);
  }

  // Déchiffrer les tokens
  let accessToken: string;
  let refreshToken: string;
  try {
    accessToken = await decryptToken(integration.access_token_enc);
    refreshToken = await decryptToken(integration.refresh_token_enc);
  } catch (err) {
    console.error("Token decrypt failed:", err);
    return json({ error: "token_decrypt_failed" }, 500);
  }

  // Refresher le token s'il est expiré ou proche de l'expiration (< 5 min)
  const expiresAt = integration.token_expires_at ? new Date(integration.token_expires_at) : null;
  if (!expiresAt || expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    try {
      const refreshed = await refreshAccessToken({
        clientId,
        privateKeyPem,
        refreshToken,
      });
      accessToken = refreshed.access_token;
      const newEnc = await encryptToken(accessToken);
      const newExp = new Date(Date.now() + (refreshed.expires_in ?? 2400) * 1000).toISOString();
      await admin
        .schema("compta")
        .from("bank_integrations")
        .update({
          access_token_enc: newEnc,
          token_expires_at: newExp,
          updated_at: new Date().toISOString(),
        })
        .eq("id", integration.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Refresh token failed:", msg);
      // Marquer l'intégration en erreur et dire à l'utilisateur de reconnecter
      await admin
        .schema("compta")
        .from("bank_integrations")
        .update({
          status: "expired",
          last_sync_error: `Refresh failed: ${msg}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", integration.id);
      return json({ error: "token_refresh_failed", message: msg }, 401);
    }
  }

  // Charger les classification_rules Revolut
  const { data: rules, error: rulesErr } = await admin
    .schema("compta")
    .from("classification_rules")
    .select("id, rule_code, rule_version, trigger, output, priority")
    .eq("status", "active")
    .is("tenant_id", null)
    .like("rule_code", "revolut_business_%");

  if (rulesErr || !rules) {
    console.error("Rules load error:", rulesErr);
    return json({ error: "rules_load_failed" }, 500);
  }

  // Fenêtre de sync : depuis le dernier sync, sinon 90 jours
  const fromDate =
    integration.last_sync_at ||
    new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch transactions (pagination Revolut par cursor `from`)
  let allTxs: RevolutTx[] = [];
  try {
    // API Revolut : GET /transactions?from=<ISO>&count=1000
    // On ne pagine pas en profondeur dans ce lot (limite 1000, suffisant pour 3 mois typiques).
    // Pagination cursor-based + limit à enrichir dans un lot ultérieur si besoin.
    const txs = await revolutGet<RevolutTx[]>(accessToken, "/transactions", {
      from: fromDate,
      count: "1000",
    });
    if (Array.isArray(txs)) allTxs = txs;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin
      .schema("compta")
      .from("bank_integrations")
      .update({
        last_sync_error: msg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id);
    return json({ error: "fetch_tx_failed", message: msg }, 502);
  }

  // Compteurs pour le rapport final
  let newEvents = 0;
  let skippedDuplicates = 0;
  let newProposals = 0;
  let autoReadyToPost = 0;
  let reviewRequired = 0;
  const ruleMap = rules as ClassificationRule[];

  // Traiter chaque tx : upsert source_event + créer accounting_proposal si nouveau
  for (const tx of allTxs) {
    // Ne traiter que les transactions completed (évite les pending qui peuvent disparaître)
    if (tx.state !== "completed") continue;

    // 1) Upsert source_event (idempotence via unique (tenant_id, external_source, external_id))
    const occurredAt = tx.completed_at || tx.created_at;

    const { data: seInserted, error: seErr } = await admin
      .schema("compta")
      .from("source_events")
      .insert({
        tenant_id: tenantId,
        legal_entity_id: le.id,
        event_type: "revolut_business_tx",
        external_id: tx.id,
        external_source: "revolut_business",
        occurred_at: occurredAt,
        raw_payload: tx,
        processing_status: "pending",
      })
      .select("id")
      .single();

    if (seErr) {
      // 23505 = unique violation → déjà importé, skip
      if (seErr.code === "23505") {
        skippedDuplicates += 1;
        continue;
      }
      console.error("source_event insert error:", seErr);
      continue;
    }
    if (!seInserted) continue;

    newEvents += 1;

    // 2) Matcher une règle de classification
    const rule = pickRule(tx, ruleMap);
    if (!rule) {
      // Pas de règle → source_event reste en pending, sera traité au Lot 2.2
      await admin.schema("compta").from("source_events")
        .update({ processing_status: "pending" })
        .eq("id", seInserted.id);
      continue;
    }

    // 3) Construire proposed_lines (débit/crédit)
    const firstLeg = tx.legs?.[0];
    const amount = firstLeg ? Math.abs(firstLeg.amount) : 0;
    const currency = firstLeg?.currency ?? "EUR";
    const description = firstLeg?.description ?? tx.reference ?? rule.rule_code;

    const proposedLines = [
      {
        account_code: rule.output.pcg_debit,
        direction: "debit",
        amount,
        currency,
        label: description,
      },
      {
        account_code: rule.output.pcg_credit,
        direction: "credit",
        amount,
        currency,
        label: description,
      },
    ];

    // 4) Trouver l'accounting_period correspondante
    const { data: period } = await admin
      .schema("compta")
      .from("accounting_periods")
      .select("id, fiscal_year_id, status")
      .eq("tenant_id", tenantId)
      .lte("start_date", occurredAt.slice(0, 10))
      .gte("end_date", occurredAt.slice(0, 10))
      .limit(1)
      .maybeSingle();

    // 5) Trouver le journal BQ
    const { data: journal } = await admin
      .schema("compta")
      .from("journals")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("code", rule.output.journal_code)
      .maybeSingle();

    // 6) Créer l'accounting_proposal
    const ruleApplication = {
      rule_id: rule.id,
      rule_code: rule.rule_code,
      rule_version: rule.rule_version,
      context_snapshot: {
        revolut_type: tx.type,
        direction: firstLeg ? (firstLeg.amount < 0 ? "debit" : "credit") : null,
        amount,
        currency,
        occurred_at: occurredAt,
      },
      result: rule.output,
      applied_at: new Date().toISOString(),
    };

    const { error: propErr } = await admin
      .schema("compta")
      .from("accounting_proposals")
      .insert({
        tenant_id: tenantId,
        legal_entity_id: le.id,
        fiscal_year_id: period?.fiscal_year_id ?? null,
        accounting_period_id: period?.id ?? null,
        journal_id: journal?.id ?? null,
        source_event_id: seInserted.id,
        status: rule.output.proposal_status,
        proposed_lines: proposedLines,
        confidence_score: rule.output.confidence_score,
        confidence_level: rule.output.confidence_level,
        rule_applications: [ruleApplication],
      });

    if (propErr) {
      console.error("proposal insert error:", propErr);
      // On ne propage pas l'erreur, le source_event reste pending
      continue;
    }

    newProposals += 1;
    if (rule.output.proposal_status === "ready_to_post") {
      autoReadyToPost += 1;
    } else {
      reviewRequired += 1;
    }

    // 7) Marquer le source_event comme classified
    await admin
      .schema("compta")
      .from("source_events")
      .update({ processing_status: "classified" })
      .eq("id", seInserted.id);
  }

  // Mettre à jour l'intégration : last_sync_at
  const syncCompletedAt = new Date().toISOString();
  await admin
    .schema("compta")
    .from("bank_integrations")
    .update({
      last_sync_at: syncCompletedAt,
      last_sync_error: null,
      last_sync_tx_count: newEvents,
      updated_at: syncCompletedAt,
    })
    .eq("id", integration.id);

  // Audit log
  await admin.schema("compta").from("audit_logs").insert({
    tenant_id: tenantId,
    legal_entity_id: le.id,
    entity_type: "bank_integration",
    entity_id: integration.id,
    event_type: "sync",
    old_value: { last_sync_at: integration.last_sync_at },
    new_value: {
      last_sync_at: syncCompletedAt,
      new_events: newEvents,
      new_proposals: newProposals,
      skipped_duplicates: skippedDuplicates,
    },
    actor_id: userId,
    actor_type: "user",
    priority: "normal",
  });

  return json({
    ok: true,
    data: {
      new_events: newEvents,
      new_proposals: newProposals,
      skipped_duplicates: skippedDuplicates,
      auto_ready_to_post: autoReadyToPost,
      review_required: reviewRequired,
      last_sync_at: syncCompletedAt,
    },
  });
});
