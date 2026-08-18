// Event dispatcher — routes a decoded event to the correct handler by type.

import type { Logger } from 'pino';
import type { SparxEvent } from '@wizeworks/events';
import { handleSyncStarted } from './handlers/sync.js';
import { handleOrderRoute } from './handlers/route.js';

/**
 * Structural check on a decoded event.
 *
 * This used to take a Pub/Sub PUSH message and base64-decode its `data` field.
 * There is no push sender any more (see wizeworks/services/event-worker/src/http.ts), so
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
    case 'dropship.supplier.sync_started':
      await handleSyncStarted(data as { supplierId: string; type: string }, tenantId, log);
      break;

    // order.placed is the normal trigger (docs/14): an order carrying dropship
    // line items gets routed to its suppliers as soon as it's placed — checkout
    // has already collected payment synchronously by this point (Stripe Payment
    // Element), so order.placed is the right signal, not order.paid (which only
    // fires for async/offline payment paths like B2B net terms). dropship.order
    // .route remains for manual/admin re-trigger. handleOrderRoute() is itself
    // idempotent (skips a supplier that already has a dropshipOrder row for
    // this order), so a redundant delivery of either event is harmless.
    case 'dropship.order.route':
    case 'order.placed':
      await handleOrderRoute(data as { orderId: string }, tenantId, log);
      break;

    default:
      log.debug({ type }, 'dropship-worker: unhandled event type — acking');
  }
}
