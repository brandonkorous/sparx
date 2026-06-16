// AES-256-GCM token box for the Search Console OAuth grant (docs/50 §7).
//
// The connection table stores access/refresh tokens as opaque ciphertext, never
// plaintext — a DB leak alone must not yield a usable Google grant. The key is
// SEARCH_CONSOLE_TOKEN_KEY (32 bytes, base64 or hex; validated at boot in env.ts).
//
// Bundle format: `${ivB64}.${tagB64}.${cipherB64}` — a 12-byte random IV (the
// GCM standard nonce size) + the 16-byte auth tag + the ciphertext, all base64.
// GCM authenticates on decrypt, so a tampered bundle throws rather than
// returning garbage.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { env } from '../../env.js';

const IV_BYTES = 12;

/** The 32-byte key, or null when the connector is not configured. Cached after
 *  first decode (the env value is immutable for the process lifetime). */
let cachedKey: Buffer | null | undefined;

function key(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const raw = env.SEARCH_CONSOLE_TOKEN_KEY;
  if (!raw) {
    cachedKey = null;
    return cachedKey;
  }
  cachedKey = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64');
  return cachedKey;
}

/** Whether token encryption is configured — gates the whole connector. */
export function isTokenCryptoConfigured(): boolean {
  return key() !== null;
}

function requireKey(): Buffer {
  const k = key();
  if (!k) throw new Error('SEARCH_CONSOLE_TOKEN_KEY is not configured.');
  return k;
}

/** Encrypt a token to a `iv.tag.cipher` base64 bundle. */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', requireKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

/** Decrypt a bundle produced by {@link encryptToken}. Throws on a tampered or
 *  malformed bundle (GCM auth failure or wrong shape). */
export function decryptToken(bundle: string): string {
  const [ivB64, tagB64, cipherB64] = bundle.split('.');
  if (!ivB64 || !tagB64 || !cipherB64) throw new Error('Malformed token bundle.');
  const decipher = createDecipheriv('aes-256-gcm', requireKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(cipherB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
