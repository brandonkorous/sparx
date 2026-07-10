// AES-256-GCM box for provider-installation secret fields (the marketplace
// "connect a provider" flow — docs/09). A tenant pastes a raw API key into
// the install form; provider-service.ts encrypts it before it ever reaches
// the `configEncrypted` column. The ciphertext is stored prefixed `enc:` so
// the SecretReader can decrypt it inline at call time with no external
// secret-store round trip — unlike `env:`/`projects/` refs, which point AT
// a secret rather than carrying one. Mirrors @sparx/channels/crypto's
// proven AES-256-GCM bundle shape (iv.tag.cipher, base64), keyed by its own
// PROVIDER_SECRET_KEY rather than reusing the channels key (unrelated
// trust domains — OAuth channel grants vs. tenant-pasted provider keys).

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const IV_BYTES = 12;
export const PROVIDER_SECRET_PREFIX = 'enc:';

let cachedKey: Buffer | null | undefined;

function key(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const raw = process.env.PROVIDER_SECRET_KEY;
  if (!raw) {
    cachedKey = null;
    return cachedKey;
  }
  cachedKey = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  return cachedKey;
}

/** Whether provider-secret encryption is configured — gates the install
 *  flow (no key → a secret field can't be stored safely). */
export function isProviderSecretCryptoConfigured(): boolean {
  return key() !== null;
}

function requireKey(): Buffer {
  const k = key();
  if (!k) throw new Error('PROVIDER_SECRET_KEY is not configured.');
  return k;
}

export function isEncryptedProviderSecretRef(ref: string): boolean {
  return ref.startsWith(PROVIDER_SECRET_PREFIX);
}

/** Encrypt a raw secret value to an `enc:iv.tag.cipher` ref, ready to store
 *  in a ProviderInstallation's configEncrypted column. */
export function encryptProviderSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', requireKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PROVIDER_SECRET_PREFIX}${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

/** Decrypt an `enc:...` ref produced by {@link encryptProviderSecret}. Throws
 *  on a tampered or malformed bundle (GCM auth failure or wrong shape). */
export function decryptProviderSecret(ref: string): string {
  const bundle = ref.slice(PROVIDER_SECRET_PREFIX.length);
  const [ivB64, tagB64, cipherB64] = bundle.split('.');
  if (!ivB64 || !tagB64 || !cipherB64) {
    throw new Error('Malformed provider secret bundle.');
  }
  const decipher = createDecipheriv('aes-256-gcm', requireKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(cipherB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
