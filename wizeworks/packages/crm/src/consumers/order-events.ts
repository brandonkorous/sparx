// Order-lifecycle consumers — the customer's TIMELINE, and nothing else.
//
// One job: append an activity row so an order shows up in the customer's
// history. Best-effort by nature, because the bus catches a failing handler and
// logs it; a missing timeline entry is a gap in a story, and recoverable.
//
// It used to have a second job — maintaining `total_spent`, `order_count`,
// `first_order_at` and `last_order_at` by increment — and that job is not
// best-effort. Those are money, they are read as fact, and a lost event
// corrupted them permanently and invisibly. They moved into the order write
// path, derived rather than nudged: services/customer-rollup.ts.
//
// The payload shape comes from docs/06 §8.

import { withTenant } from '@wizeworks/db';

import type { ConsumerContext } from './registry';
import { gateHandler } from './registry';

interface OrderCreatedPayload {
  orderId: string;
  customerId: string;
  total: number;
  currency: string;
  placedAt: string; // ISO
}

interface OrderLifecyclePayload {
  orderId: string;
  customerId: string;
  occurredAt?: string;
}

interface OrderRefundedPayload extends OrderLifecyclePayload {
  refundAmount: number;
  currency: string;
}

const TOPICS = [
  'order.created',
  'order.fulfilled',
  'order.delivered',
  'order.cancelled',
  'order.refunded',
] as const;

export function registerOrderEventConsumers(ctx: ConsumerContext): (() => void)[] {
  return [
    ctx.bus.subscribe(
      'order.created',
      gateHandler(async (event) => {
        const payload = event.payload as OrderCreatedPayload;
        const occurredAt = new Date(payload.placedAt);

        await withTenant({ tenantId: event.tenantId }, async (tx) => {
          // Append the activity (idempotent via unique on
          // (tenant_id, type, linked_entity_id, occurred_at) — see Phase 2
          // schema follow-up).
          await tx.crmActivity.create({
            data: {
              tenantId: event.tenantId,
              customerId: payload.customerId,
              type: 'order.placed',
              description: `Order ${payload.orderId} placed (${formatMoney(payload.total, payload.currency)})`,
              actorId: payload.customerId,
              actorType: 'customer',
              occurredAt,
              linkedEntityType: 'Order',
              linkedEntityId: payload.orderId,
              metadata: {
                orderId: payload.orderId,
                total: payload.total,
                currency: payload.currency,
              },
            },
          });

          // The customer's commerce figures are NOT written here any more.
          //
          // They were, as `{ increment: payload.total }` plus a matching
          // decrement on refund, and an increment is only ever as reliable as
          // its delivery. Three of five orders on one shop never reached the
          // buyer's record — the failure was swallowed by the bus's own catch —
          // and because the refund half kept working, one customer's lifetime
          // spend rendered as -$42.00. They are now derived from the orders
          // inside the same transaction that writes the order (see
          // services/customer-rollup.ts), which cannot be lost or double-applied.
        });
      })
    ),

    ctx.bus.subscribe(
      'order.fulfilled',
      gateHandler(async (event) => {
        await recordLifecycleActivity(
          event.tenantId,
          event.payload as OrderLifecyclePayload,
          'order.shipped'
        );
      })
    ),

    ctx.bus.subscribe(
      'order.delivered',
      gateHandler(async (event) => {
        await recordLifecycleActivity(
          event.tenantId,
          event.payload as OrderLifecyclePayload,
          'order.delivered'
        );
      })
    ),

    ctx.bus.subscribe(
      'order.cancelled',
      gateHandler(async (event) => {
        await recordLifecycleActivity(
          event.tenantId,
          event.payload as OrderLifecyclePayload,
          'order.cancelled'
        );
      })
    ),

    ctx.bus.subscribe(
      'order.refunded',
      gateHandler(async (event) => {
        const payload = event.payload as OrderRefundedPayload;
        const occurredAt = payload.occurredAt ? new Date(payload.occurredAt) : new Date();
        await withTenant({ tenantId: event.tenantId }, async (tx) => {
          await tx.crmActivity.create({
            data: {
              tenantId: event.tenantId,
              customerId: payload.customerId,
              type: 'order.refunded',
              description: `Order ${payload.orderId} refunded (${formatMoney(payload.refundAmount, payload.currency)})`,
              actorId: null,
              actorType: 'system',
              occurredAt,
              linkedEntityType: 'Order',
              linkedEntityId: payload.orderId,
              metadata: {
                orderId: payload.orderId,
                refundAmount: payload.refundAmount,
                currency: payload.currency,
              },
            },
          });
          // No decrement here either — see the note on order.created above.
          // This one is why the rule matters: the decrement kept firing after
          // its matching increment had been lost, and drove a lifetime spend
          // below zero.
        });
      })
    ),
  ];
}

async function recordLifecycleActivity(
  tenantId: string,
  payload: OrderLifecyclePayload,
  type: 'order.shipped' | 'order.delivered' | 'order.cancelled'
): Promise<void> {
  const occurredAt = payload.occurredAt ? new Date(payload.occurredAt) : new Date();
  await withTenant({ tenantId }, async (tx) => {
    await tx.crmActivity.create({
      data: {
        tenantId,
        customerId: payload.customerId,
        type,
        description: null,
        actorId: null,
        actorType: 'system',
        occurredAt,
        linkedEntityType: 'Order',
        linkedEntityId: payload.orderId,
        metadata: { orderId: payload.orderId },
      },
    });
  });
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export const ORDER_CONSUMER_TOPICS = TOPICS;
export type OrderCreatedEventPayload = OrderCreatedPayload;
