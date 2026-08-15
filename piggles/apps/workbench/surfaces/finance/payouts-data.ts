'use client';

// Payouts data — bank deposits, and the sales one deposit settles.
//
// Two sources (see the api-rest finance/payouts route): sparx Pay serves REAL Stripe
// payout objects (ids `po_…`, the exact bank deposits, account-level so no per-payout
// sale count in the list); every other funding source is a DERIVED settlement batch
// (synthetic id `<processor>~<date>`, site-scopable, with a sale count). Both ids are
// stable + addressable — that is what lets a payout open in its own pane, not a modal.

import { useQuery } from '@sparx/query';
import { api } from '../../lib/api/client';

export interface Payout {
  id: string;
  processor: string;
  arrivalDate: string;
  currency: string;
  amount: number;
  /** Derived payouts carry a sale count; real Stripe payouts only expose it in the
   *  detail (an N+1 balance-transaction call per list row), so the list omits it. */
  salesCount?: number;
  status: string;
}

export interface PayoutSale {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  customerName: string | null;
  channel: string | null;
  source: string | null;
  amount: number;
  currency: string;
}

export interface PayoutDetail extends Payout {
  sales: PayoutSale[];
}

export interface PayoutsQuery {
  status: string;
  processor: string;
  sort: { key: 'arrivalDate' | 'amount'; dir: 'asc' | 'desc' };
  take: number;
  skip: number;
}

export function usePayouts(params: PayoutsQuery) {
  return useQuery({
    queryKey: ['finance', 'payouts', params],
    queryFn: () =>
      api.list<Payout>('/v1/finance/payouts', {
        ...(params.status === 'all' ? {} : { status: params.status }),
        ...(params.processor === 'all' ? {} : { processor: params.processor }),
        sort_by: params.sort.key,
        order: params.sort.dir,
        take: params.take,
        skip: params.skip,
      }),
    placeholderData: (previous) => previous,
  });
}

export function usePayout(id: string) {
  return useQuery({
    queryKey: ['finance', 'payout', id],
    queryFn: () => api.get<PayoutDetail>(`/v1/finance/payouts/${encodeURIComponent(id)}`),
  });
}
