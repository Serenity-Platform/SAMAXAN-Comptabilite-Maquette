// Paperasse Lot 2.1 - Helpers Revolut Business OAuth + API
//
// Revolut Business utilise OAuth2 JWT Bearer :
// - L'utilisateur s'authentifie chez Revolut et autorise ton app
// - Revolut redirige vers la callback avec un ?code=<auth_code>
// - Pour échanger ce code contre des tokens, il faut signer un JWT avec TA clé
//   privée RSA (que Revolut a en public pour vérifier)
// - Le JWT signé devient un "client_assertion" envoyé à Revolut avec le code
//
// Docs : https://developer.revolut.com/docs/business/business-api-get-started
//        https://developer.revolut.com/docs/guides/build-banking-apps/tutorials/work-with-api/authenticate-with-api

import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

export const REVOLUT_API_BASE = "https://b2b.revolut.com/api/1.0";
export const REVOLUT_OAUTH_BASE = "https://business.revolut.com/app-confirm";
export const REVOLUT_TOKEN_URL = "https://b2b.revolut.com/api/1.0/auth/token";

/** URL d'autorisation pour l'utilisateur (redirection initiale) */
export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
}): string {
  const q = new URLSearchParams({
    client_id: params.clientId,
    response_type: "code",
    redirect_uri: params.redirectUri,
    state: params.state,
  });
  if (params.scope) q.set("scope", params.scope);
  return `${REVOLUT_OAUTH_BASE}?${q.toString()}`;
}

/** Charge la clé privée RSA PEM dans Web Crypto pour signer des JWT RS256 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // Extraire le contenu base64 entre les lignes BEGIN/END
  const body = pem
    .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/g, "")
    .replace(/-----END (RSA )?PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  // Web Crypto attend du PKCS8, les clés Revolut générées via openssl genrsa sont en PKCS1
  // mais openssl genrsa -traditional est PKCS1, par défaut openssl produit PKCS8 depuis OpenSSL 3.
  // On tente PKCS8 d'abord, fallback PKCS1 via conversion.
  try {
    return await crypto.subtle.importKey(
      "pkcs8",
      der,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
  } catch (_err) {
    // Si PKCS1 : wrap dans un header PKCS8 manuel
    const pkcs8 = wrapPkcs1AsPkcs8(der);
    return await crypto.subtle.importKey(
      "pkcs8",
      pkcs8,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
  }
}

// PKCS1 → PKCS8 : ajoute le header ASN.1 standard
function wrapPkcs1AsPkcs8(pkcs1: Uint8Array): Uint8Array {
  // Header ASN.1 fixe pour RSA PKCS#8 PrivateKeyInfo
  const prefix = new Uint8Array([
    0x30, 0x82, 0x00, 0x00, 0x02, 0x01, 0x00, 0x30, 0x0d, 0x06, 0x09,
    0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
    0x04, 0x82, 0x00, 0x00,
  ]);
  const fullLen = prefix.byteLength + pkcs1.byteLength;
  const out = new Uint8Array(fullLen);
  out.set(prefix, 0);
  out.set(pkcs1, prefix.byteLength);
  // Patcher les longueurs SEQUENCE (offsets 2-3 et 24-25)
  const totalLen = fullLen - 4;
  out[2] = (totalLen >> 8) & 0xff;
  out[3] = totalLen & 0xff;
  const innerLen = pkcs1.byteLength;
  out[24] = (innerLen >> 8) & 0xff;
  out[25] = innerLen & 0xff;
  return out;
}

/**
 * Signe un JWT client_assertion pour Revolut.
 * Selon la doc Revolut:
 *   iss = ton domaine SANS 'https://' (ex: 'wtvnepynwrvvpugmdacd.supabase.co')
 *   sub = ton client_id
 *   aud = 'https://revolut.com'
 *   jti = random
 *   exp = +10min
 * Le domaine 'iss' doit correspondre au domaine du redirect_uri declare chez Revolut.
 */
export async function signClientAssertion(params: {
  clientId: string;
  privateKeyPem: string;
  issuerDomain: string;
}): Promise<string> {
  const key = await importPrivateKey(params.privateKeyPem);
  const jti = crypto.randomUUID();
  return await create(
    { alg: "RS256", typ: "JWT" },
    {
      iss: params.issuerDomain,
      sub: params.clientId,
      aud: "https://revolut.com",
      jti,
      exp: getNumericDate(60 * 10), // 10 minutes
    },
    key,
  );
}

/** Extrait le domaine 'iss' depuis le redirect_uri (sans protocole ni path). */
export function issuerDomainFromRedirectUri(redirectUri: string): string {
  const u = new URL(redirectUri);
  return u.hostname;
}

/** Échange un code OAuth contre un access_token + refresh_token */
export async function exchangeCodeForTokens(params: {
  clientId: string;
  privateKeyPem: string;
  issuerDomain: string;
  code: string;
}): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}> {
  const assertion = await signClientAssertion({
    clientId: params.clientId,
    privateKeyPem: params.privateKeyPem,
    issuerDomain: params.issuerDomain,
  });

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: assertion,
  });

  const resp = await fetch(REVOLUT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Revolut token exchange failed (${resp.status}): ${text}`);
  }
  return await resp.json();
}

/** Rafraîchit un access_token depuis un refresh_token */
export async function refreshAccessToken(params: {
  clientId: string;
  privateKeyPem: string;
  issuerDomain: string;
  refreshToken: string;
}): Promise<{
  access_token: string;
  expires_in: number;
  token_type: string;
}> {
  const assertion = await signClientAssertion({
    clientId: params.clientId,
    privateKeyPem: params.privateKeyPem,
    issuerDomain: params.issuerDomain,
  });

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: assertion,
  });

  const resp = await fetch(REVOLUT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Revolut token refresh failed (${resp.status}): ${text}`);
  }
  return await resp.json();
}

/** Appel générique GET à l'API Revolut (avec access_token) */
export async function revolutGet<T = unknown>(
  accessToken: string,
  path: string,
  query?: Record<string, string>,
): Promise<T> {
  let url = `${REVOLUT_API_BASE}${path}`;
  if (query) {
    const q = new URLSearchParams(query);
    url = `${url}?${q.toString()}`;
  }
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Revolut GET ${path} failed (${resp.status}): ${text}`);
  }
  return (await resp.json()) as T;
}

/** HMAC-SHA256 d'un state (protection CSRF du flow OAuth) */
export async function signState(tenantId: string, userId: string): Promise<string> {
  const secret = Deno.env.get("PAPERASSE_STATE_SECRET") ?? "";
  if (!secret) throw new Error("PAPERASSE_STATE_SECRET missing");
  const payload = `${tenantId}:${userId}:${Date.now()}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
  );
  const sigB64 = btoa(String.fromCharCode(...sig));
  // state = base64(payload).sigB64
  const payloadB64 = btoa(payload);
  return `${payloadB64}.${sigB64}`;
}

export async function verifyState(state: string): Promise<{
  tenantId: string;
  userId: string;
  timestamp: number;
} | null> {
  const secret = Deno.env.get("PAPERASSE_STATE_SECRET") ?? "";
  if (!secret) return null;
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  let payload: string;
  try {
    payload = atob(payloadB64);
  } catch {
    return null;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const sig = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sig,
    new TextEncoder().encode(payload),
  );
  if (!valid) return null;

  const [tenantId, userId, tsStr] = payload.split(":");
  if (!tenantId || !userId || !tsStr) return null;
  const timestamp = Number(tsStr);
  if (Number.isNaN(timestamp)) return null;
  // Expire au bout de 10 minutes
  if (Date.now() - timestamp > 10 * 60 * 1000) return null;
  return { tenantId, userId, timestamp };
}
