// Polling ingest for order channels WITHOUT reliable order webhooks — Etsy, Walmart,
// eBay (Faire as a backup to its webhook). The webhook path (docs/106 §4.4) covers
// push-style channels; this covers pull-style ones. A k8s CronJob hits
// POST /internal/channels/poll on a schedule; for each active connection whose
// adapter implements `fetchOrders`, we pull orders since the connection's cursor and
// ingest each through the SAME idempotent commit as the webhook (`ingestChannelOrder`),
// then advance the cursor. The deterministic order number per externalId makes the
// re-poll overlap window safe — a boundary order seen twice commits once.

import { withTenant } from '@wizeworks/db';
import type { Prisma } from '@wizeworks/db';
import { getChannel, type ChannelSlug } from '@wizeworks/channels';
import { ingestChannelOrder } from '@wizeworks/commerce';
import { resolveConnectionAuth, type ChannelConnectionAuthRow } from './channels.js';

// First poll (no cursor yet) looks back this far — bounded so connecting a shop
// doesn't ingest its entire order history. Later polls advance from the cursor.
const FIRST_POLL_LOOKBACK_MS = 24 * 60 * 60 * 1000;
// Re-poll a small window before the cursor so an order created right at the boundary
// isn't missed; the idempotent commit dedupes the overlap.
const POLL_OVERLAP_MS = 5 * 60 * 1000;
// Cap the rolling per-connection error trail (mirrors the worker).
const MAX_SYNC_ERRORS = 10;

interface PollableConnection extends ChannelConnectionAuthRow {
  channel: string;
}

export interface ChannelPollResult {
  connections: number;
  ingested: number;
  deduped: number;
  errors: number;
}

/** Active connections whose channel adapter can be polled for orders (implements
 *  `fetchOrders`). Webhook-only channels (TikTok) are skipped here. */
async function listPollableConnections(tenantId: string): Promise<PollableConnection[]> {
  const rows = await withTenant({ tenantId }, (tx) =>
    tx.channelConnection.findMany({
      where: { tenantId, status: 'active' },
      select: {
        id: true,
        channel: true,
        externalId: true,
        accessTokenEnc: true,
        refreshTokenEnc: true,
        tokenExpiresAt: true,
        metadata: true,
      },
    })
  );
  return rows.filter((r) => !!getChannel(r.channel as ChannelSlug)?.fetchOrders);
}

/** The connection's last poll cursor (ISO), persisted on its metadata, or null. */
function readCursor(metadata: Prisma.JsonValue): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const raw = (metadata as Record<string, unknown>).lastOrderPolledAt;
  return typeof raw === 'string' ? raw : null;
}

/** Merge the new cursor into the metadata WITHOUT dropping `channelParams` (which
 *  carries channel-specific auth params the adapter needs on every call). */
function withCursor(metadata: Prisma.JsonValue, cursorIso: string): Prisma.InputJsonValue {
  const base =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  return { ...base, lastOrderPolledAt: cursorIso };
}

/** Append a failure to the connection's rolling error trail (newest first, capped). */
async function recordError(tenantId: string, connectionId: string, message: string): Promise<void> {
  await withTenant({ tenantId }, async (tx) => {
    const conn = await tx.channelConnection.findUnique({
      where: { id: connectionId },
      select: { syncErrors: true },
    });
    const prev = Array.isArray(conn?.syncErrors) ? conn.syncErrors : [];
    const next = [{ at: new Date().toISOString(), message }, ...prev].slice(0, MAX_SYNC_ERRORS);
    await tx.channelConnection.update({
      where: { id: connectionId },
      data: { syncErrors: next },
    });
  });
}

/** Poll + ingest channel orders for ONE connection, then advance the cursor. A
 *  mid-batch failure throws BEFORE the cursor advances, so the next tick re-pulls the
 *  window (idempotent ingest makes that safe). */
async function pollConnection(
  tenantId: string,
  conn: PollableConnection,
  acc: ChannelPollResult
): Promise<void> {
  const adapter = getChannel(conn.channel as ChannelSlug);
  if (!adapter?.fetchOrders) return;
  const auth = await resolveConnectionAuth(tenantId, conn, adapter);
  if (!auth) return;

  const pollStartedAt = Date.now();
  const cursor = readCursor(conn.metadata);
  const since = cursor
    ? new Date(new Date(cursor).getTime() - POLL_OVERLAP_MS).toISOString()
    : new Date(pollStartedAt - FIRST_POLL_LOOKBACK_MS).toISOString();

  const orders = await adapter.fetchOrders(auth, { since });
  for (const order of orders) {
    const result = await ingestChannelOrder(
      { tenantId },
      {
        channel: conn.channel,
        externalId: order.externalId,
        externalStatus: order.externalStatus,
        placedAt: order.placedAt,
        currency: order.currency,
        customer: order.customer,
        shippingAddress: order.shippingAddress,
        lines: order.lines.map((l) => ({
          externalSku: l.externalSku,
          externalVariantId: l.externalVariantId,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
        })),
        channelFeeCents: order.channelFeeCents,
      }
    );
    if (result.deduped) acc.deduped += 1;
    else acc.ingested += 1;
  }

  // Cursor advances to the poll START (the overlap covers boundary orders); stamp
  // lastSyncedAt so the dashboard shows a heartbeat.
  await withTenant({ tenantId }, (tx) =>
    tx.channelConnection.update({
      where: { id: conn.id },
      data: {
        metadata: withCursor(conn.metadata, new Date(pollStartedAt).toISOString()),
        lastSyncedAt: new Date(),
      },
    })
  );
}

/** Poll every pollable connection for one tenant. Per-connection failures are
 *  isolated + recorded so one bad channel doesn't stall the rest. */
export async function pollTenantChannelOrders(tenantId: string): Promise<ChannelPollResult> {
  const acc: ChannelPollResult = { connections: 0, ingested: 0, deduped: 0, errors: 0 };
  const connections = await listPollableConnections(tenantId);
  for (const conn of connections) {
    acc.connections += 1;
    try {
      await pollConnection(tenantId, conn, acc);
    } catch (err) {
      acc.errors += 1;
      await recordError(tenantId, conn.id, err instanceof Error ? err.message : String(err));
    }
  }
  return acc;
}
