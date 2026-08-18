// Commerce in-process consumers — the sell-path reactions that don't belong on
// the request that triggered them. Today: cancel restock (docs/100 §2.4, P2 item 3).
//
// Decrement authority is checkout `commit()` (docs/100 §7.4); the only thing left
// to the event stream is the REVERSE — when an order is cancelled, its `sale`
// movements must be undone so the stock comes back. CRM's `orderService.cancel()`
// publishes `order.cancelled` on the platform bus (the same in-process bus the CRM
// stats/activity consumers ride), so we subscribe here and reverse. The reversal
// is idempotent (one `cancel` movement per source `sale`, idempotency-keyed), so a
// redelivered event restocks exactly once.
//
// This lives in @wizeworks/commerce — NOT @wizeworks/crm — so CRM stays inventory-agnostic
// (the seam is owned by the consumer, not the order service). It is installed at
// boot in the API services (api-rest / api-graphql / api-mcp) alongside
// `registerCrmConsumers`, against the same singleton bus.

import { isModuleEnabled } from '@wizeworks/auth';
import { getPlatformBus, type PlatformEvent } from '@wizeworks/crm';
import { inventoryService } from '@wizeworks/inventory';

export interface CommerceConsumerRegistration {
  /** Drops every subscription this bootstrap registered. */
  unregister(): void;
}

export interface RegisterCommerceConsumerOptions {
  /** Override the active bus — tests pass a fresh in-memory bus. */
  bus?: ReturnType<typeof getPlatformBus>;
}

/** Wire the commerce sell-path consumers against the platform bus. Returns a
 *  teardown for clean shutdown (tests). */
export function registerCommerceConsumers(
  opts: RegisterCommerceConsumerOptions = {}
): CommerceConsumerRegistration {
  const bus = opts.bus ?? getPlatformBus();
  const teardowns: (() => void)[] = [];

  // order.cancelled → restock. Gated on the inventory module so a tenant without
  // it spends zero cycles (and has no sale movements to reverse anyway).
  teardowns.push(
    bus.subscribe('order.cancelled', async (event: PlatformEvent) => {
      const orderId = (event.payload as { orderId?: string } | null)?.orderId;
      if (!orderId) return;
      const enabled = await isModuleEnabled(event.tenantId, 'inventory');
      if (!enabled) return;
      try {
        await inventoryService.reverseOrderSale({ tenantId: event.tenantId }, { orderId });
      } catch (err) {
        // Best-effort, mirroring the platform bus's per-subscriber isolation: a
        // restock failure must not block the cancel. Idempotency means a later
        // manual adjust or redelivery still converges.
        console.error('[commerce-consumer]', 'order.cancelled restock failed', { orderId, err });
      }
    })
  );

  return {
    unregister() {
      while (teardowns.length > 0) {
        try {
          teardowns.shift()?.();
        } catch {
          // Best-effort teardown.
        }
      }
    },
  };
}
