// Paperasse Lot 2.1 - Edge Function compta-revolut-oauth-callback
//
// Rôle : reçoit le callback de Revolut après autorisation utilisateur.
// Échange le code contre un couple access_token + refresh_token, chiffre
// ces tokens, et les stocke dans compta.bank_integrations.
//
// verify_jwt = FALSE (Revolut appelle cette URL sans JWT de l'user)
// La sécurité est assurée par :
//  - le state signé HMAC (vérifié au début, impossible à forger sans le secret)
//  - le code ne peut être échangé qu'une fois (Revolut), avec notre privKey
//  - on identifie le tenant/user via le state signé (contenu dans le payload)
//
// Requête : GET /compta-revolut-oauth-callback?code=XXX&state=YYY
// Revolut rappelle cette URL avec ces query params.
//
// Réponse : redirection HTML vers l'UI avec success/error

import { createClient } from "npm:@supabase/supabase-js@2";
import { exchangeCodeForTokens, verifyState, revolutGet } from "../_shared/revolut.ts";
import { encryptToken } from "../_shared/crypto.ts";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
};

function htmlRedirect(targetUrl: string): Response {
  // Page minimaliste qui redirige immédiatement, avec fallback si JS désactivé
  const safe = targetUrl.replace(/"/g, "&quot;");
  const body = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=${safe}">
<title>Redirection…</title>
</head><body>
<p>Redirection vers Paperasse…</p>
<script>window.location.replace("${safe}");</script>
</body></html>`;
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", ...CORS_HEADERS },
  });
}

function errorRedirect(frontBase: string, code: string, message?: string): Response {
  const params = new URLSearchParams({ revolut_status: "error", revolut_error: code });
  if (message) params.set("revolut_message", message);
  return htmlRedirect(`${frontBase}/#settings-integrations?${params.toString()}`);
}

function successRedirect(frontBase: string, integrationId: string, accountsCount: number): Response {
  const params = new URLSearchParams({
    revolut_status: "success",
    revolut_integration_id: integrationId,
    revolut_accounts_count: String(accountsCount),
  });
  return htmlRedirect(`${frontBase}/#settings-integrations?${params.toString()}`);
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const frontBase = Deno.env.get("PAPERASSE_FRONT_BASE_URL") ?? "https://samaxan-compta-maquette.netlify.app";

  // Gestion de l'erreur côté Revolut (l'utilisateur a cliqué "Refuser")
  const errorFromRevolut = url.searchParams.get("error");
  if (errorFromRevolut) {
    return errorRedirect(
      frontBase,
      "revolut_denied",
      url.searchParams.get("error_description") ?? errorFromRevolut,
    );
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return errorRedirect(frontBase, "missing_code_or_state");
  }

  // Vérifier le state signé
  const stateInfo = await verifyState(state);
  if (!stateInfo) {
    return errorRedirect(frontBase, "invalid_state");
  }

  const { tenantId, userId } = stateInfo;

  // Config Revolut
  const clientId = Deno.env.get("REVOLUT_CLIENT_ID");
  const privateKeyPem = Deno.env.get("REVOLUT_PRIVATE_KEY");
  if (!clientId || !privateKeyPem) {
    return errorRedirect(frontBase, "revolut_not_configured");
  }

  // Échanger le code
  let tokens;
  try {
    tokens = await exchangeCodeForTokens({
      clientId,
      privateKeyPem,
      code,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Token exchange failed:", msg);
    return errorRedirect(frontBase, "token_exchange_failed", msg);
  }

  // Récupérer les comptes (pour stocker le metadata)
  let accounts: unknown[] = [];
  try {
    accounts = await revolutGet<unknown[]>(tokens.access_token, "/accounts");
    if (!Array.isArray(accounts)) accounts = [];
  } catch (err) {
    console.error("Fetching accounts failed (non-fatal):", err);
    // Non bloquant : on stocke quand même la connexion
  }

  // Chiffrer les tokens
  const accessEnc = await encryptToken(tokens.access_token);
  const refreshEnc = await encryptToken(tokens.refresh_token);
  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 2400) * 1000).toISOString();

  // Stocker via service role (bypass RLS)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Recherche legal_entity du tenant (v1 : 1 par tenant)
  const { data: le } = await admin
    .schema("compta")
    .from("legal_entities")
    .select("id")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  // Retirer toute ancienne intégration "connected" (soft-revoke) avant d'insérer
  await admin
    .schema("compta")
    .from("bank_integrations")
    .update({
      status: "revoked",
      disconnected_at: new Date().toISOString(),
      disconnected_by: userId,
      access_token_enc: null,
      refresh_token_enc: null,
      token_expires_at: null,
    })
    .eq("tenant_id", tenantId)
    .eq("provider", "revolut_business")
    .eq("status", "connected");

  // Insérer la nouvelle
  const { data: integration, error: insErr } = await admin
    .schema("compta")
    .from("bank_integrations")
    .insert({
      tenant_id: tenantId,
      legal_entity_id: le?.id ?? null,
      provider: "revolut_business",
      status: "connected",
      access_token_enc: accessEnc,
      refresh_token_enc: refreshEnc,
      token_expires_at: expiresAt,
      accounts: accounts,
      scopes: ["READ"],
      connected_by: userId,
      connected_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insErr || !integration) {
    console.error("Insert integration failed:", insErr);
    return errorRedirect(frontBase, "db_insert_failed", insErr?.message);
  }

  // Audit
  await admin.schema("compta").from("audit_logs").insert({
    tenant_id: tenantId,
    legal_entity_id: le?.id ?? null,
    entity_type: "bank_integration",
    entity_id: integration.id,
    event_type: "connect",
    old_value: null,
    new_value: {
      provider: "revolut_business",
      accounts_count: accounts.length,
    },
    actor_id: userId,
    actor_type: "user",
    priority: "normal",
  });

  return successRedirect(frontBase, integration.id, accounts.length);
});
