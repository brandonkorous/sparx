// Calendar connections + external busy blocks (docs/79 §8). The engine persists
// connections and the imported busy intervals; it does NOT do crypto or network —
// the api-rest sync orchestrator encrypts credentials (AES-256-GCM, the key lives
// in api-rest) and fetches feeds, then calls these under tenant RLS.
//
// A connection's credential columns are opaque ciphertext bundles supplied by the
// caller (already encrypted) or null; this layer never sees plaintext secrets.

import { withTenant, type CalendarConnection, type TxClient } from '@sparx/db';

import { CalendarConnectionNotFoundError, ResourceNotFoundError } from './errors';
import type { Interval } from './time';

/** Pre-encrypted connection fields (api-rest encrypts before calling). */
export interface CreateConnectionData {
  resourceId: string;
  provider: string;
  connectionKind: string; // ical_feed | caldav | oauth
  credentialSource?: string; // platform | tenant_byo
  direction?: string; // in | out | two_way
  fidelity?: string; // realtime | stale_feed
  externalCalendarId?: string | null;
  icalUrlEnc?: string | null;
  accessTokenEnc?: string | null;
  refreshTokenEnc?: string | null;
  tokenExpiresAt?: Date | null;
  appPasswordEnc?: string | null;
  caldavUsername?: string | null;
  caldavUrl?: string | null;
  oauthClientId?: string | null;
  oauthClientSecretEnc?: string | null;
}

export interface ConnectionSyncState {
  status?: string; // active | expired | error
  lastError?: string | null;
  lastSyncedAt?: Date | null;
  syncToken?: string | null;
  channelId?: string | null;
  channelExpiresAt?: Date | null;
  accessTokenEnc?: string | null;
  refreshTokenEnc?: string | null;
  tokenExpiresAt?: Date | null;
}

export async function createCalendarConnection(
  tenantId: string,
  data: CreateConnectionData
): Promise<CalendarConnection> {
  return withTenant({ tenantId }, async (tx) => {
    const resource = await tx.schedulingResource.findFirst({
      where: { id: data.resourceId, deletedAt: null },
      select: { id: true },
    });
    if (!resource) throw new ResourceNotFoundError(data.resourceId);
    return tx.calendarConnection.create({
      data: {
        tenantId,
        resourceId: data.resourceId,
        provider: data.provider,
        connectionKind: data.connectionKind,
        credentialSource: data.credentialSource ?? 'tenant_byo',
        direction: data.direction ?? 'in',
        fidelity: data.fidelity ?? 'stale_feed',
        externalCalendarId: data.externalCalendarId ?? null,
        icalUrlEnc: data.icalUrlEnc ?? null,
        accessTokenEnc: data.accessTokenEnc ?? null,
        refreshTokenEnc: data.refreshTokenEnc ?? null,
        tokenExpiresAt: data.tokenExpiresAt ?? null,
        appPasswordEnc: data.appPasswordEnc ?? null,
        caldavUsername: data.caldavUsername ?? null,
        caldavUrl: data.caldavUrl ?? null,
        oauthClientId: data.oauthClientId ?? null,
        oauthClientSecretEnc: data.oauthClientSecretEnc ?? null,
        status: 'active',
      },
    });
  });
}

export async function listCalendarConnections(
  tenantId: string,
  resourceId?: string
): Promise<CalendarConnection[]> {
  return withTenant({ tenantId }, (tx) =>
    tx.calendarConnection.findMany({
      where: { ...(resourceId ? { resourceId } : {}) },
      orderBy: { createdAt: 'desc' },
    })
  );
}

export async function getCalendarConnection(
  tenantId: string,
  id: string
): Promise<CalendarConnection> {
  return withTenant({ tenantId }, async (tx) => {
    const row = await tx.calendarConnection.findUnique({ where: { id } });
    if (!row) throw new CalendarConnectionNotFoundError(id);
    return row;
  });
}

export async function deleteCalendarConnection(tenantId: string, id: string): Promise<void> {
  await withTenant({ tenantId }, async (tx) => {
    const existing = await tx.calendarConnection.findUnique({ where: { id } });
    if (!existing) throw new CalendarConnectionNotFoundError(id);
    // ExternalBusyBlock FK is ON DELETE CASCADE — the imported busy blocks go with
    // the connection, freeing the resource's calendar.
    await tx.calendarConnection.delete({ where: { id } });
  });
}

/** Persist sync bookkeeping (status / lastError / lastSyncedAt / tokens). Only the
 *  provided fields are written. */
export async function updateConnectionSyncState(
  tenantId: string,
  id: string,
  state: ConnectionSyncState
): Promise<void> {
  await withTenant({ tenantId }, (tx) =>
    tx.calendarConnection.update({
      where: { id },
      data: {
        ...(state.status !== undefined ? { status: state.status } : {}),
        ...(state.lastError !== undefined ? { lastError: state.lastError } : {}),
        ...(state.lastSyncedAt !== undefined ? { lastSyncedAt: state.lastSyncedAt } : {}),
        ...(state.syncToken !== undefined ? { syncToken: state.syncToken } : {}),
        ...(state.channelId !== undefined ? { channelId: state.channelId } : {}),
        ...(state.channelExpiresAt !== undefined
          ? { channelExpiresAt: state.channelExpiresAt }
          : {}),
        ...(state.accessTokenEnc !== undefined ? { accessTokenEnc: state.accessTokenEnc } : {}),
        ...(state.refreshTokenEnc !== undefined ? { refreshTokenEnc: state.refreshTokenEnc } : {}),
        ...(state.tokenExpiresAt !== undefined ? { tokenExpiresAt: state.tokenExpiresAt } : {}),
      },
    })
  );
}

/** Replace ALL of a connection's external busy blocks with a fresh set (wholesale
 *  resync). The per-interval `external_event_id` is derived from the span so the
 *  unique (connection_id, external_event_id) index is satisfied. Returns the count
 *  written. Runs in one transaction so availability never sees a half-applied feed. */
export async function replaceExternalBusyBlocks(
  tenantId: string,
  connectionId: string,
  resourceId: string,
  blocks: Interval[]
): Promise<number> {
  return withTenant({ tenantId }, async (tx: TxClient) => {
    await tx.externalBusyBlock.deleteMany({ where: { connectionId } });
    if (blocks.length === 0) return 0;
    // Collapse exact-duplicate spans so the derived event id stays unique.
    const seen = new Set<string>();
    const rows = blocks
      .filter((b) => {
        const key = `${b.start}-${b.end}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return b.end > b.start;
      })
      .map((b) => ({
        tenantId,
        resourceId,
        connectionId,
        externalEventId: `${b.start}-${b.end}`,
        startAt: new Date(b.start),
        endAt: new Date(b.end),
      }));
    await tx.externalBusyBlock.createMany({ data: rows });
    return rows.length;
  });
}
