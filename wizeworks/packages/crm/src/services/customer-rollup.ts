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
//
// ── And what "total ordered" means ───────────────────────────────────────────
//
// The other half of the same question, because separating them left the shop
// taking manual payment with no answer at all: Juniper Row's customer card read
// "$0.00 across 3 orders" above a list of orders worth $502, and every figure on
// it was arithmetically correct (issue 323). `totalOrdered` is what those orders
// are WORTH, whether or not the money has arrived.
//
// NET OF REFUNDS — `SUM(total - refundTotal)` — for the same reason `totalSpent`
// is net. A gross figure beside a net one puts two populations on one card,
// which is the defect this closes rather than repeats, and it is what a return
// means: an order the money went back on is worth nothing to the person who sold
// it. A PARTIAL refund reduces it by what went back rather than discarding the
// order, which is why this subtracts rather than filters.
//
// The order still counts in `orderCount` either way. A fully refunded order is a
// real event in the relationship, and dropping it would make "3 orders" disagree
// with the three orders listed underneath it — the same contradiction again.

// ── Why the lifecycle stage is derived here too ──────────────────────────────
//
// "Has this person ever bought from us" is the same kind of fact as the four
// above, and it used to be maintained the way they used to be: nudged at the
// call site. Storefront checkout promoted the buyer to the `customer` stage,
// marketplace ingest promoted them again in its own copy of the rule, and a sale
// rung up at the till promoted nobody — so a shop's in-person buyers stayed
// filed as leads forever, while a web shopper who had not paid a penny was a
// customer. Ravi Naidoo had handed over $30 across the counter and every
// segment, filter and report that asks for customers left him out (issue 280).
//
// Deriving it here gives it the same three properties the figures have: a path
// that forgets to promote is healed by the next write, promoting twice is a
// no-op, and the stage can never disagree with the orders on the same screen.
//
// It only ever moves FORWARD. Someone already recognised as a customer or an
// evangelist keeps that, a cancelled order never demotes anyone, and a stage a
// person set by hand on the customer's own pane is never walked back — the one
// thing it does is stop a buyer being filed as a stranger.

import { UNCOUNTED_ORDER_STATUS } from '@wizeworks/crm-schemas';
import type { TxClient } from '@wizeworks/db';

/** Orders that never happened do not count toward anything. Shared with the
 *  order list's `countedOnly`, so a list beside these figures shows the same
 *  orders they were computed from (issue 332). */
const COUNTED = { not: UNCOUNTED_ORDER_STATUS } as const;

/** Stages a purchase does not move: the person is already known to have bought. */
const SETTLED: readonly string[] = ['customer', 'evangelist'];

export interface CustomerCommerceRollup {
  totalSpent: string;
  totalOrdered: string;
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
  const [totals, dates, current] = await Promise.all([
    tx.order.aggregate({
      where: { tenantId, customerId, status: COUNTED },
      _sum: { amountPaid: true, total: true, refundTotal: true },
      _count: { _all: true },
    }),
    tx.order.aggregate({
      where: { tenantId, customerId, status: COUNTED },
      _min: { placedAt: true },
      _max: { placedAt: true },
    }),
    tx.customer.findUnique({ where: { id: customerId }, select: { lifecycleStage: true } }),
  ]);

  // Summed separately and subtracted here rather than in SQL: Prisma's aggregate
  // has no expression form, and two sums over the same filtered set are one scan
  // either way.
  const ordered = Number(totals._sum.total ?? 0) - Number(totals._sum.refundTotal ?? 0);

  const rollup: CustomerCommerceRollup = {
    totalSpent: (totals._sum.amountPaid ?? 0).toString(),
    // Never below zero. A refund larger than the order it belongs to is a data
    // fault rather than a customer worth negative money, and a negative here
    // would render as "-$42.00 of orders", which is the unreadable figure the
    // increment version of this file already produced once.
    totalOrdered: Math.max(ordered, 0).toFixed(2),
    orderCount: totals._count._all,
    firstOrderAt: dates._min.placedAt ?? null,
    lastOrderAt: dates._max.placedAt ?? null,
  };

  // An order on the record is what makes someone a customer, whichever door it
  // came through. `leadStatus` goes with it: work-in-progress on a lead means
  // nothing once they have bought.
  const becomesCustomer =
    rollup.orderCount > 0 && current !== null && !SETTLED.includes(current.lifecycleStage);

  await tx.customer.update({
    where: { id: customerId },
    data: {
      totalSpent: rollup.totalSpent,
      totalOrdered: rollup.totalOrdered,
      orderCount: rollup.orderCount,
      firstOrderAt: rollup.firstOrderAt,
      lastOrderAt: rollup.lastOrderAt,
      ...(becomesCustomer ? { lifecycleStage: 'customer', leadStatus: null } : {}),
    },
  });

  return rollup;
}
