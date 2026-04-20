// Paperasse Lot 2.1 - Edge Function compta-revolut-oauth-start
//
// Rôle : reçoit un appel authentifié de l'UI, vérifie que le user est
// tenant_owner, génère un state signé (CSRF), et retourne l'URL d'autorisation
// Revolut vers laquelle rediriger le navigateur.
//
// verify_jwt = true (auth requise)
//
// Requête :
//   POST {} (body vide)
//
// Réponse :
//   200 { ok: true, authorize_url: "https://business.revolut.com/..." }
//   401 { error: "unauthorized" }
//   500 { error: "server_misconfigured" }

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildAuthorizeUrl, signState } from "../_shared/revolut.ts";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "unauthorized", message: "Bearer token required" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY");
  const clientId = Deno.env.get("REVOLUT_CLIENT_ID");
  const redirectUri = Deno.env.get("REVOLUT_REDIRECT_URI");

  if (!supabaseUrl || !supabaseAnon) {
    return json({ error: "server_misconfigured", message: "Supabase env missing" }, 500);
  }
  if (!clientId || !redirectUri) {
    return json({
      error: "revolut_not_configured",
      message: "REVOLUT_CLIENT_ID and REVOLUT_REDIRECT_URI must be set in Supabase secrets",
    }, 500);
  }

  // Identifier le user via son JWT (client supabase user-scoped)
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return json({ error: "unauthorized", message: "Invalid session" }, 401);
  }
  const userId = userData.user.id;

  // Récupérer le tenant_id du user (role tenant_owner)
  const { data: memberships, error: memErr } = await supabase
    .from("compta_memberships_v")
    .select("tenant_id")
    .eq("role", "tenant_owner")
    .is("revoked_at", null)
    .limit(1);

  if (memErr) {
    console.error("memberships query error:", memErr);
    return json({ error: "unexpected_error", message: memErr.message }, 500);
  }
  if (!memberships || memberships.length === 0) {
    return json({ error: "no_tenant", message: "Aucun tenant pour ce user" }, 403);
  }
  const tenantId = memberships[0].tenant_id as string;

  // Signer le state pour protéger le callback (CSRF + lien state <-> user)
  const state = await signState(tenantId, userId);

  const authorizeUrl = buildAuthorizeUrl({
    clientId,
    redirectUri,
    state,
    // Scope par défaut Revolut Business = accès lecture comptes + transactions
    // Revolut ne documente pas de scope granulaire, c'est READ de facto
  });

  return json({ ok: true, authorize_url: authorizeUrl });
});
