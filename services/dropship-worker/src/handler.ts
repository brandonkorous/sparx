// Event dispatcher — receives decoded Pub/Sub messages and routes to the
// correct handler based on the event type.

import type { Logger } from 'pino';
import type { SparxEvent } from '@sparx/events';
import { handleSyncStarted } from './handlers/sync.js';
import { handleOrderRoute } from './handlers/route.js';

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
