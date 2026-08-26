'use client';

// Starting a return, from the sale it came from.
//
// The returns module had no way in at all — `returnService.create` was written,
// validated, audited and published its event, and nothing anywhere called it
// (persona issue 219). This is the caller, and it belongs beside the order
// because the order is the only screen that knows what was bought.
//
// Kept out of `returns-data.ts` deliberately: that file owns the workflow a
// return moves through once it EXISTS. This one owns the single question the
// order pane has to answer first — what of this sale can still come back.

import { useMutation, useQueries, useQuery, useQueryClient } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { ORDERS_KEY } from './order-queries';
import { RETURNS_KEY } from './returns-data';
import type { ReturnDetail, ReturnSummary } from './returns-types';
import type { OrderItem } from './order-types';

/* ── What is already coming back ────────────────────────────────────────── */

/** Returns opened against ONE order. The endpoint could always filter this way;
 *  until issue 219 nothing could ask it to. */
export function useOrderReturns(orderId: string) {
  return useQuery({
    queryKey: [...RETURNS_KEY, 'for-order', orderId],
    queryFn: () => api.list<ReturnSummary>('/v1/commerce/returns', { order_id: orderId, take: 50 }),
    enabled: orderId !== '',
  });
}

/** A return stops holding quantity once it is turned down or called off — the
 *  goods are staying with the customer, so the line is free to be asked back
 *  another way. Everything else, settled or not, still counts. */
const RELEASED = new Set(['denied', 'cancelled']);

/**
 * The line details of the returns that still hold quantity on this order.
 *
 * One request per open return. That reads like an N+1 and is not one in
 * practice: an order with more than two returns against it is already unusual,
 * and the alternative — widening the shared list shape to carry line items —
 * would make every returns table pay for a question only this pane asks.
 */
export function useOrderReturnLines(returns: ReturnSummary[]) {
  const holding = returns.filter((entry) => !RELEASED.has(entry.status));
  const queries = useQueries({
    queries: holding.map((entry) => ({
      queryKey: [...RETURNS_KEY, 'detail', entry.id],
      queryFn: () => api.get<ReturnDetail>(`/v1/commerce/returns/${entry.id}`),
    })),
  });
  return {
    // Until every one has answered, the counts below would be too low, and too
    // low means offering to send back something already on its way.
    isPending: queries.some((query) => query.isPending),
    details: queries.flatMap((query) => (query.data ? [query.data] : [])),
  };
}

/** orderItemId → how many units of it are already spoken for. */
export function spokenFor(details: ReturnDetail[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const detail of details) {
    for (const line of detail.items) {
      counts.set(line.orderItemId, (counts.get(line.orderItemId) ?? 0) + line.quantity);
    }
  }
  return counts;
}

/* ── What can still come back ───────────────────────────────────────────── */

export interface ReturnableLine {
  orderItemId: string;
  name: string;
  sku: string;
  unitPrice: number;
  /** The most she can ask back for this line, right now. */
  most: number;
}

/**
 * The ceiling is what actually WENT OUT, not what was ordered.
 *
 * On a shop that makes things to order half a sale can ship weeks before the
 * rest, and nobody can send back a coat that is still being cut. Anything
 * already refunded is out too — that money has been given back once.
 */
export function returnableLines(
  items: OrderItem[],
  alreadyAsked: Map<string, number>
): ReturnableLine[] {
  return items
    .map((item) => ({
      orderItemId: item.id,
      name: item.name,
      sku: item.sku,
      unitPrice: item.unitPrice,
      most: item.quantityFulfilled - item.quantityRefunded - (alreadyAsked.get(item.id) ?? 0),
    }))
    .filter((line) => line.most > 0);
}

/* ── Opening one ────────────────────────────────────────────────────────── */

export interface StartReturnLine {
  orderItemId: string;
  quantity: number;
  reasonCode: string;
  customerNote?: string;
}

export interface StartReturnBody {
  orderId: string;
  preferredOutcome: string;
  items: StartReturnLine[];
}

export function useStartReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: StartReturnBody) => api.post<{ id: string }>('/v1/commerce/returns', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: RETURNS_KEY });
      // The order pane's own copy of what is coming back is stale the moment
      // one is opened, and so is the returns badge in the nav.
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    },
  });
}

// The words a reason and an outcome are offered under live with the words they
// are READ BACK under, in ./returns-words — a form that offers "They changed
// their mind" and a pane that reads it back as "No longer needed" is one stored
// value wearing two names.
