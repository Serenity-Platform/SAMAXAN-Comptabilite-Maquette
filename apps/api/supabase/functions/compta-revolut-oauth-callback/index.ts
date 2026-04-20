// Paperasse Lot 2.1 - Edge Function compta-revolut-oauth-callback (monolithic)
import { createClient } from "npm:@supabase/supabase-js@2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

// ===== crypto helpers =====
const ENCRYPTION_VERSION = "v1";

function getKeyBytes(): Uint8Array {
  const keyB64 = Deno.env.get("PAPERASSE_ENCRYPTION_KEY");
  if (!keyB64) throw new Error("PAPERASSE_ENCRYPTION_KEY env var missing");
  const key = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));
  if (key.byteLength !== 32) throw new Error(`PAPERASSE_ENCRYPTION_KEY must be 32 bytes; got ${key.byteLength}`);
  return key;
}

async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return await crypto.subtle.importKey("raw", raw, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

function bytesToB64(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)); }

async function encryptToken(plaintext: string): Promise<string> {
  const key = await importAesKey(getKeyBytes());
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const encBytes = new Uint8Array(encrypted);
  const tagLen = 16;
  const ciphertext = encBytes.slice(0, encBytes.byteLength - tagLen);
  const tag = encBytes.slice(encBytes.byteLength - tagLen);
  return `${ENCRYPTION_VERSION}.${bytesToB64(iv)}.${bytesToB64(ciphertext)}.${bytesToB64(tag)}`;
}

// ===== Revolut helpers =====
const REVOLUT_API_BASE = "https://b2b.revolut.com/api/1.0";
const REVOLUT_TOKEN_URL = "https://b2b.revolut.com/api/1.0/auth/token";

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem.replace(/-----BEGIN (RSA )?PRIVATE KEY-----/g, "").replace(/-----END (RSA )?PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  try {
    return await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  } catch (_err) {
    const pkcs8 = wrapPkcs1AsPkcs8(der);
    return await crypto.subtle.importKey("pkcs8", pkcs8, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  }
}

function wrapPkcs1AsPkcs8(pkcs1: Uint8Array): Uint8Array {
  const prefix = new Uint8Array([0x30, 0x82, 0x00, 0x00, 0x02, 0x01, 0x00, 0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00, 0x04, 0x82, 0x00, 0x00]);
  const fullLen = prefix.byteLength + pkcs1.byteLength;
  const out = new Uint8Array(fullLen);
  out.set(prefix, 0);
  out.set(pkcs1, prefix.byteLength);
  const totalLen = fullLen - 4;
  out[2] = (totalLen >> 8) & 0xff; out[3] = totalLen & 0xff;
  const innerLen = pkcs1.byteLength;
  out[24] = (innerLen >> 8) & 0xff; out[25] = innerLen & 0xff;
  return out;
}

/** Extrait le domaine depuis le redirect_uri (sans protocole ni path). */
function issuerDomainFromRedirectUri(redirectUri: string): string {
  return new URL(redirectUri).hostname;
}

/**
 * Signe un JWT client_assertion pour Revolut.
 * Selon la doc Revolut:
 *   iss = ton domaine SANS 'https://' (ex: wtvnepynwrvvpugmdacd.supabase.co)
 *   sub = ton client_id
 *   aud = 'https://revolut.com'
 */
async function signClientAssertion(clientId: string, privateKeyPem: string, issuerDomain: string): Promise<string> {
  const key = await importPrivateKey(privateKeyPem);
  const jti = crypto.randomUUID();
  return await create(
    { alg: "RS256", typ: "JWT" },
    {
      iss: issuerDomain,
      sub: clientId,
      aud: "https://revolut.com",
      jti,
      exp: getNumericDate(60 * 10),
    },
    key,
  );
}

async function exchangeCodeForTokens(clientId: string, privateKeyPem: string, issuerDomain: string, code: string) {
  const assertion = await signClientAssertion(clientId, privateKeyPem, issuerDomain);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: assertion,
  });
  const resp = await fetch(REVOLUT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!resp.ok) { const t = await resp.text(); throw new Error(`Revolut token exchange failed (${resp.status}): ${t}`); }
  return await resp.json();
}

async function revolutGet<T = unknown>(accessToken: string, path: string): Promise<T> {
  const resp = await fetch(`${REVOLUT_API_BASE}${path}`, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
  if (!resp.ok) { const t = await resp.text(); throw new Error(`Revolut GET ${path} failed (${resp.status}): ${t}`); }
  return (await resp.json()) as T;
}

async function verifyState(state: string) {
  const secret = Deno.env.get("PAPERASSE_STATE_SECRET") ?? "";
  if (!secret) return null;
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  let payload: string;
  try { payload = atob(payloadB64); } catch { return null; }
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const sig = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify("HMAC", key, sig, new TextEncoder().encode(payload));
  if (!valid) return null;
  const [tenantId, userId, tsStr] = payload.split(":");
  if (!tenantId || !userId || !tsStr) return null;
  const timestamp = Number(tsStr);
  if (Number.isNaN(timestamp)) return null;
  if (Date.now() - timestamp > 10 * 60 * 1000) return null;
  return { tenantId, userId, timestamp };
}

// ===== Handler =====
function htmlRedirect(targetUrl: string): Response {
  const safe = targetUrl.replace(/"/g, "&quot;");
  const body = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${safe}"><title>Redirection…</title></head><body><p>Redirection vers Paperasse…</p><script>window.location.replace("${safe}");</script></body></html>`;
  return new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}

function errorRedirect(frontBase: string, code: string, message?: string): Response {
  const params = new URLSearchParams({ revolut_status: "error", revolut_error: code });
  if (message) params.set("revolut_message", message);
  return htmlRedirect(`${frontBase}/#settings-integrations?${params.toString()}`);
}

function successRedirect(frontBase: string, integrationId: string, accountsCount: number): Response {
  const params = new URLSearchParams({ revolut_status: "success", revolut_integration_id: integrationId, revolut_accounts_count: String(accountsCount) });
  return htmlRedirect(`${frontBase}/#settings-integrations?${params.toString()}`);
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const frontBase = Deno.env.get("PAPERASSE_FRONT_BASE_URL") ?? "https://samaxan-compta-maquette.netlify.app";

  const errorFromRevolut = url.searchParams.get("error");
  if (errorFromRevolut) return errorRedirect(frontBase, "revolut_denied", url.searchParams.get("error_description") ?? errorFromRevolut);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return errorRedirect(frontBase, "missing_code_or_state");

  const stateInfo = await verifyState(state);
  if (!stateInfo) return errorRedirect(frontBase, "invalid_state");
  const { tenantId, userId } = stateInfo;

  const clientId = Deno.env.get("REVOLUT_CLIENT_ID");
  const privateKeyPem = Deno.env.get("REVOLUT_PRIVATE_KEY");
  const redirectUri = Deno.env.get("REVOLUT_REDIRECT_URI") ?? "";
  if (!clientId || !privateKeyPem || !redirectUri) return errorRedirect(frontBase, "revolut_not_configured");

  // FIX: iss doit etre le domaine du redirect_uri, SANS https://
  const issuerDomain = issuerDomainFromRedirectUri(redirectUri);

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(clientId, privateKeyPem, issuerDomain, code);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Token exchange failed:", msg);
    return errorRedirect(frontBase, "token_exchange_failed", msg);
  }

  let accounts: unknown[] = [];
  try {
    accounts = await revolutGet<unknown[]>(tokens.access_token, "/accounts");
    if (!Array.isArray(accounts)) accounts = [];
  } catch (err) { console.error("Fetching accounts failed (non-fatal):", err); }

  const accessEnc = await encryptToken(tokens.access_token);
  const refreshEnc = await encryptToken(tokens.refresh_token);
  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 2400) * 1000).toISOString();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: le } = await admin.schema("compta").from("legal_entities").select("id").eq("tenant_id", tenantId).maybeSingle();

  await admin.schema("compta").from("bank_integrations").update({
    status: "revoked",
    disconnected_at: new Date().toISOString(),
    disconnected_by: userId,
    access_token_enc: null,
    refresh_token_enc: null,
    token_expires_at: null,
  }).eq("tenant_id", tenantId).eq("provider", "revolut_business").eq("status", "connected");

  const { data: integration, error: insErr } = await admin.schema("compta").from("bank_integrations").insert({
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
  }).select("id").single();

  if (insErr || !integration) {
    console.error("Insert integration failed:", insErr);
    return errorRedirect(frontBase, "db_insert_failed", insErr?.message);
  }

  await admin.schema("compta").from("audit_logs").insert({
    tenant_id: tenantId,
    legal_entity_id: le?.id ?? null,
    entity_type: "bank_integration",
    entity_id: integration.id,
    event_type: "connect",
    old_value: null,
    new_value: { provider: "revolut_business", accounts_count: accounts.length },
    actor_id: userId,
    actor_type: "user",
    priority: "normal",
  });

  return successRedirect(frontBase, integration.id, accounts.length);
});
