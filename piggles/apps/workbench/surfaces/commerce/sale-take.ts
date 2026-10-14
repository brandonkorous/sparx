'use client';

// Writing a sale at the counter down. Moved out of sale-data.ts with the order
// body it posts, which now carries the sales tax (sparx persona issue 230).

import { useMutation, useQueryClient } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { ORDERS_KEY, type Order } from './data';
import { handedOverNow } from './sale-core';
import type { SaleLine } from './sale-data';
import { noticeOn } from './sale-made-to-order';
import { saleOrderBody } from './sale-order-body';
import type { SaleTaxQuote } from './sale-tax';

export interface TakeSaleInput {
  customerId: string;
  currency: string;
  lines: SaleLine[];
  /** Whole currency units taken now. Zero means she has not been paid yet. */
  paid: number;
  paidWith: string;
  paidNote: string;
  /** Which business this was sold at. Without it the order has no origin site,
   *  and every site-scoped money screen — Payments, takings, profit — leaves it
   *  out of the totals while the order itself reads perfectly. */
  propertyId: string | null;
  /** The sales tax on this exact sale (sparx persona issue 230). */
  tax: SaleTaxQuote | null;
}

async function handOver(order: Order): Promise<void> {
  // A part held for its old part stays on the shelf (sparx issue 061): the order
  // spine refuses to record it as handed over, which would read as the sale failing.
  const lines = handedOverNow(order.items ?? []);
  if (lines.length === 0) return;
  await api.post(`/v1/orders/${order.id}/fulfillments`, {
    status: 'delivered',
    carrier: 'pickup',
    lines,
  });
}

/** The money handed over, against the order it pays for. */
async function recordPayment(order: Order, input: TakeSaleInput): Promise<void> {
  if (input.paid <= 0) return;
  await api.post(`/v1/orders/${order.id}/payments`, {
    amount: input.paid,
    currency: input.currency,
    processor: input.paidWith,
    status: 'captured',
    capturedAt: new Date().toISOString(),
    // `metadata`, not `processorRef` — see the note in order-actions.ts and
    // persona issue 223. A cheque number is not a gateway reference.
    ...(input.paidNote.trim() ? { metadata: { note: input.paidNote.trim() } } : {}),
  });
}

/**
 * Writes the sale down, the money against it, and the handover.
 *
 * Three calls because the platform stores three facts, and they are separate on
 * purpose — a part payment and an unpaid slip are both ordinary. The order goes
 * first: if a later call fails the order still exists and can be settled from
 * its own pane, whereas a payment with no order has nothing to belong to.
 *
 * A sale at a counter is over when it is made — UNLESS something on it still has
 * to be made. Handing over a cake due on Saturday would file it as collected on
 * the day it was ordered, and it would never appear on the list of things still
 * to do (issue 026).
 */
export function useTakeSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TakeSaleInput): Promise<Order> => {
      const order = await api.post<Order>('/v1/orders', saleOrderBody(input));
      await recordPayment(order, input);
      if (noticeOn(input.lines) === null) await handOver(order);
      return order;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    },
  });
}
