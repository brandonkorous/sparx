// Tenant BYOK AI credential — the ONE encrypted provider key every AI feature
// runs on (docs/07). sparx never holds a platform-level AI credential; a tenant
// brings their OWN Anthropic or OpenAI account, and this is where it lives.
//
// Stored as a JSON blob on `tenant.settings.ai` (NOT a module flag, and NOT the
// per-module chat config — the credential is account-wide meta-configuration
// that any AI feature reads). The raw key is AES-256-GCM encrypted via
// @sparx/integration-framework's provider-secret box before it ever touches
// storage; the plaintext key is never persisted and never serialized to a
// client. Callers that need to MAKE an AI call decrypt just-in-time via
// `resolveAiProviderCredential`.
//
// The blob shape:
//   { provider, apiKeyEncrypted, keyLast4, connectedAt, lastVerifiedAt }
// The client only ever sees `AiCredentialPublic` (the ciphertext replaced by a
// last-4 hint), exactly as chat config replaces its key with a boolean.

import { prisma } from '@sparx/db';
import { encryptProviderSecret, decryptProviderSecret } from '@sparx/integration-framework';

import { AI_PROVIDERS, type AiProvider } from '../chat/types.js';
import { verifyAiProviderKey } from './llm-router.js';

/** Server-internal record persisted at tenant.settings.ai. NEVER serialize the
 *  ciphertext to a client — go through {@link toPublicCredential}. */
interface AiCredentialRecord {
  provider: AiProvider;
  /** `enc:iv.tag.cipher` ciphertext of the tenant's raw provider key. */
  apiKeyEncrypted: string;
  /** Last four characters of the raw key, for a "…is this the right one?" hint. */
  keyLast4: string;
  connectedAt: string;
  lastVerifiedAt: string | null;
}

/** Client-safe projection — the encrypted key is replaced by its last-4 hint. */
export interface AiCredentialPublic {
  provider: AiProvider;
  keyLast4: string;
  connectedAt: string;
  lastVerifiedAt: string | null;
}

function isAiProvider(v: unknown): v is AiProvider {
  return typeof v === 'string' && (AI_PROVIDERS as readonly string[]).includes(v);
}

function coerceRecord(raw: unknown): AiCredentialRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isAiProvider(r.provider)) return null;
  if (typeof r.apiKeyEncrypted !== 'string' || r.apiKeyEncrypted === '') return null;
  return {
    provider: r.provider,
    apiKeyEncrypted: r.apiKeyEncrypted,
    keyLast4: typeof r.keyLast4 === 'string' ? r.keyLast4 : '',
    connectedAt: typeof r.connectedAt === 'string' ? r.connectedAt : new Date().toISOString(),
    lastVerifiedAt: typeof r.lastVerifiedAt === 'string' ? r.lastVerifiedAt : null,
  };
}

function toPublicCredential(record: AiCredentialRecord): AiCredentialPublic {
  return {
    provider: record.provider,
    keyLast4: record.keyLast4,
    connectedAt: record.connectedAt,
    lastVerifiedAt: record.lastVerifiedAt,
  };
}

async function readRecord(tenantId: string): Promise<AiCredentialRecord | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const settings = (tenant?.settings ?? {}) as Record<string, unknown>;
  return coerceRecord(settings.ai);
}

async function writeRecord(tenantId: string, record: AiCredentialRecord | null): Promise<void> {
  // jsonb_set on the `ai` key only — never clobber sibling settings (chat,
  // modules, onboarding, …). Removing the credential deletes the key outright
  // rather than leaving an empty object behind.
  if (record === null) {
    await prisma.$executeRaw`
      UPDATE tenants
      SET settings = (COALESCE(settings, '{}'::jsonb) - 'ai')
      WHERE id = ${tenantId}::uuid
    `;
    return;
  }
  await prisma.$executeRaw`
    UPDATE tenants
    SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{ai}', ${JSON.stringify(
      record
    )}::jsonb, true)
    WHERE id = ${tenantId}::uuid
  `;
}

/** The tenant's connected AI account, client-safe — or null if none is set. */
export async function getAiCredentialPublic(tenantId: string): Promise<AiCredentialPublic | null> {
  const record = await readRecord(tenantId);
  return record ? toPublicCredential(record) : null;
}

/**
 * Connect (or replace) the tenant's AI account. The key is verified with a real
 * provider call BEFORE it is encrypted and stored — a bad key must never
 * silently brick every AI feature. Throws its own {@link AiCredentialError} on a
 * rejected key so the route can surface the provider's own sentence.
 */
export async function setAiCredential(
  tenantId: string,
  provider: AiProvider,
  apiKey: string
): Promise<AiCredentialPublic> {
  const result = await verifyAiProviderKey(provider, apiKey);
  if (!result.ok) throw new AiCredentialError(result.error);

  const now = new Date().toISOString();
  const record: AiCredentialRecord = {
    provider,
    apiKeyEncrypted: encryptProviderSecret(apiKey),
    keyLast4: apiKey.slice(-4),
    connectedAt: now,
    lastVerifiedAt: now,
  };
  await writeRecord(tenantId, record);
  return toPublicCredential(record);
}

/** Disconnect the tenant's AI account entirely. Idempotent. */
export async function clearAiCredential(tenantId: string): Promise<void> {
  await writeRecord(tenantId, null);
}

/**
 * Re-check the stored key against the provider right now, stamping
 * `lastVerifiedAt` on success. A diagnostic, not a gate: it returns the outcome
 * rather than throwing, so the surface can show "still working" or the exact
 * reason it stopped. Returns null when nothing is connected.
 */
export async function testAiCredential(
  tenantId: string
): Promise<{ ok: true; credential: AiCredentialPublic } | { ok: false; error: string } | null> {
  const record = await readRecord(tenantId);
  if (!record) return null;

  const apiKey = decryptProviderSecret(record.apiKeyEncrypted);
  const result = await verifyAiProviderKey(record.provider, apiKey);
  if (!result.ok) return { ok: false, error: result.error };

  const updated: AiCredentialRecord = { ...record, lastVerifiedAt: new Date().toISOString() };
  await writeRecord(tenantId, updated);
  return { ok: true, credential: toPublicCredential(updated) };
}

/**
 * The decrypted provider + key for an AI feature to make a call with, or null
 * when the tenant has not connected an account. The single seam every AI
 * consumer should read from, so "which key powers this" has one answer.
 */
export async function resolveAiProviderCredential(
  tenantId: string
): Promise<{ provider: AiProvider; apiKey: string } | null> {
  const record = await readRecord(tenantId);
  if (!record) return null;
  return { provider: record.provider, apiKey: decryptProviderSecret(record.apiKeyEncrypted) };
}

/** The MCP resource endpoint an AI client connects to (docs/07 §5). Read from
 *  the same env the OAuth resource identifier uses, so the surface shows the
 *  real address rather than a hardcoded guess. */
export function mcpEndpoint(): string {
  return process.env.MCP_RESOURCE_URL ?? 'http://localhost:3000/v1';
}

/** Thrown when a pasted key fails verification — carries the provider's own
 *  human sentence for the route to render as a 400. */
export class AiCredentialError extends Error {}
