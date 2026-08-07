// The api-rest half of calling (docs/144 §5.6) — the credential box, the
// provider wiring, and the signed token the status webhook rides on.
//
// @sparx/crm's call service knows nothing about vendors: it takes an injected
// `CallPlacer`, exactly as the engagement service takes an outbound-mail sink.
// This file is what fills that in at boot, and it is the only place a voice
// credential is decrypted.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { callService, voiceConnectionService } from '@sparx/crm';
import { resolveVoiceProvider, type VoiceProvider } from '@sparx/voice';

import { env } from '../env.js';

const IV_BYTES = 12;

let cachedKey: Buffer | null | undefined;

function key(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const raw = env.CRM_VOICE_TOKEN_KEY;
  if (!raw) {
    cachedKey = null;
    return cachedKey;
  }
  cachedKey = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  return cachedKey;
}

/** Whether a tenant can connect a phone system at all. Gates the connect
 *  endpoint — a flow that "worked" without a key would be storing a plaintext
 *  vendor token. */
export function isVoiceCryptoConfigured(): boolean {
  return key() !== null;
}

function requireKey(): Buffer {
  const k = key();
  if (!k) throw new Error('CRM_VOICE_TOKEN_KEY is not configured.');
  return k;
}

/** Encrypt to an `iv.tag.cipher` base64 bundle — the same AES-256-GCM shape
 *  every other runtime credential on the platform uses. */
export function encryptVoiceSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', requireKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${enc.toString('base64')}`;
}

export function decryptVoiceSecret(bundle: string): string {
  const [ivB64, tagB64, cipherB64] = bundle.split('.');
  if (!ivB64 || !tagB64 || !cipherB64) throw new Error('Malformed voice credential bundle.');
  const decipher = createDecipheriv('aes-256-gcm', requireKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(cipherB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/* ── The status webhook's signed token ───────────────────────────────────── */

const WEBHOOK_KIND = 'crm_call_status';

function secret(): Uint8Array {
  return new TextEncoder().encode(env.SPARX_INTERNAL_JWT_SECRET);
}

/**
 * Sign the token the provider carries back on every status callback.
 *
 * This is what lets the public webhook resolve WHICH TENANT a call belongs to
 * without a cross-tenant scan, and what stops a forged callback from writing an
 * outcome onto another tenant's call. No expiry — a call can ring for minutes
 * and a provider can retry for longer.
 */
export async function signCallStatusToken(tenantId: string): Promise<string> {
  return new SignJWT({ kind: WEBHOOK_KIND, tid: tenantId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .sign(secret());
}

export async function verifyCallStatusToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.kind !== WEBHOOK_KIND || typeof payload.tid !== 'string') return null;
    return payload.tid;
  } catch {
    return null;
  }
}

/** The public HTTPS callback the provider posts to — null in dev and on any
 *  deployment with no public origin, in which case the call still connects and
 *  simply cannot report back. */
export function callStatusUrl(token: string): string | null {
  const base = env.SPARX_PUBLIC_API_REST_URL;
  if (!base) return null;
  try {
    if (new URL(base).protocol !== 'https:') return null;
  } catch {
    return null;
  }
  return `${base.replace(/\/$/, '')}/v1/public/crm/calls/status?t=${encodeURIComponent(token)}`;
}

/* ── Wiring ──────────────────────────────────────────────────────────────── */

/** The provider for one tenant's site, built from THEIR credentials. Falls back
 *  to the console provider when nothing is connected, so the whole path still
 *  runs and the call is still logged. */
export async function providerFor(
  tenantId: string,
  propertyId: string | null
): Promise<{ provider: VoiceProvider; fromNumber: string | null }> {
  const connection = await voiceConnectionService
    .forProperty({ tenantId }, propertyId)
    .catch(() => null);
  if (!connection || !isVoiceCryptoConfigured()) {
    return { provider: resolveVoiceProvider(null), fromNumber: null };
  }
  return {
    provider: resolveVoiceProvider({
      provider: connection.provider,
      accountSid: connection.accountSid,
      authToken: decryptVoiceSecret(connection.authTokenEnc),
      fromNumber: connection.fromNumber,
    }),
    fromNumber: connection.fromNumber,
  };
}

/**
 * Install the placer @sparx/crm calls when someone clicks Call.
 *
 * Resolves the tenant's own vendor per call rather than caching one: a tenant
 * can rotate their token or change their number at any moment, and a cached
 * provider would keep dialling from the old one until the pod restarted.
 */
export function installCallPlacer(): void {
  callService.setCallPlacer({
    place: async ({ tenantId, to, from, bridgeTo }) => {
      const { provider } = await providerFor(tenantId, null);
      const token = await signCallStatusToken(tenantId);
      const result = await provider.place({
        to,
        from,
        bridgeTo,
        statusCallbackUrl: callStatusUrl(token),
        tenantId,
      });
      return {
        success: result.success,
        ...(result.providerCallId ? { providerCallId: result.providerCallId } : {}),
        provider: provider.id,
        ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}),
      };
    },
  });
}
