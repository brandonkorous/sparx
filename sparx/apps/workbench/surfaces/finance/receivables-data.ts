'use client';

// Receivables data — invoiced-but-unpaid, bucketed by how late.
//
// Reads the finance receivables endpoint, which buckets open billing documents
// through `daysPastDue` — the same shared rule the AR aging report and the
// invoice list use, computed at QUERY time rather than read from the stored
// `overdueDays` column, so this surface can never disagree with invoicing about
// whether a document is late. (This comment used to say it bucketed on the
// stored column; that stopped being true when the column was found to be only as
// fresh as its last recompute job.)
//
// The WORDS and the color for one row live in `receivables-words.ts`, so they can
// be tested without this module's data layer; both are re-exported here so the
// surface keeps one import.

import { useQuery } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { bucketTone, type ReceivableBucketKey } from './receivables-words';

export { bucketTone };
export type { ReceivableBucketKey };

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
