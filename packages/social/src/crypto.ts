// AES-256-GCM token box for social-posting OAuth grants (docs/133 §5).
//
// social_connections stores access/refresh tokens as opaque ciphertext, never
// plaintext — a DB leak alone must not yield a usable Facebook/Instagram/LinkedIn/…
// grant. The key is SOCIAL_TOKEN_KEY (32 bytes, base64 or hex) — a DEDICATED key,
// deliberately SEPARATE from channels' CHANNELS_TOKEN_KEY, so a compromise of one
// module's key never exposes the other's grants and each rotates on its own schedule.
// A row cipher box (not a Secret-Manager ref) because per-tenant OAuth tokens rotate
// constantly and a ref would churn a billed secret version per refresh.
//
// Server-only — imported by api-rest (encrypt on connect) and social-worker (decrypt
// on publish), NEVER by the composer UI. Reached via the `@sparx/social/crypto`
// subpath. Shares the exact bundle format + algorithm as @sparx/channels/crypto.
//
// Bundle format: `${ivB64}.${tagB64}.${cipherB64}` — a 12-byte random IV (the GCM
// standard nonce size) + the 16-byte auth tag + the ciphertext, all base64. GCM
// authenticates on decrypt, so a tampered bundle throws rather than returning garbage.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const IV_BYTES = 12;

/** The 32-byte key, or null when social token crypto is not configured. Cached after
 *  first decode (the env value is immutable for the process lifetime). */
let cachedKey: Buffer | null | undefined;

function key(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const raw = process.env.SOCIAL_TOKEN_KEY;
  if (!raw) {
    cachedKey = null;
    return cachedKey;
  }
  cachedKey = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  return cachedKey;
}

/** Whether social token encryption is configured — gates the whole connect flow (no
 *  key → no account can be connected, since tokens couldn't be stored safely). */
export function isSocialTokenCryptoConfigured(): boolean {
  return key() !== null;
}

function requireKey(): Buffer {
  const k = key();
  if (!k) throw new Error('SOCIAL_TOKEN_KEY is not configured.');
  return k;
}

/** Encrypt a token to an `iv.tag.cipher` base64 bundle. */
export function encryptSocialToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', requireKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

/** Decrypt a bundle produced by {@link encryptSocialToken}. Throws on a tampered or
 *  malformed bundle (GCM auth failure or wrong shape). */
export function decryptSocialToken(bundle: string): string {
  const [ivB64, tagB64, cipherB64] = bundle.split('.');
  if (!ivB64 || !tagB64 || !cipherB64) throw new Error('Malformed social token bundle.');
  const decipher = createDecipheriv('aes-256-gcm', requireKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(cipherB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
