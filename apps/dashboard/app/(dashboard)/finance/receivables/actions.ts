'use server';

// Server action for the Finance → Receivables surface (docs/110 Slice 4c). The
// unified AR rollup: `GET /v1/invoicing/aging` with NO scope already aggregates open
// balances across BOTH invoicing documents AND B2B invoices, because both are the one
// BillingDocument substrate since Phase 8 (docs/110 GAP B — already closed, no new
// endpoint needed). Gated on the invoicing module server-side, which B2B/Commerce
// tenants satisfy free via the BUNDLED_FREE graph.

import 'server-only';
import { api } from '@/lib/api-rest-client';

export interface AgingBucket {
  /** current | d1_30 | d31_60 | d61_90 | d90_plus */
  key: string;
  label: string;
  count: number;
  /** Dollars (mirrors the Decimal money columns), not cents. */
  balance: number;
}

export interface AgingReport {
  asOf: string;
  buckets: AgingBucket[];
  totalOutstanding: number;
  totalCount: number;
}

/** The cross-document AR aging report. Degrades to null if the report is briefly
 *  unreachable so the page renders a calm empty state. */
export async function getArAging(): Promise<AgingReport | null> {
  return api.get<AgingReport>('/v1/invoicing/aging').catch(() => null);
}
