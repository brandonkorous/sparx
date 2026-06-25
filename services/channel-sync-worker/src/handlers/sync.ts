// Channel sync handlers (docs/106 §4.2). Each handler resolves WHAT changed and
// WHICH connected channels care (querying channel_connections / channel_product_
// mappings + the order source), then dispatches to the registered adapter.
//
// The per-channel API CALL (build the channel payload, resolve the access token
// via Secret Manager, invoke the adapter, persist the mapping / record the error)
// lands with the FIRST adapter in P1 — it is inherently per-channel and only
// testable end-to-end against a real channel API (docs/106 §6). The resolution +
// dispatch structure here does not change. Until an adapter is registered,
// `getChannel` returns undefined and the handlers ack with nothing to push.

import type { Logger } from 'pino';
import { withTenant } from '@sparx/db';
import { getChannel, type ChannelAdapter, type ChannelSlug } from '@sparx/channels';

// A tenant connection paired with its registered adapter.
interface ChannelTarget {
  connectionId: string;
  channel: string;
  externalId: string | null;
  adapter: ChannelAdapter;
}

/** The tenant's active channel connections that have a registered adapter. */
async function resolveTargets(tenantId: string): Promise<ChannelTarget[]> {
  const connections = await withTenant({ tenantId }, (tx) =>
    tx.channelConnection.findMany({
      where: { tenantId, status: 'active' },
      select: { id: true, channel: true, externalId: true },
    })
  );
  const targets: ChannelTarget[] = [];
  for (const conn of connections) {
    const adapter = getChannel(conn.channel as ChannelSlug);
    if (adapter) {
      targets.push({
        connectionId: conn.id,
        channel: conn.channel,
        externalId: conn.externalId,
        adapter,
      });
    }
  }
  return targets;
}

/** product.created / product.updated → push the listing to connected channels. */
export async function handleCatalogSync(
  productId: string,
  tenantId: string,
  log: Logger
): Promise<void> {
  const targets = await resolveTargets(tenantId);
  if (targets.length === 0) {
    log.debug(
      { productId, tenantId },
      'channel-sync: no connected channel with an adapter — skipping'
    );
    return;
  }
  // P1: for each target → build ChannelProductInput (product + variants + sellable
  // qty net of the safety buffer), resolve auth, adapter.pushProduct, then upsert
  // ChannelProductMapping with the returned external ids.
  log.warn(
    { productId, channels: targets.map((t) => t.channel) },
    'channel-sync: catalog push not yet wired for registered adapter (P1)'
  );
}

/** product.deleted → deactivate the product's listings on each channel. */
export async function handleCatalogRemoval(
  productId: string,
  tenantId: string,
  log: Logger
): Promise<void> {
  const mappings = await withTenant({ tenantId }, (tx) =>
    tx.channelProductMapping.findMany({
      where: { tenantId, productId },
      select: { channel: true, externalProductId: true, connection: { select: { status: true } } },
    })
  );
  const listed = mappings.filter((m) => m.externalProductId && m.connection.status === 'active');
  if (listed.length === 0) {
    log.debug({ productId }, 'channel-sync: product not listed on any active channel — skipping');
    return;
  }
  for (const m of listed) {
    const adapter = getChannel(m.channel as ChannelSlug);
    if (!adapter) continue;
    // P1: resolve auth → adapter.removeProduct(auth, externalProductId).
    log.warn(
      { productId, channel: m.channel },
      'channel-sync: catalog removal not yet wired for registered adapter (P1)'
    );
  }
}

/** inventory.adjusted → push the new sellable quantity for the variant's listings. */
export async function handleInventorySync(
  variantId: string,
  tenantId: string,
  log: Logger
): Promise<void> {
  const mappings = await withTenant({ tenantId }, (tx) =>
    tx.channelProductMapping.findMany({
      where: { tenantId, variantId, syncEnabled: true },
      select: {
        channel: true,
        externalSku: true,
        externalVariantId: true,
        connection: { select: { status: true } },
      },
    })
  );
  const active = mappings.filter((m) => m.connection.status === 'active');
  if (active.length === 0) {
    log.debug({ variantId }, 'channel-sync: variant not listed on any active channel — skipping');
    return;
  }
  for (const m of active) {
    const adapter = getChannel(m.channel as ChannelSlug);
    if (!adapter?.pushInventory) continue;
    // P1: resolve auth + sellable qty (inventory ledger, net of the safety buffer)
    // → adapter.pushInventory(auth, { externalSku, availableQuantity }).
    log.warn(
      { variantId, channel: m.channel },
      'channel-sync: inventory push not yet wired for registered adapter (P1)'
    );
  }
}

/** order.fulfilled → push tracking back to the channel a channel-order came from. */
export async function handleFulfillmentSync(
  orderId: string,
  tenantId: string,
  log: Logger
): Promise<void> {
  const order = await withTenant({ tenantId }, (tx) =>
    tx.order.findFirst({
      where: { id: orderId, tenantId },
      select: { id: true, source: true, externalId: true },
    })
  );
  // Only channel-sourced orders carry an externalId — native orders never push.
  if (!order?.source || !order.externalId) {
    log.debug({ orderId }, 'channel-sync: not a channel order — skipping fulfillment push');
    return;
  }
  const adapter = getChannel(order.source as ChannelSlug);
  if (!adapter?.pushFulfillment) {
    log.debug(
      { orderId, channel: order.source },
      'channel-sync: no fulfillment-push adapter for channel — skipping'
    );
    return;
  }
  // P1: resolve auth + the order's tracking → adapter.pushFulfillment(auth, {
  // externalOrderId: order.externalId, trackingNumber, carrier }).
  log.warn(
    { orderId, channel: order.source },
    'channel-sync: fulfillment push not yet wired for registered adapter (P1)'
  );
}
