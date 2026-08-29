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

import { withTenant, type TxClient } from '@wizeworks/db';

import type { ConsumerContext } from './registry';
import { gateHandler } from './registry';

/**
 * How an order is NAMED in a sentence somebody reads.
 *
 * The event carried an id and no number, and the id was going straight into the
 * description — so a customer's history said "Order
 * bb3df3ee-36a5-4cc6-8457-fe67e3ba4048 placed" directly above the same order
 * listed as O-000001 (persona issue 288). An id is the one thing an owner can do
 * nothing with: not searchable, not readable aloud, not on the receipt.
 *
 * That was fixed by reading the number back out of the database HERE, which
 * replaced a wrong name with no name at all (issue 307): checkout composes the
 * order write into its own transaction, so when this consumer ran the order was
 * not visible to it yet, the lookup returned null, and four of five orders on
 * one shop appeared in a customer's history as "An order was placed ($276.00)".
 * Identical rows, differing only by amount, for the question "which of these did
 * she return?".
 *
 * **The number now travels in the payload**, put there by the producer that
 * already holds it, and the announcement waits for the commit (see
 * `afterCommit`). This lookup remains as a fallback for events published before
 * that change and for any producer that does not carry it, and it is the only
 * path that can still come back empty.
 */
async function orderNumberFor(tx: TxClient, orderId: string): Promise<string | null> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { orderNumber: true },
  });
  return order?.orderNumber ?? null;
}

/**
 * The order's name for the sentence: payload first, database second, and a loud
 * complaint if neither has it.
 *
 * A description is RENDERED ONCE AND STORED, so a sentence written without the
 * number is wrong for ever — there is no later read that could repair it. That
 * is what made the silent fallback a defect rather than a hiccup, and it is why
 * failing to resolve one has to reach the log instead of quietly producing a
 * vaguer sentence nobody knows is vaguer.
 */
async function nameOf(
  tx: TxClient,
  tenantId: string,
  payload: { orderId: string; orderNumber?: string }
): Promise<string | null> {
  if (payload.orderNumber) return payload.orderNumber;
  const found = await orderNumberFor(tx, payload.orderId);
  if (!found) {
    console.error('[crm-consumer] order has no number to write into its activity', {
      tenantId,
      orderId: payload.orderId,
      why: 'absent from the payload and not visible in the database — is the producer publishing before its transaction commits?',
    });
  }
  return found;
}

interface OrderCreatedPayload {
  orderId: string;
  /** Optional only for events published before it was added. Every producer in
   *  the tree now sends it. */
  orderNumber?: string;
  customerId: string;
  total: number;
  currency: string;
  placedAt: string; // ISO
}

interface OrderLifecyclePayload {
  orderId: string;
  orderNumber?: string;
  /** Was absent from `order.fulfilled` and `order.delivered` altogether, so
   *  every shipped and delivered row was written against NOBODY — six of them on
   *  the shop this was found on, in no customer's history and reachable from
   *  nowhere. Still optional in the type because the bus can hold an event
   *  published before the producers carried it; the handler refuses to write an
   *  orphan rather than trusting it. */
  customerId?: string;
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
          const number = await nameOf(tx, event.tenantId, payload);
          const money = formatMoney(payload.total, payload.currency);
          // Append the activity (idempotent via unique on
          // (tenant_id, type, linked_entity_id, occurred_at) — see Phase 2
          // schema follow-up).
          await tx.crmActivity.create({
            data: {
              tenantId: event.tenantId,
              customerId: payload.customerId,
              type: 'order.placed',
              description: number
                ? `Order ${number} placed (${money})`
                : `An order was placed (${money})`,
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
        // Same refusal as the lifecycle rows: money going back out is the last
        // thing that should be recorded against nobody.
        if (!payload.customerId) {
          console.error('[crm-consumer] refund names no customer — no row written', {
            tenantId: event.tenantId,
            orderId: payload.orderId,
          });
          return;
        }
        const customerId = payload.customerId;
        await withTenant({ tenantId: event.tenantId }, async (tx) => {
          const number = await nameOf(tx, event.tenantId, payload);
          const money = formatMoney(payload.refundAmount, payload.currency);
          await tx.crmActivity.create({
            data: {
              tenantId: event.tenantId,
              customerId,
              type: 'order.refunded',
              description: number
                ? `Order ${number} refunded (${money})`
                : `An order was refunded (${money})`,
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

/** What each lifecycle step is called in a sentence, once the order has a name.
 *  Kept beside the types rather than in the UI: this text is WRITTEN INTO the
 *  row, so every reader of the timeline — console, export, API — gets the same
 *  words without each one having to invent them. */
const LIFECYCLE_VERB: Record<'order.shipped' | 'order.delivered' | 'order.cancelled', string> = {
  'order.shipped': 'shipped',
  'order.delivered': 'delivered',
  'order.cancelled': 'cancelled',
};

/**
 * The shipped / delivered / cancelled row on a customer's timeline.
 *
 * Two things were wrong with it and they compounded:
 *
 * 1. It wrote `customerId: payload.customerId` for events that carried no
 *    `customerId` at all, and the column is nullable — so the row was created
 *    against NOBODY. Every shipped and delivered activity on the shop this was
 *    found on (six of them) sits in the table belonging to no customer, which
 *    means no history has ever shown that an order went out or arrived. Nothing
 *    failed; the write succeeded, and an orphan looks exactly like a record.
 *
 * 2. It wrote `description: null`, so even a row that DID find its customer said
 *    only "Shipped" with no order named — beside "Order O-000008 placed", which
 *    names one.
 *
 * A row with no customer is now REFUSED and logged. It could never be read, so
 * writing it buys nothing and costs the one signal that something is wrong.
 */
async function recordLifecycleActivity(
  tenantId: string,
  payload: OrderLifecyclePayload,
  type: 'order.shipped' | 'order.delivered' | 'order.cancelled'
): Promise<void> {
  const occurredAt = payload.occurredAt ? new Date(payload.occurredAt) : new Date();

  if (!payload.customerId) {
    console.error('[crm-consumer] order lifecycle event names no customer — no row written', {
      tenantId,
      type,
      orderId: payload.orderId,
      why: 'the row would belong to nobody and appear in no history; the producer must send customerId',
    });
    return;
  }
  const customerId = payload.customerId;

  await withTenant({ tenantId }, async (tx) => {
    const number = await nameOf(tx, tenantId, payload);
    await tx.crmActivity.create({
      data: {
        tenantId,
        customerId,
        type,
        description: number
          ? `Order ${number} ${LIFECYCLE_VERB[type]}`
          : `An order was ${LIFECYCLE_VERB[type]}`,
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
