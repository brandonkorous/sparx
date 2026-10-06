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
  /** Sample LOCATIONS still in the account. Durable, unlike every other field
   *  here: Remove leaves them standing, because an owner may have renamed one and
   *  counted real stock into it. So they are shown apart from the removable
   *  figures and NEVER counted in anything that says "removes" (issue 174). The
   *  server's own `loaded` flag excludes them for the same reason, which is why
   *  this can be above zero while `loaded` is false. */
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
 * ONE table, in `lib/surfaces/nav.ts`. This file kept its own, and so did five
 * others; measured 2026-09-25, `commerce` alone had SIX names across the two
 * consoles — Sell (the Piggles rail), Selling, Online store, Online stores,
 * Store, and the raw slug — and a shop owner could meet four of them on four
 * screens. Same defect as one order reading four ways on four screens (issue
 * 260), one level up: the apps themselves.
 */
export { moduleLabel } from '../../lib/surfaces/nav';

/** The hue for a module slug. The slug IS the hue for every registered module;
 *  anything the registry does not know falls back to the platform's. */
export function moduleHue(slug: string): WorkbenchModule {
  return (WORKBENCH_MODULES as readonly string[]).includes(slug)
    ? (slug as WorkbenchModule)
    : 'platform';
}

// The count labels and the sentences built from them live in `counts.ts`, apart
// from the hooks, so a test can load them without the JSX this file pulls in.
export {
  COUNT_LABELS,
  DURABLE_COUNT_LABELS,
  countsTotal,
  durableTotal,
  summarizeCounts,
} from './counts';
