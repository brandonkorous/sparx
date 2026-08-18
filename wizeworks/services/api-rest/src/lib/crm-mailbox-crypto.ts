// AES-256-GCM box for connected-mailbox credentials (docs/144 §5.2) — OAuth
// access/refresh tokens, IMAP/SMTP app passwords, BYO client secrets. The
// connection row stores opaque ciphertext, never plaintext, so a database leak
// alone yields no usable mailbox grant.
//
// The SAME pattern as scheduling's calendar box and Search Console's token box:
// out-of-band Secret Manager provisioning cannot hold credentials that are
// minted and refreshed at runtime, so we encrypt at rest with an app-held key.
//
// It is a DIFFERENT KEY (CRM_MAILBOX_TOKEN_KEY) from scheduling's, deliberately.
// The blast radius of one compromised key should be one capability rather than
// every connected account a tenant owns, and reading a person's mail is a
// strictly larger harm than reading their free/busy.
//
// Bundle format: `${ivB64}.${tagB64}.${cipherB64}` — a 12-byte random IV, the
// 16-byte GCM auth tag, and the ciphertext, all base64. GCM authenticates on
// decrypt, so a tampered bundle throws rather than returning garbage.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { env } from '../env.js';

const IV_BYTES = 12;

let cachedKey: Buffer | null | undefined;

function key(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const raw = env.CRM_MAILBOX_TOKEN_KEY;
  if (!raw) {
    cachedKey = null;
    return cachedKey;
  }
  cachedKey = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  return cachedKey;
}

/** Whether mailbox credential encryption is configured. Gates every path that
 *  would store a credential — a connect flow that "worked" without a key would
 *  be writing plaintext tokens. */
export function isMailboxCryptoConfigured(): boolean {
  return key() !== null;
}

function requireKey(): Buffer {
  const k = key();
  if (!k) throw new Error('CRM_MAILBOX_TOKEN_KEY is not configured.');
  return k;
}

/** Encrypt a credential to an `iv.tag.cipher` base64 bundle. */
export function encryptMailboxSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', requireKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

/** Decrypt a bundle from {@link encryptMailboxSecret}. Throws on a tampered or
 *  malformed bundle (GCM auth failure or wrong shape). */
export function decryptMailboxSecret(bundle: string): string {
  const [ivB64, tagB64, cipherB64] = bundle.split('.');
  if (!ivB64 || !tagB64 || !cipherB64) throw new Error('Malformed mailbox credential bundle.');
  const decipher = createDecipheriv('aes-256-gcm', requireKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(cipherB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
