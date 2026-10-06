'use client';

// Core charges on rebuilt parts (sparx persona issue 051): the cores still owed,
// and the two things a parts counter does about one. Every write re-reads orders,
// invoices and this list, so a core that came back never shows as owed again.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { unitsWaitingForCore } from '@wizeworks/commerce-schemas';
import { api } from '../../lib/api/client';
import { apiErrorMessage } from '../../lib/api-error';
import { ORDERS_KEY, type OrderItem } from './data';

export const CORES_KEY = ['commerce', 'cores'];

/** One order line with cores still to come back. Money in cents. */
export interface CoreOwed {
  orderItemId: string;
  orderId: string;
  orderNumber: string;
  placedAt: string;
  customerId: string;
  customerName: string;
  companyId: string | null;
  companyName: string | null;
  sku: string;
  name: string;
  quantity: number;
  /** Zero on a send-first line: no deposit was taken. */
  coreChargeCents: number;
  /** Bought by sending the old part first (issue 057). */
  coreFirst: boolean;
  /** Units of a send-first line still waiting for their old part. */
  waitingToShip: number;
  /** When the business chose to ship a send-first line before its old part. */
  holdReleasedAt: string | null;
  coresOwed: number;
  coresReturned: number;
  coresKept: number;
  owedCents: number;
  daysOut: number;
  currency: string;
}

export interface CoresQuery {
  customerId?: string;
  orderId?: string;
  olderThanDays?: number;
}

export function useCoresOwed(query: CoresQuery = {}) {
  return useQuery({
    queryKey: [...CORES_KEY, query],
    queryFn: () =>
      api.get<CoreOwed[]>('/v1/commerce/cores', {
        ...(query.customerId ? { customer_id: query.customerId } : {}),
        ...(query.orderId ? { order_id: query.orderId } : {}),
        ...(query.olderThanDays !== undefined ? { older_than_days: query.olderThanDays } : {}),
      }),
  });
}

/** Where money already paid goes. An open invoice on the order is always
 *  settled first, whatever this says. */
export type CoreRefundRoute = 'original_payment' | 'account_credit';

export interface ReceiveCoresBody {
  usable: number;
  unusable: number;
  refundTo: CoreRefundRoute;
  note?: string;
}

/** What the server did with the money, including its own sentence for it. */
export interface CoreSettlement {
  orderItemId: string;
  coresReturned: number;
  coresKept: number;
  invoiceCreditCents: number;
  refundedCents: number;
  accountCreditCents: number;
  summary: string;
}

function useCoreWrite<TBody, TResult>(path: (orderItemId: string) => string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderItemId, body }: { orderItemId: string; body: TBody }) =>
      api.post<TResult>(path(orderItemId), body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CORES_KEY });
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      void queryClient.invalidateQueries({ queryKey: ['invoicing'] });
    },
  });
}

export function useReceiveCores() {
  return useCoreWrite<ReceiveCoresBody, CoreSettlement>(
    (orderItemId) => `/v1/commerce/order-items/${orderItemId}/cores/received`
  );
}

export function useKeepCoreDeposits() {
  return useCoreWrite<{ quantity: number; note: string }, { coresKept: number }>(
    (orderItemId) => `/v1/commerce/order-items/${orderItemId}/cores/kept`
  );
}

/** Ship a send-first line before its old part arrives; the reason is required. */
export function useReleaseCoreHold() {
  return useCoreWrite<{ note: string }, { orderItemId: string; holdReleasedAt: string }>(
    (orderItemId) => `/v1/commerce/order-items/${orderItemId}/cores/release`
  );
}

/** One line's core as the order AND the Cores owed list both show it, so the
 *  two screens offer the same moves for the same line. */
export interface CoreLine {
  orderItemId: string;
  name: string;
  currency: string;
  customerName: string;
  quantity: number;
  /** Deposit per unit, in cents. Zero on a send-first line. */
  depositCents: number;
  coreFirst: boolean;
  /** Old parts still to come in. */
  owed: number;
  /** Units that cannot ship until their old part arrives. */
  waiting: number;
  /** The business chose to ship it without waiting. */
  released: boolean;
}

export function coreLineOfItem(item: OrderItem, currency: string, customerName: string): CoreLine {
  return {
    orderItemId: item.id,
    name: item.name,
    currency,
    customerName,
    quantity: item.quantity,
    depositCents: Math.round((item.coreCharge ?? 0) * 100),
    coreFirst: item.coreFirst,
    owed: coresOwedOn(item),
    waiting: unitsWaitingForCore(item),
    released: item.coreHoldReleasedAt !== null,
  };
}

export function coreLineOfOwed(row: CoreOwed): CoreLine {
  return {
    orderItemId: row.orderItemId,
    name: row.name,
    currency: row.currency,
    customerName: row.customerName,
    quantity: row.quantity,
    depositCents: row.coreFirst ? 0 : row.coreChargeCents,
    coreFirst: row.coreFirst,
    owed: row.coresOwed,
    waiting: row.waitingToShip,
    released: row.holdReleasedAt !== null,
  };
}

export function coreErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}

/** Cores still owed on one order line. Never below zero. */
export function coresOwedOn(item: {
  quantity: number;
  quantityRefunded: number;
  coresReturned: number;
  coresKept: number;
}): number {
  return Math.max(0, item.quantity - item.quantityRefunded - item.coresReturned - item.coresKept);
}

/** "1 core", "3 cores". */
export function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

/** A typed whole number of parts; anything else counts as none. */
export function wholeCount(value: string): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
