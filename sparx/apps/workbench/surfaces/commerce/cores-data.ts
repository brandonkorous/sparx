'use client';

// Core charges on rebuilt parts (persona issue 051): the cores still owed, and
// the two things a parts counter does about one.
//
// A core charge is a refundable deposit taken with a remanufactured part. It comes
// back when the old part (the "core") does. Every write here moves an order's
// money or its open invoice, so each one re-reads the orders, the invoices and
// this list: a screen that still showed a core as owed after it came back would
// invite somebody to give the same deposit back twice.

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
  /** Bought by sending the old part first (issue 057): no deposit, and the part
   *  ships when the old one arrives. */
  coreFirst: boolean;
  /** Units of a send-first line still waiting for their old part before they can
   *  ship. Zero on a deposit line, and once the business chose not to wait. */
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

/** Ship a send-first line before its old part arrives. The reason is required:
 *  the old part is still owed, and the next person to open the order will ask. */
export function useReleaseCoreHold() {
  return useCoreWrite<{ note: string }, { orderItemId: string; holdReleasedAt: string }>(
    (orderItemId) => `/v1/commerce/order-items/${orderItemId}/cores/release`
  );
}

/**
 * One order line's core, as the order AND the Cores owed list both show it.
 *
 * The two read different wire shapes (a full order line, a row of the list), and
 * the moves on a core are the same from either. Reading both into this one shape
 * is what keeps the two screens offering the same buttons for the same line.
 */
export interface CoreLine {
  orderItemId: string;
  name: string;
  currency: string;
  customerName: string;
  quantity: number;
  /** Deposit per unit, in cents. Zero on a send-first line: nothing was paid. */
  depositCents: number;
  /** Bought by sending the old part first (issue 057). */
  coreFirst: boolean;
  /** Old parts still to come in. */
  owed: number;
  /** Units that cannot ship until their old part arrives. */
  waiting: number;
  /** The business chose to ship it without waiting for the old part. */
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
