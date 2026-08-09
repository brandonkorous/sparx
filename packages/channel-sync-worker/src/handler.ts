// Event dispatcher — routes a decoded event to the channel sync handlers by
// type (docs/106 §4.2). This subscribes to EXISTING commerce events (no new
// channel.* topics yet); the handlers fan a change out to every channel the
// tenant has connected + has a registered adapter.

import type { Logger } from 'pino';
import type { SparxEvent } from '@sparx/events';
import {
  handleCatalogSync,
  handleCatalogRemoval,
  handleInventorySync,
  handleFulfillmentSync,
} from './handlers/sync.js';

/**
 * Structural check on a decoded event.
 *
 * This used to take a Pub/Sub PUSH message and base64-decode its `data` field.
 * There is no push sender any more (see services/event-worker/src/http.ts), so
 * the envelope is gone and the parameter is the event itself. The `type` +
 * `tenantId` check it always did is unchanged.
 */
export function parseEvent(raw: unknown): SparxEvent<unknown> | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const e = raw as Record<string, unknown>;
  if (!e.type || !e.tenantId) return null;
  return e as unknown as SparxEvent<unknown>;
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
