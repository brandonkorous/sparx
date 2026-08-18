// AES-256-GCM box for calendar-sync credentials (docs/79 §8.4, §19) — iCal feed
// URLs, OAuth tokens, CalDAV app-passwords. The connection row stores opaque
// ciphertext, never plaintext, so a DB leak alone yields no usable calendar grant.
//
// This is the SAME pattern as the Search Console OAuth-token box
// (lib/search-console/crypto.ts): out-of-band Secret Manager provisioning can't
// hold credentials that are minted + refreshed at runtime, so we encrypt at rest
// with an app-held key (SCHEDULING_CALENDAR_TOKEN_KEY, 32 bytes, validated at boot).
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
  const raw = env.SCHEDULING_CALENDAR_TOKEN_KEY;
  if (!raw) {
    cachedKey = null;
    return cachedKey;
  }
  cachedKey = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  return cachedKey;
}

/** Whether credential encryption is configured — gates calendar connections that
 *  carry a secret (iCal feed / CalDAV / OAuth). */
export function isCalendarCryptoConfigured(): boolean {
  return key() !== null;
}

function requireKey(): Buffer {
  const k = key();
  if (!k) throw new Error('SCHEDULING_CALENDAR_TOKEN_KEY is not configured.');
  return k;
}

/** Encrypt a credential to an `iv.tag.cipher` base64 bundle. */
export function encryptCalendarSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', requireKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

/** Decrypt a bundle from {@link encryptCalendarSecret}. Throws on a tampered or
 *  malformed bundle (GCM auth failure or wrong shape). */
export function decryptCalendarSecret(bundle: string): string {
  const [ivB64, tagB64, cipherB64] = bundle.split('.');
  if (!ivB64 || !tagB64 || !cipherB64) throw new Error('Malformed calendar credential bundle.');
  const decipher = createDecipheriv('aes-256-gcm', requireKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(cipherB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
