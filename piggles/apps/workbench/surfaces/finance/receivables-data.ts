'use client';

// Receivables data — invoiced-but-unpaid, bucketed by how late.
//
// Reads the finance receivables endpoint, which buckets open billing documents on
// the SAME stored `overdueDays` the AR aging report and the invoice list use — so
// this surface can never disagree with invoicing about whether a document is late.

import { useQuery } from '@sparx/query';
import { api } from '../../lib/api/client';

export type ReceivableBucketKey = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus';

export interface Receivable {
  id: string;
  number: string | null;
  customerName: string;
  status: string;
  balance: number;
  total: number;
  currency: string;
  dueAt: string | null;
  overdueDays: number;
  bucket: ReceivableBucketKey;
}

export interface ReceivablesBucket {
  key: ReceivableBucketKey;
  label: string;
  count: number;
  balance: number;
}

export interface ReceivablesReport {
  currency: string;
  /** Headline figures over the WHOLE outstanding set — never the filtered view. */
  totalOutstanding: number;
  totalCount: number;
  buckets: ReceivablesBucket[];
  /** The filtered + sorted + paged rows. */
  items: Receivable[];
  /** Count of rows MATCHING the current filter/search — drives pagination. */
  total: number;
}

export interface ReceivablesQuery {
  q: string;
  bucket: string;
  sort: { key: 'overdueDays' | 'balance'; dir: 'asc' | 'desc' };
  take: number;
  skip: number;
}

export function useReceivables(params: ReceivablesQuery) {
  return useQuery({
    queryKey: ['finance', 'receivables', params],
    queryFn: () =>
      api.get<ReceivablesReport>('/v1/finance/receivables', {
        ...(params.q ? { q: params.q } : {}),
        ...(params.bucket === 'all' ? {} : { bucket: params.bucket }),
        sort_by: params.sort.key,
        order: params.sort.dir,
        take: params.take,
        skip: params.skip,
      }),
    placeholderData: (previous) => previous,
  });
}

/** The colour a lateness bucket wears — the whole point of the surface is that a
 *  90-days-late balance does not look like a not-yet-due one. */
export function bucketTone(key: ReceivableBucketKey): 'success' | 'warning' | 'error' | 'info' {
  switch (key) {
    case 'current':
      return 'info';
    case 'd1_30':
      return 'warning';
    case 'd31_60':
    case 'd61_90':
      return 'error';
    case 'd90_plus':
      return 'error';
  }
}
