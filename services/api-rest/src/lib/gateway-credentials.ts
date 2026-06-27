// Bring-your-own gateway credential capture + read (docs/111 §2). The merchant pastes
// API keys in the dashboard; we partition them into secret vs public per the catalog
// descriptor, AES-256-GCM-encrypt the secret bundle (@sparx/channels/crypto — the same
// box channel OAuth tokens use), and store ciphertext in `tenant_gateway_credentials`.
// The injected GatewayCredentialReader (wired in payments-bootstrap) decrypts at
// runtime for the adapters. Secrets are NEVER returned to the dashboard — the masked
// view exposes only the public fields + a "secrets on file" flag.

import { withTenant } from '@sparx/db';
import { encryptChannelToken, decryptChannelToken } from '@sparx/channels/crypto';
import {
  getGatewayDescriptor,
  type GatewayCredentialReader,
  type GatewayCredentials,
} from '@sparx/payments';

export class GatewayCredentialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GatewayCredentialError';
  }
}

type Environment = 'sandbox' | 'production';

function asEnvironment(value: string): Environment {
  return value === 'sandbox' ? 'sandbox' : 'production';
}

function asRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

/** The injected reader: decrypts the stored bundle for the gateway adapters. */
export function buildGatewayCredentialReader(): GatewayCredentialReader {
  return {
    async read(tenantId: string, gatewayId: string): Promise<GatewayCredentials | null> {
      const row = await withTenant({ tenantId }, (tx) =>
        tx.tenantGatewayCredential.findUnique({
          where: { tenantId_gatewayId: { tenantId, gatewayId } },
        })
      );
      if (!row) return null;
      const secrets = row.secretEnc ? asRecord(JSON.parse(decryptChannelToken(row.secretEnc))) : {};
      return {
        gatewayId,
        environment: asEnvironment(row.environment),
        secrets,
        publicMeta: asRecord(row.publicMeta),
      };
    },
  };
}

export interface MaskedGatewayCredential {
  gatewayId: string;
  environment: Environment;
  status: string;
  /** Non-secret captured fields, safe to render + re-edit. */
  publicMeta: Record<string, string>;
  /** Whether encrypted secrets are on file (so the form shows "•••• on file"). */
  hasSecrets: boolean;
  configuredAt: string;
}

export async function listGatewayCredentials(tenantId: string): Promise<MaskedGatewayCredential[]> {
  const rows = await withTenant({ tenantId }, (tx) =>
    tx.tenantGatewayCredential.findMany({ orderBy: { createdAt: 'asc' } })
  );
  return rows.map((r) => ({
    gatewayId: r.gatewayId,
    environment: asEnvironment(r.environment),
    status: r.status,
    publicMeta: asRecord(r.publicMeta),
    hasSecrets: r.secretEnc !== null,
    configuredAt: r.createdAt.toISOString(),
  }));
}

export interface CaptureCredentialInput {
  gatewayId: string;
  environment: Environment;
  /** Every submitted field; secret ones are encrypted, the rest stored in the clear. */
  fields: Record<string, string>;
}

/** Capture (or replace) a gateway's credentials. A blank secret field KEEPS the value
 *  already on file (the masked form never returns secrets) — re-entering replaces it. */
export async function captureGatewayCredentials(
  tenantId: string,
  input: CaptureCredentialInput
): Promise<MaskedGatewayCredential> {
  const desc = getGatewayDescriptor(input.gatewayId);
  if (desc?.onboarding !== 'api_keys') {
    throw new GatewayCredentialError(`Gateway ${input.gatewayId} does not accept API keys.`);
  }

  // Preserve existing secrets the merchant didn't re-enter.
  const existing = await withTenant({ tenantId }, (tx) =>
    tx.tenantGatewayCredential.findUnique({
      where: { tenantId_gatewayId: { tenantId, gatewayId: input.gatewayId } },
    })
  );
  const priorSecrets =
    existing?.secretEnc != null
      ? asRecord(JSON.parse(decryptChannelToken(existing.secretEnc)))
      : {};

  const secrets: Record<string, string> = { ...priorSecrets };
  const publicMeta: Record<string, string> = {};

  for (const field of desc.credentialFields) {
    const raw = input.fields[field.key]?.trim() ?? '';
    if (field.secret) {
      if (raw) secrets[field.key] = raw;
      if (!field.optional && !secrets[field.key]) {
        throw new GatewayCredentialError(`${field.label} is required.`);
      }
    } else {
      if (raw) publicMeta[field.key] = raw;
      else if (!field.optional) {
        throw new GatewayCredentialError(`${field.label} is required.`);
      }
    }
  }

  const secretEnc =
    Object.keys(secrets).length > 0 ? encryptChannelToken(JSON.stringify(secrets)) : null;

  const row = await withTenant({ tenantId }, (tx) =>
    tx.tenantGatewayCredential.upsert({
      where: { tenantId_gatewayId: { tenantId, gatewayId: input.gatewayId } },
      create: {
        tenantId,
        gatewayId: input.gatewayId,
        environment: input.environment,
        secretEnc,
        publicMeta,
        status: 'active',
      },
      update: { environment: input.environment, secretEnc, publicMeta, status: 'active' },
    })
  );

  return {
    gatewayId: row.gatewayId,
    environment: asEnvironment(row.environment),
    status: row.status,
    publicMeta: asRecord(row.publicMeta),
    hasSecrets: row.secretEnc !== null,
    configuredAt: row.createdAt.toISOString(),
  };
}

export async function deleteGatewayCredentials(tenantId: string, gatewayId: string): Promise<void> {
  await withTenant({ tenantId }, (tx) =>
    tx.tenantGatewayCredential.deleteMany({ where: { gatewayId } })
  );
}

/** Whether a tenant has active, usable credentials for an api-key gateway. */
export async function hasActiveCredentials(tenantId: string, gatewayId: string): Promise<boolean> {
  const row = await withTenant({ tenantId }, (tx) =>
    tx.tenantGatewayCredential.findUnique({
      where: { tenantId_gatewayId: { tenantId, gatewayId } },
      select: { status: true },
    })
  );
  return row?.status === 'active';
}
