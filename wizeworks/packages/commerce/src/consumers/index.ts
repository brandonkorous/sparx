// Commerce in-process consumers — the sell-path reactions that don't belong on
// the request that triggered them. Today: cancel restock (docs/100 §2.4, P2 item 3),
// and giving back the sale code an undone order spent.
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

import { releaseOrderDiscountUsage } from '../services/discount-service';

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

  // order.cancelled / order.refunded → give the sale code back. Both topics, one
  // handler, because the rule is about the ORDER's settled status rather than which
  // way it was undone, and `releaseOrderDiscountUsage` reads that itself — a partial
  // refund never reaches `refunded`, so it keeps its usage and nothing here has to
  // know the difference.
  //
  // Here rather than in CRM's order service for the same reason the restock above
  // is: the seam belongs to the consumer, so CRM stays discount-agnostic. Running
  // after the commit only ever means the shopper gets their code back a moment
  // late, which is the harmless direction.
  for (const topic of ['order.cancelled', 'order.refunded'] as const) {
    teardowns.push(
      bus.subscribe(topic, async (event: PlatformEvent) => {
        const orderId = (event.payload as { orderId?: string } | null)?.orderId;
        if (!orderId) return;
        try {
          await releaseOrderDiscountUsage({ tenantId: event.tenantId }, { orderId });
        } catch (err) {
          console.error('[commerce-consumer]', `${topic} discount release failed`, {
            orderId,
            err,
          });
        }
      })
    );
  }

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
