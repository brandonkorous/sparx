'use client';

// Sample data — fill the account with realistic made-up records to try things
// out before the real ones exist, and remove them again on request.
//
// Real operations, not a mock: /v1/sample-data reports what pack applies and
// whether anything is loaded; /load stamps the whole cross-module dataset (it
// clears any prior sample rows first, so it is safe to run twice); /clear removes
// every sample row and reports what it took out. Everything a pack creates is
// marked as a sample server-side, so Clear can find it all without touching a
// single real record.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { WORKBENCH_MODULES, type WorkbenchModule } from '../../components/module-scope';

import { api } from '../../lib/api/client';

/** Per-entity counts — mirrors `SampleDataCounts` from @wizeworks/db. */
export interface SampleDataCounts {
  /** Sample locations. Durable — Remove leaves these, so they are never counted
   *  in anything that says "removes" (issue 174). */
  warehouses: number;
  products: number;
  collections: number;
  categories: number;
  articles: number;
  customers: number;
  orders: number;
  returns: number;
  reviews: number;
  questions: number;
  bookings: number;
  services: number;
  resources: number;
  deals: number;
  tickets: number;
  billingDocuments: number;
  bundles: number;
  movements: number;
  images: number;
  aiPrompts: number;
  toolCalls: number;
}

/** Mirrors `SampleDataStatus` from @wizeworks/db. */
export interface SampleDataStatus {
  industry: string | null;
  packIndustry: string;
  packLabel: string;
  packSummary: string;
  /** The switched-on modules this pack would fill. */
  modules: string[];
  loaded: boolean;
  counts: SampleDataCounts;
}

export interface LoadResult {
  pack: string;
  counts: SampleDataCounts;
}

const KEY = ['sample-data'] as const;

export function useSampleDataStatus() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get<SampleDataStatus>('/v1/sample-data'),
  });
}

/** Invalidates the whole cache after a load/clear — sample rows land across
 *  products, orders, customers and more, so every list in the app may have
 *  changed. Broad on purpose: a targeted invalidation here would leave stale
 *  panes showing records that just appeared or vanished. */
function useAfterMutation() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries();
  };
}

export function useLoadSampleData() {
  const after = useAfterMutation();
  return useMutation({
    mutationFn: () => api.post<LoadResult>('/v1/sample-data/load'),
    onSuccess: after,
  });
}

export function useClearSampleData() {
  const after = useAfterMutation();
  return useMutation({
    mutationFn: () => api.post<{ counts: SampleDataCounts }>('/v1/sample-data/clear'),
    onSuccess: after,
  });
}

/**
 * What this console calls a part of the platform.
 *
 * ONE table, in `lib/surfaces/nav.ts`, which resolves through the brand's own
 * app registry. This file kept its own, and so did five others; measured
 * 2026-09-25, `commerce` alone had SIX names across the two consoles —
 *
 *     Sell (the rail) · Selling · Online store · Online stores · Store · commerce
 *
 * — and a Piggles shop owner met four of them on four different screens while
 * the rail beside her said Sell the whole time. Same defect as one order reading
 * four ways on four screens (issue 260), one level up: the APPS themselves.
 */
export { moduleLabel } from '../../lib/surfaces/nav';

/** The hue for a module slug. The slug IS the hue for every registered
 *  module; anything the registry does not know falls back to the platform's. */
export function moduleHue(slug: string): WorkbenchModule {
  return (WORKBENCH_MODULES as readonly string[]).includes(slug)
    ? (slug as WorkbenchModule)
    : 'platform';
}

/** Count keys in the order they read on screen, with plain-language labels.
 *  Ordered so the headline entities (products, orders, customers) come first.
 *  REMOVABLE only — see DURABLE_COUNT_LABELS. */
export const COUNT_LABELS: readonly { key: keyof SampleDataCounts; label: string }[] = [
  { key: 'products', label: 'Products' },
  { key: 'orders', label: 'Orders' },
  { key: 'customers', label: 'Customers' },
  { key: 'billingDocuments', label: 'Invoices & quotes' },
  { key: 'bookings', label: 'Bookings' },
  // Remove takes these too, and the tiles never said so (persona issue 085).
  { key: 'services', label: 'Services' },
  { key: 'resources', label: 'People and equipment' },
  { key: 'deals', label: 'Sales leads' },
  { key: 'tickets', label: 'Support requests' },
  { key: 'articles', label: 'Articles' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'questions', label: 'Questions' },
  { key: 'returns', label: 'Returns' },
  { key: 'collections', label: 'Groups of products' },
  { key: 'categories', label: 'Categories' },
  { key: 'bundles', label: 'Bundles' },
  { key: 'movements', label: 'Stock movements' },
  { key: 'images', label: 'Images' },
  { key: 'aiPrompts', label: 'AI prompts' },
  { key: 'toolCalls', label: 'AI activity' },
];

/** What practice data leaves behind after Remove: locations. They are kept on
 *  purpose — a business may have renamed one and counted stock into it — so they
 *  are shown apart from the removable list rather than folded into it, and never
 *  counted in anything that says "removes" (issue 174). */
export const DURABLE_COUNT_LABELS: readonly { key: keyof SampleDataCounts; label: string }[] = [
  { key: 'warehouses', label: 'Locations' },
];

export function countsTotal(counts: SampleDataCounts): number {
  return COUNT_LABELS.reduce((sum, { key }) => sum + (counts[key] || 0), 0);
}

/** A short human sentence of the biggest few things in a count set, for confirm
 *  copy — e.g. "24 products, 10 orders, 8 customers and 30 more records". */
export function summarizeCounts(counts: SampleDataCounts): string {
  const present = COUNT_LABELS.map(({ key, label }) => ({ n: counts[key] || 0, label })).filter(
    (entry) => entry.n > 0
  );
  if (present.length === 0) return 'no records';

  const head = present.slice(0, 3);
  const tailTotal = present.slice(3).reduce((sum, entry) => sum + entry.n, 0);

  const parts = head.map((entry) => `${String(entry.n)} ${entry.label.toLowerCase()}`);
  const phrase = parts.join(', ');
  return tailTotal > 0
    ? `${phrase} and ${String(tailTotal)} more ${tailTotal === 1 ? 'record' : 'records'}`
    : phrase;
}
