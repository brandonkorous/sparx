// voiceConnectionService — a tenant's own phone system (docs/144 §5.6).
//
// TENANT-BYO, NOT PLATFORM. sparx never fronts its own vendor account for a
// tenant's outbound calls: their account, their number, their bill, and their
// compliance posture on a call their business is making. The same rule that
// governs AI credentials governs this one.
//
// CREDENTIALS NEVER LEAVE THIS FILE IN PLAINTEXT. Every read strips the
// encrypted column, so an auth token cannot reach a REST response by someone
// forgetting to omit it. The one function that hands it out is named to be
// conspicuous at the call site.

import { ConnectVoiceInput } from '@sparx/crm-schemas';
import { withTenant } from '@sparx/db';
import type { VoiceConnection } from '@sparx/db';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError } from '../errors';

/** A phone system as everything outside this file may see it — no auth token. */
export interface VoiceConnectionView {
  id: string;
  provider: string;
  propertyId: string | null;
  accountSid: string;
  fromNumber: string;
  recordingEnabled: boolean;
  status: string;
  lastError: string | null;
}

function toView(row: VoiceConnection): VoiceConnectionView {
  return {
    id: row.id,
    provider: row.provider,
    propertyId: row.propertyId,
    // The account id is not a secret — it is visible in the vendor's own
    // dashboard — and showing it is how someone confirms they connected the
    // right account.
    accountSid: row.accountSid,
    fromNumber: row.fromNumber,
    recordingEnabled: row.recordingEnabled,
    status: row.status,
    lastError: row.lastError,
  };
}

export async function list(ctx: ServiceContext): Promise<VoiceConnectionView[]> {
  const rows = await withTenant(ctx, (tx) => tx.voiceConnection.findMany({}));
  return rows.map(toView);
}

/**
 * The phone system a given site should call from.
 *
 * Falls back to the tenant-wide row when a site has none of its own, because a
 * business with one number and three sites should not have to connect it three
 * times — but a business running two unrelated businesses must be able to.
 */
export async function forProperty(
  ctx: ServiceContext,
  propertyId: string | null
): Promise<VoiceConnection | null> {
  return withTenant(ctx, async (tx) => {
    if (propertyId) {
      const own = await tx.voiceConnection.findFirst({ where: { propertyId, status: 'active' } });
      if (own) return own;
    }
    return tx.voiceConnection.findFirst({ where: { propertyId: null, status: 'active' } });
  });
}

/** The auth token, still encrypted. Named to be conspicuous — only the code
 *  that actually places a call has any business calling it. */
export async function readCredentials(
  ctx: ServiceContext,
  connectionId: string
): Promise<VoiceConnection> {
  const row = await withTenant(ctx, (tx) =>
    tx.voiceConnection.findUnique({ where: { id: connectionId } })
  );
  if (!row) throw new CrmNotFoundError('VoiceConnection', connectionId);
  return row;
}

export interface ConnectVoiceOptions {
  /** Ciphertext, produced by the caller with the platform's AES-256-GCM helper.
   *  This service never sees a key and never does crypto. */
  authTokenEnc: string;
}

/**
 * Connect (or replace) a site's phone system.
 *
 * An upsert rather than a create: reconnecting after rotating a vendor token is
 * the common case, and making someone disconnect first would mean a window
 * where nobody can call.
 */
export async function connect(
  ctx: ServiceContext,
  rawInput: unknown,
  options: ConnectVoiceOptions
): Promise<VoiceConnectionView> {
  const input = ConnectVoiceInput.parse(rawInput);

  const row = await withTenant(ctx, async (tx) => {
    const existing = await tx.voiceConnection.findFirst({
      where: { propertyId: input.propertyId ?? null },
    });

    const data = {
      provider: input.provider,
      accountSid: input.accountSid,
      authTokenEnc: options.authTokenEnc,
      fromNumber: input.fromNumber,
      recordingEnabled: input.recordingEnabled,
      status: 'active',
      lastError: null,
    };

    const saved = existing
      ? await tx.voiceConnection.update({ where: { id: existing.id }, data })
      : await tx.voiceConnection.create({
          data: { ...data, tenantId: ctx.tenantId, propertyId: input.propertyId ?? null },
        });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.voice.connected',
      entityType: 'VoiceConnection',
      entityId: saved.id,
      // The number and whether recording is on, never the token. Recording is
      // audited because switching it on is a legally significant decision.
      diff: {
        after: { fromNumber: saved.fromNumber, recordingEnabled: saved.recordingEnabled },
      },
    });
    return saved;
  });

  return toView(row);
}

/** Disconnect. The CALL HISTORY survives — nobody disconnecting a phone system
 *  means "delete the record of every call we have made". */
export async function disconnect(ctx: ServiceContext, connectionId: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const before = await tx.voiceConnection.findUnique({ where: { id: connectionId } });
    if (!before) throw new CrmNotFoundError('VoiceConnection', connectionId);

    await tx.voiceConnection.delete({ where: { id: connectionId } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.voice.disconnected',
      entityType: 'VoiceConnection',
      entityId: connectionId,
      diff: { before: { fromNumber: before.fromNumber } },
    });
  });
}
