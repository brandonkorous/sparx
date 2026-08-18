'use client';

// Payments data — the ledger feed the Payments surface reads.
//
// One request per visible window (search + status + method + sort + page),
// mirroring the invoicing list: what is on screen is always exactly one server
// answer, never an accumulated merge that can show a list the database never
// held. `total` rides the paged envelope so the surface can page honestly.

import { useQuery } from '@wizeworks/query';
import { api } from '../../lib/api/client';

export interface Payment {
  id: string;
  orderId: string | null;
  orderNumber: string | null;
  customerName: string | null;
  customerEmail: string | null;
  processor: string;
  processorRef: string | null;
  amount: number;
  /** How much of this payment was later refunded (0 when none). */
  refundedAmount: number;
  currency: string;
  status: string;
  failureReason: string | null;
  channel: string | null;
  source: string | null;
  capturedAt: string | null;
  createdAt: string;
}

export interface PaymentsQuery {
  q: string;
  status: string;
  method: string;
  sort: { key: 'createdAt' | 'amount'; dir: 'asc' | 'desc' };
  take: number;
  skip: number;
}

export function usePayments(params: PaymentsQuery) {
  return useQuery({
    queryKey: ['finance', 'payments', params],
    queryFn: () =>
      api.list<Payment>('/v1/finance/payments', {
        ...(params.q ? { q: params.q } : {}),
        ...(params.status === 'all' ? {} : { status: params.status }),
        ...(params.method === 'all' ? {} : { method: params.method }),
        sort_by: params.sort.key,
        order: params.sort.dir,
        take: params.take,
        skip: params.skip,
      }),
    placeholderData: (previous) => previous,
  });
}
