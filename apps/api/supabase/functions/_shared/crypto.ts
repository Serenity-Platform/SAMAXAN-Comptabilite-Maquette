// Paperasse Lot 2.1 - Helper chiffrement AES-256-GCM pour tokens OAuth
//
// Format ciphertext retourné (base64 URL-safe unique string) :
//   v1.<iv_b64>.<ciphertext_b64>.<tag_b64>
// - v1 = version de schéma (permet rotation future)
// - iv = 12 bytes (96 bits, recommandé GCM)
// - ciphertext = données chiffrées
// - tag = auth tag 16 bytes (intégrité)
//
// La clé est lue depuis Deno.env.get("PAPERASSE_ENCRYPTION_KEY").
// Format attendu : 32 bytes encodés en base64 (donc ~44 chars).
// Génération : `openssl rand -base64 32`

const ENCRYPTION_VERSION = "v1";

function getKeyBytes(): Uint8Array {
  const keyB64 = Deno.env.get("PAPERASSE_ENCRYPTION_KEY");
  if (!keyB64) {
    throw new Error("PAPERASSE_ENCRYPTION_KEY env var missing");
  }
  const key = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));
  if (key.byteLength !== 32) {
    throw new Error(
      `PAPERASSE_ENCRYPTION_KEY must be 32 bytes (base64 of 32 raw bytes); got ${key.byteLength}`,
    );
  }
  return key;
}

async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function bytesToB64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function b64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Chiffre une chaîne plaintext et retourne un ciphertext compact auto-descriptif. */
export async function encryptToken(plaintext: string): Promise<string> {
  const key = await importAesKey(getKeyBytes());
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );
  const encBytes = new Uint8Array(encrypted);

  // AES-GCM de Web Crypto concatène ciphertext + tag ; on split pour le format propre.
  // Tag GCM = 16 bytes à la fin.
  const tagLen = 16;
  const ciphertext = encBytes.slice(0, encBytes.byteLength - tagLen);
  const tag = encBytes.slice(encBytes.byteLength - tagLen);

  return `${ENCRYPTION_VERSION}.${bytesToB64(iv)}.${bytesToB64(ciphertext)}.${bytesToB64(tag)}`;
}

/** Déchiffre un ciphertext produit par encryptToken(). Throw si corrompu ou mauvaise clé. */
export async function decryptToken(payload: string): Promise<string> {
  const parts = payload.split(".");
  if (parts.length !== 4) throw new Error("Invalid ciphertext format");
  const [version, ivB64, ctB64, tagB64] = parts;

  if (version !== ENCRYPTION_VERSION) {
    throw new Error(`Unsupported ciphertext version: ${version}`);
  }

  const iv = b64ToBytes(ivB64);
  const ct = b64ToBytes(ctB64);
  const tag = b64ToBytes(tagB64);

  // Recomposer ct+tag pour Web Crypto
  const combined = new Uint8Array(ct.byteLength + tag.byteLength);
  combined.set(ct, 0);
  combined.set(tag, ct.byteLength);

  const key = await importAesKey(getKeyBytes());
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    combined,
  );
  return new TextDecoder().decode(decrypted);
}
