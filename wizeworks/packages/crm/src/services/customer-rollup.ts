// A customer's commerce figures, DERIVED — never nudged.
//
// `total_spent`, `order_count`, `first_order_at` and `last_order_at` are a
// summary of that customer's orders, and this recomputes all four from the
// orders themselves. It is deliberately not an increment.
//
// ── What increments cost ─────────────────────────────────────────────────────
//
// They were maintained by the `order.created` consumer with
// `{ increment: payload.total }` and by `order.refunded` with a matching
// decrement. Three properties made that unsafe, and all three showed up in one
// afternoon on one small shop:
//
//   Lost. A consumer whose transaction failed was swallowed by the bus's own
//   per-handler catch, so three of five orders never reached the buyer's record.
//   Two customers who had paid read "Total spent $0.00" and there was no way to
//   tell from the row that anything was missing.
//
//   Signed. The refund half kept working while the increment half did not, so a
//   customer's LIFETIME SPEND rendered as **-$42.00** — a number that cannot
//   happen and that no reader can interpret.
//
//   Unrepairable. Nothing recomputes, so a single lost event is permanent. The
//   column drifts from the orders it summarises and nothing detects it.
//
// Derived removes all three at once: a lost event is healed by the next write, a
// duplicated event is a no-op, and the figure can never disagree with the orders
// on the same screen. See persona issue 232.
//
// ── Why it runs in the caller's transaction ──────────────────────────────────
//
// It is called from inside the same `withTenant` that writes the order, the
// payment, the refund or the cancellation. That is the point: the summary
// commits with the thing it summarises, or neither commits. An event consumer
// cannot offer that, which is what made the old arrangement losable.
//
// ── What "total spent" means ─────────────────────────────────────────────────
//
// Money the customer has actually handed over, net of anything given back —
// `Order.amountPaid`, which the refund path already writes net (a $170 order
// refunded $42 carries `amountPaid` 128.00). NOT the value of orders placed.
//
// The old code meant both at once: it incremented by the order TOTAL the moment
// an order was placed, whether or not a penny had been taken, and then
// decremented by refunds — a subtraction that only makes sense against money
// received. A shop owner reading a column headed "Total spent" is asking what
// this person has paid them, so that is what it answers, and an unpaid order now
// correctly contributes nothing until it is paid.

import type { TxClient } from '@wizeworks/db';

/** Orders that never happened do not count toward anything. */
const COUNTED = { not: 'cancelled' } as const;

export interface CustomerCommerceRollup {
  totalSpent: string;
  orderCount: number;
  firstOrderAt: Date | null;
  lastOrderAt: Date | null;
}

/**
 * Recompute one customer's commerce figures from their orders and write them.
 *
 * Call INSIDE the transaction that changed an order. Safe to call more than
 * once — it reads and writes the same answer every time.
 */
export async function recomputeCustomerCommerce(
  tx: TxClient,
  tenantId: string,
  customerId: string
): Promise<CustomerCommerceRollup> {
  const [totals, dates] = await Promise.all([
    tx.order.aggregate({
      where: { tenantId, customerId, status: COUNTED },
      _sum: { amountPaid: true },
      _count: { _all: true },
    }),
    tx.order.aggregate({
      where: { tenantId, customerId, status: COUNTED },
      _min: { placedAt: true },
      _max: { placedAt: true },
    }),
  ]);

  const rollup: CustomerCommerceRollup = {
    totalSpent: (totals._sum.amountPaid ?? 0).toString(),
    orderCount: totals._count._all,
    firstOrderAt: dates._min.placedAt ?? null,
    lastOrderAt: dates._max.placedAt ?? null,
  };

  await tx.customer.update({
    where: { id: customerId },
    data: {
      totalSpent: rollup.totalSpent,
      orderCount: rollup.orderCount,
      firstOrderAt: rollup.firstOrderAt,
      lastOrderAt: rollup.lastOrderAt,
    },
  });

  return rollup;
}
