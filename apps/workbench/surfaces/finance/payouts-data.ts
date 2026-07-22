'use client';

// Payouts data — bank deposits, and the sales one deposit settles.
//
// A payout is a DERIVED settlement batch (see the api-rest finance/payouts route),
// so its id is synthetic (`<processor>~<date>`) but stable and addressable — that
// is what lets a payout be opened in its own pane rather than a modal.

import { useQuery } from '@sparx/query';
import { api } from '../../lib/api/client';

export interface Payout {
  id: string;
  processor: string;
  arrivalDate: string;
  currency: string;
  amount: number;
  salesCount: number;
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
