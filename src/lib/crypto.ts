/**
 * Client-side end-to-end encryption primitives (WebCrypto only, no deps).
 *
 * Threat model: the storage layer (Cloudflare D1)
 * only ever receives ciphertext. Keys never leave the browser.
 *
 * - KEK  : PBKDF2-SHA256(master password, per-account salt) -> AES-KW-ish wrap key
 * - DEK  : random AES-GCM-256 key that actually encrypts notes, stored wrapped
 * - Share: separate PBKDF2 key derived from the share password only
 */

const PBKDF2_ITERATIONS = 310_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let out = "";
  for (const b of bytes) out += String.fromCharCode(b);
  return btoa(out);
}

export function fromB64(value: string): Uint8Array {
  const raw = atob(value);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function randomId(bytes = 12): string {
  return Array.from(randomBytes(bytes))
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, bytes * 2);
}

async function deriveBits(
  password: string,
  salt: Uint8Array,
): Promise<ArrayBuffer> {
  const base = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
    },
    base,
    256,
  );
}

/** Derive an AES-GCM key from a password + salt. */
export async function deriveKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const bits = await deriveBits(password, salt);
  return crypto.subtle.importKey(
    "raw",
    bits,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Password verifier: a hash of the derived bits, safe to store alongside ciphertext. */
export async function passwordVerifier(
  password: string,
  salt: Uint8Array,
): Promise<string> {
  const bits = await deriveBits(password, salt);
  const digest = await crypto.subtle.digest("SHA-256", bits);
  return toB64(digest);
}

export type Sealed = { iv: string; data: string };

export async function seal(key: CryptoKey, plaintext: string): Promise<Sealed> {
  const iv = randomBytes(12);
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    enc.encode(plaintext),
  );
  return { iv: toB64(iv), data: toB64(data) };
}

export async function open(key: CryptoKey, sealed: Sealed): Promise<string> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(sealed.iv) as unknown as BufferSource },
    key,
    fromB64(sealed.data) as unknown as BufferSource,
  );
  return dec.decode(plain);
}

/** Create a fresh data-encryption key wrapped by the master password. */
export async function createVaultKeys(password: string) {
  const salt = randomBytes(16);
  const kek = await deriveKey(password, salt);
  const dekRaw = randomBytes(32);
  const wrapped = await seal(kek, toB64(dekRaw));
  const dek = await importDek(dekRaw);
  return {
    dek,
    salt: toB64(salt),
    wrappedKey: wrapped,
    verifier: await passwordVerifier(password, salt),
  };
}

/** Unwrap the data-encryption key. Throws when the password is wrong. */
export async function unlockVaultKey(
  password: string,
  saltB64: string,
  wrapped: Sealed,
): Promise<CryptoKey> {
  const kek = await deriveKey(password, fromB64(saltB64));
  const dekRaw = fromB64(await open(kek, wrapped));
  return importDek(dekRaw);
}

/** Import raw DEK bytes. Extractable so it can be re-wrapped for quick unlock. */
export async function importDek(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    raw as unknown as BufferSource,
    "AES-GCM",
    true,
    ["encrypt", "decrypt"],
  );
}

/** Export the raw DEK bytes (stays in memory / local device only). */
export async function exportDek(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey("raw", key));
}
