// AES-256-GCM box for outbound-webhook signing secrets at rest.
//
// A WebhookSubscription's `signing_secret` (the `whsec_…` HMAC key the tenant
// verifies deliveries with) is a live secret: anyone who reads it can forge a
// signed `X-sparx-Signature` payload to the tenant's endpoint. It must not sit
// in the database as plaintext. This module encrypts it on write and decrypts
// it at delivery time (and for the redacted UI preview).
//
// Bundle format mirrors @sparx/integration-framework's secret-crypto: an
// `enc:iv.tag.cipher` ref (12-byte random GCM nonce + 16-byte auth tag +
// ciphertext, all base64), prefixed so decrypt can tell an encrypted value
// from a legacy plaintext one. GCM authenticates on decrypt, so a tampered
// bundle throws rather than returning garbage.
//
// Key: WEBHOOK_SIGNING_SECRET_KEY (32 bytes, base64 or hex; validated at boot
// in each service's env.ts). Same optional-key convention as the other
// at-rest boxes (SEARCH_CONSOLE_TOKEN_KEY, PROVIDER_SECRET_KEY): when the key
// is set the secret is encrypted; production sets it. Read stays tolerant of
// pre-encryption plaintext rows so a rollout never drops a delivery.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const IV_BYTES = 12;
export const WEBHOOK_SECRET_PREFIX = 'enc:';

let cachedKey: Buffer | null | undefined;

function key(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const raw = process.env.WEBHOOK_SIGNING_SECRET_KEY;
  if (!raw) {
    cachedKey = null;
    return cachedKey;
  }
  cachedKey = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  return cachedKey;
}

function requireKey(): Buffer {
  const k = key();
  if (!k) throw new Error('WEBHOOK_SIGNING_SECRET_KEY is not configured.');
  return k;
}

/** Whether webhook-secret encryption is configured (a key is present). */
export function isWebhookSecretCryptoConfigured(): boolean {
  return key() !== null;
}

/** Whether a stored value is an encrypted bundle (vs. a legacy plaintext secret). */
export function isEncryptedWebhookSecret(stored: string): boolean {
  return stored.startsWith(WEBHOOK_SECRET_PREFIX);
}

/** Encrypt a raw signing secret to an `enc:iv.tag.cipher` ref for storage. */
export function encryptWebhookSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', requireKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${WEBHOOK_SECRET_PREFIX}${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

/**
 * Decrypt a stored signing secret back to plaintext. Tolerant by design: a
 * value WITHOUT the `enc:` prefix is a legacy plaintext row (written before
 * encryption shipped, or in a dev env with no key) and is returned as-is, so a
 * rollout never breaks in-flight deliveries. An `enc:` value requires the key.
 */
export function decryptWebhookSecret(stored: string): string {
  if (!isEncryptedWebhookSecret(stored)) return stored;
  const bundle = stored.slice(WEBHOOK_SECRET_PREFIX.length);
  const [ivB64, tagB64, cipherB64] = bundle.split('.');
  if (!ivB64 || !tagB64 || !cipherB64) throw new Error('Malformed webhook secret bundle.');
  const decipher = createDecipheriv('aes-256-gcm', requireKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(cipherB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Encrypt for storage when a key is configured; otherwise return the plaintext
 * unchanged (dev/test with no key). The single write-path helper — callers use
 * this so the policy lives in one place.
 */
export function storeWebhookSecret(plaintext: string): string {
  return isWebhookSecretCryptoConfigured() ? encryptWebhookSecret(plaintext) : plaintext;
}
