'use client';

// Reading orders — the list, one order, and the three things that happened to
// it. Owns the ['commerce','orders'] query key that every mutation invalidates.

import { useQuery } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { normalizeOrder, num } from './order-types';
import type { Order, OrderFulfillment, OrderPayment, OrderRefund } from './order-types';

export const ORDERS_KEY = ['commerce', 'orders'];

/** Server-side sort. The list is paged, and a browser-side sort of the loaded
 *  window sorts ONE page and presents it as the answer — "biggest order" would
 *  hand back the biggest order on page 3. */
export type OrderSortKey = 'placedAt' | 'total';
export type SortDirection = 'asc' | 'desc';

export interface OrderQuery {
  q?: string;
  status?: string;
  /** Only the orders that count toward a customer's figures — cancelled ones
   *  left out. For a list shown BESIDE those figures. */
  countedOnly?: boolean;
  paymentStatus?: string;
  /** Scope the list to one customer — the customer's-side lens on Selling. The
   *  endpoint (`GET /v1/orders?customer_id=`) is the join; there is no separate
   *  per-customer orders route. */
  customerId?: string;
  sortBy: OrderSortKey;
  order: SortDirection;
  take: number;
  skip: number;
}

export function useOrders(query: OrderQuery) {
  return useQuery({
    queryKey: [...ORDERS_KEY, query],
    queryFn: () =>
      api
        .list<Order>('/v1/orders', {
          ...(query.q ? { q: query.q } : {}),
          ...(query.status ? { status: query.status } : {}),
          ...(query.countedOnly ? { counted_only: 'true' } : {}),
          ...(query.paymentStatus ? { payment_status: query.paymentStatus } : {}),
          ...(query.customerId ? { customer_id: query.customerId } : {}),
          sort_by: query.sortBy,
          order: query.order,
          take: query.take,
          skip: query.skip,
        })
        .then((result) => ({
          items: result.items.map(normalizeOrder),
          total: result.total,
        })),
    // Keeps the current window on screen while the next one loads, so paging and
    // re-sorting don't blink the table out to an empty state and back.
    placeholderData: (previous) => previous,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: [...ORDERS_KEY, id],
    queryFn: () => api.get<Order>(`/v1/orders/${id}`).then(normalizeOrder),
  });
}

/**
 * What happened to the money, and what happened to the goods.
 *
 * Three separate endpoints rather than one fat order payload, because that is
 * how api-rest models them — payments, fulfillments and refunds are real
 * subresources with their own writes. They are fetched in parallel and each
 * failure is independent: a fulfillment service having a bad day must not blank
 * out the payment history on the same screen.
 */
export function useOrderPayments(id: string) {
  return useQuery({
    queryKey: [...ORDERS_KEY, id, 'payments'],
    queryFn: () =>
      api
        .get<OrderPayment[]>(`/v1/orders/${id}/payments`)
        .then((rows) => rows.map((row) => ({ ...row, amount: num(row.amount) }))),
  });
}

export function useOrderFulfillments(id: string) {
  return useQuery({
    queryKey: [...ORDERS_KEY, id, 'fulfillments'],
    queryFn: () => api.get<OrderFulfillment[]>(`/v1/orders/${id}/fulfillments`),
  });
}

export function useOrderRefunds(id: string) {
  return useQuery({
    queryKey: [...ORDERS_KEY, id, 'refunds'],
    queryFn: () =>
      api
        .get<OrderRefund[]>(`/v1/orders/${id}/refunds`)
        .then((rows) => rows.map((row) => ({ ...row, amount: num(row.amount) }))),
  });
}
