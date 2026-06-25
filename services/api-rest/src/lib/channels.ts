// Channel connection management (docs/106). Thin DB orchestration over
// channel_connections / channel_product_mappings — the OAuth dance + per-channel
// sync live in the adapters (@sparx/channels) and the channel-sync-worker; this
// is the dashboard's read/disconnect surface. Mirrors how dropship keeps its DB
// orchestration in api-rest rather than the pure-contract package.

import { withTenant } from '@sparx/db';
import type { ChannelContext } from './channel-context.js';

export interface ChannelConnectionView {
  id: string;
  channel: string;
  status: string;
  shopName: string | null;
  externalId: string | null;
  lastSyncedAt: string | null;
  connectedAt: string;
  mappingCount: number;
}

/** The tenant's channel connections, newest activity surfaced for the manage UI. */
export async function listChannelConnections(
  ctx: ChannelContext
): Promise<ChannelConnectionView[]> {
  const rows = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.channelConnection.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { mappings: true } } },
    })
  );
  return rows.map((r) => ({
    id: r.id,
    channel: r.channel,
    status: r.status,
    shopName: r.shopName,
    externalId: r.externalId,
    lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
    connectedAt: r.createdAt.toISOString(),
    mappingCount: r._count.mappings,
  }));
}

/** Remove a channel connection; its product mappings cascade (DB FK). */
export async function disconnectChannel(ctx: ChannelContext, channel: string): Promise<void> {
  await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.channelConnection.deleteMany({ where: { tenantId: ctx.tenantId, channel } })
  );
}
