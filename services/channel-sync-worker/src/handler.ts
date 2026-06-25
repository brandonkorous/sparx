// Event dispatcher — receives decoded Pub/Sub messages and routes to the channel
// sync handlers based on the event type (docs/106 §4.2). The worker subscribes to
// EXISTING commerce events (no new channel.* topics yet); the handlers fan a
// change out to every channel the tenant has connected + has a registered adapter.

import type { Logger } from 'pino';
import type { SparxEvent } from '@sparx/events';
import {
  handleCatalogSync,
  handleCatalogRemoval,
  handleInventorySync,
  handleFulfillmentSync,
} from './handlers/sync.js';

export interface PubSubMessage {
  data?: string;
  attributes?: Record<string, string>;
  messageId: string;
  publishTime: string;
}

export function parseEvent(message: PubSubMessage): SparxEvent<unknown> | null {
  if (!message.data) return null;
  try {
    const raw = JSON.parse(Buffer.from(message.data, 'base64').toString('utf8')) as Record<
      string,
      unknown
    >;
    if (typeof raw !== 'object' || !raw?.type || !raw?.tenantId) return null;
    return raw as unknown as SparxEvent<unknown>;
  } catch {
    return null;
  }
}

export async function handle(event: SparxEvent<unknown>, log: Logger): Promise<void> {
  const { type, tenantId, data } = event;

  switch (type) {
    // Catalog out — a product changed, push the listing to connected channels.
    case 'product.created':
    case 'product.updated':
      await handleCatalogSync((data as { productId: string }).productId, tenantId, log);
      break;

    // Catalog out — a product was removed, deactivate its channel listings.
    case 'product.deleted':
      await handleCatalogRemoval((data as { productId: string }).productId, tenantId, log);
      break;

    // Inventory out — stock moved, push the new sellable quantity to channels.
    case 'inventory.adjusted':
      await handleInventorySync((data as { variantId: string }).variantId, tenantId, log);
      break;

    // Fulfillment out — a channel-sourced order shipped, push tracking back.
    case 'order.fulfilled':
      await handleFulfillmentSync((data as { orderId: string }).orderId, tenantId, log);
      break;

    default:
      log.debug({ type }, 'channel-sync-worker: unhandled event type — acking');
  }
}
