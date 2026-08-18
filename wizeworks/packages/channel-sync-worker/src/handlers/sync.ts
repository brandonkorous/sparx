// Channel sync handlers (docs/106 §4.2). Each handler resolves WHAT changed and
// WHICH connected channels care (querying channel_connections / channel_product_
// mappings + the order source), resolves the channel's access token, and dispatches
// to the registered adapter — then persists the resulting external-id mapping or
// records the failure. The adapters are pure I/O; every DB write lives here.

import type { Logger } from 'pino';
import { withTenant } from '@wizeworks/db';
import {
  getChannel,
  type ChannelAdapter,
  type ChannelProductRef,
  type ChannelSlug,
} from '@wizeworks/channels';
import { buildChannelProduct, sellableForVariant } from '../lib/projection.js';
import { resolveChannelAuth, type ConnectionTokenRow } from '../lib/auth.js';

const msg = (err: unknown): string => (err instanceof Error ? err.message : String(err));

// A tenant connection (with its token material) paired with its registered adapter.
interface ChannelTarget extends ConnectionTokenRow {
  channel: string;
  adapter: ChannelAdapter;
}

/** The tenant's active channel connections that have a registered adapter. */
async function resolveTargets(tenantId: string): Promise<ChannelTarget[]> {
  const connections = await withTenant({ tenantId }, (tx) =>
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
  const targets: ChannelTarget[] = [];
  for (const conn of connections) {
    const adapter = getChannel(conn.channel as ChannelSlug);
    if (adapter) targets.push({ ...conn, adapter });
  }
  return targets;
}

/** Upsert one mapping row per pushed variant with the channel's returned ids. */
async function persistMappings(
  tenantId: string,
  connectionId: string,
  channel: string,
  productId: string,
  ref: ChannelProductRef
): Promise<void> {
  const now = new Date();
  await withTenant({ tenantId }, async (tx) => {
    for (const v of ref.variants) {
      const external = {
        externalProductId: ref.externalProductId,
        externalVariantId: v.externalVariantId ?? null,
        externalSku: v.externalSku ?? null,
        lastSyncedAt: now,
        syncError: null,
      };
      await tx.channelProductMapping.upsert({
        where: { connectionId_variantId: { connectionId, variantId: v.variantId } },
        create: { tenantId, connectionId, channel, productId, variantId: v.variantId, ...external },
        update: external,
      });
    }
  });
}

/** The order's latest fulfillment that carries a tracking number — a fulfillment can
 *  be recorded before tracking is attached, so we push the most recent tracked one. */
function latestTrackedFulfillment(tenantId: string, orderId: string) {
  return withTenant({ tenantId }, (tx) =>
    tx.orderFulfillment.findFirst({
      where: { orderId, trackingNumber: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { trackingNumber: true, carrier: true, trackingUrl: true },
    })
  );
}

async function markConnectionSynced(tenantId: string, connectionId: string): Promise<void> {
  await withTenant({ tenantId }, (tx) =>
    tx.channelConnection.update({ where: { id: connectionId }, data: { lastSyncedAt: new Date() } })
  );
}

/** Append a failure to the connection's rolling error trail (capped at 10). */
async function recordConnectionError(
  tenantId: string,
  connectionId: string,
  message: string
): Promise<void> {
  await withTenant({ tenantId }, async (tx) => {
    const conn = await tx.channelConnection.findUnique({
      where: { id: connectionId },
      select: { syncErrors: true },
    });
    const prev = Array.isArray(conn?.syncErrors) ? conn.syncErrors : [];
    const next = [{ at: new Date().toISOString(), message }, ...prev].slice(0, 10);
    await tx.channelConnection.update({
      where: { id: connectionId },
      data: { syncErrors: next },
    });
  });
}

/** product.created / product.updated → push the listing to connected channels. */
export async function handleCatalogSync(
  productId: string,
  tenantId: string,
  log: Logger
): Promise<void> {
  const targets = await resolveTargets(tenantId);
  if (targets.length === 0) {
    log.debug({ productId }, 'channel-sync: no connected channel with an adapter — skipping');
    return;
  }
  const product = await buildChannelProduct(tenantId, productId, log);
  if (!product) return; // projection logged the reason (deleted / no url / no variants)

  for (const t of targets) {
    const auth = await resolveChannelAuth(tenantId, t, t.adapter, log);
    if (!auth) continue;
    try {
      const ref = await t.adapter.pushProduct(auth, product);
      await persistMappings(tenantId, t.id, t.channel, productId, ref);
      await markConnectionSynced(tenantId, t.id);
      log.info(
        { productId, channel: t.channel, variants: ref.variants.length },
        'channel-sync: pushed product'
      );
    } catch (err) {
      await recordConnectionError(tenantId, t.id, msg(err));
      log.error(
        { productId, channel: t.channel, err: msg(err) },
        'channel-sync: product push failed'
      );
    }
  }
}

/** product.deleted → deactivate the product's listings on each channel. */
export async function handleCatalogRemoval(
  productId: string,
  tenantId: string,
  log: Logger
): Promise<void> {
  const targets = await resolveTargets(tenantId);
  if (targets.length === 0) return;
  const byChannel = new Map(targets.map((t) => [t.channel, t]));

  const mappings = await withTenant({ tenantId }, (tx) =>
    tx.channelProductMapping.findMany({
      where: { tenantId, productId },
      select: { id: true, channel: true, externalVariantId: true, externalProductId: true },
    })
  );
  if (mappings.length === 0) {
    log.debug({ productId }, 'channel-sync: product not listed on any channel — skipping');
    return;
  }

  for (const m of mappings) {
    const target = byChannel.get(m.channel);
    // The per-variant external id is what the channel deletes by (the Google
    // product id / Meta+Pinterest retailer_id); fall back to the product id.
    const externalId = m.externalVariantId ?? m.externalProductId;
    if (!target || !externalId) continue;
    const auth = await resolveChannelAuth(tenantId, target, target.adapter, log);
    if (!auth) continue;
    try {
      await target.adapter.removeProduct(auth, externalId);
      await withTenant({ tenantId }, (tx) =>
        tx.channelProductMapping.delete({ where: { id: m.id } })
      );
      log.info({ productId, channel: m.channel }, 'channel-sync: removed listing');
    } catch (err) {
      await recordConnectionError(tenantId, target.id, msg(err));
      log.error(
        { productId, channel: m.channel, err: msg(err) },
        'channel-sync: listing removal failed'
      );
    }
  }
}

/** inventory.adjusted → push the new sellable quantity for the variant's listings. */
export async function handleInventorySync(
  variantId: string,
  tenantId: string,
  log: Logger
): Promise<void> {
  const targets = await resolveTargets(tenantId);
  if (targets.length === 0) return;
  const byChannel = new Map(targets.map((t) => [t.channel, t]));

  const mappings = await withTenant({ tenantId }, (tx) =>
    tx.channelProductMapping.findMany({
      where: { tenantId, variantId, syncEnabled: true },
      select: {
        channel: true,
        externalSku: true,
        externalVariantId: true,
        externalProductId: true,
      },
    })
  );
  if (mappings.length === 0) {
    log.debug({ variantId }, 'channel-sync: variant not listed on any channel — skipping');
    return;
  }

  const qty = await sellableForVariant(tenantId, variantId);
  const availableQuantity = qty ?? 1; // untracked → in stock

  for (const m of mappings) {
    const target = byChannel.get(m.channel);
    if (!target?.adapter.pushInventory || !m.externalSku) continue;
    const auth = await resolveChannelAuth(tenantId, target, target.adapter, log);
    if (!auth) continue;
    try {
      await target.adapter.pushInventory(auth, {
        externalSku: m.externalSku,
        externalVariantId: m.externalVariantId ?? undefined,
        externalProductId: m.externalProductId ?? undefined,
        availableQuantity,
      });
      log.info(
        { variantId, channel: m.channel, availableQuantity },
        'channel-sync: pushed inventory'
      );
    } catch (err) {
      await recordConnectionError(tenantId, target.id, msg(err));
      log.error(
        { variantId, channel: m.channel, err: msg(err) },
        'channel-sync: inventory push failed'
      );
    }
  }
}

/** order.fulfilled → push tracking back to the channel a channel-order came from.
 *
 * Feed channels (Google/Meta/Pinterest) carry no orders, so their adapters omit
 * `pushFulfillment` and this is a correct no-op for them. Order channels (TikTok, …)
 * push the order's latest tracked shipment back so the marketplace marks it shipped. */
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

  const targets = await resolveTargets(tenantId);
  const target = targets.find((t) => t.channel === order.source);
  if (!target?.adapter.pushFulfillment) {
    log.debug(
      { orderId, channel: order.source },
      'channel-sync: channel has no fulfillment push (feed channel / not connected) — skipping'
    );
    return;
  }

  const fulfillment = await latestTrackedFulfillment(tenantId, orderId);
  if (!fulfillment?.trackingNumber) {
    log.debug(
      { orderId, channel: order.source },
      'channel-sync: order fulfilled without tracking yet — skipping push'
    );
    return;
  }

  const auth = await resolveChannelAuth(tenantId, target, target.adapter, log);
  if (!auth) return;
  try {
    await target.adapter.pushFulfillment(auth, {
      externalOrderId: order.externalId,
      trackingNumber: fulfillment.trackingNumber,
      // The adapter maps our carrier code → the channel's provider id (best-effort).
      carrier: fulfillment.carrier ?? '',
      trackingUrl: fulfillment.trackingUrl ?? undefined,
    });
    await markConnectionSynced(tenantId, target.id);
    log.info({ orderId, channel: order.source }, 'channel-sync: pushed fulfillment tracking');
  } catch (err) {
    await recordConnectionError(tenantId, target.id, msg(err));
    log.error(
      { orderId, channel: order.source, err: msg(err) },
      'channel-sync: fulfillment push failed'
    );
  }
}
