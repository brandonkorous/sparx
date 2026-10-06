'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE BUNDLE DATA LAYER
//
// A bundle sells several products together as one item — a starter kit, a gift
// set, a service package — usually for less than buying the parts on their own.
// It is SOLD AS a wrapper product (chosen once, on create) and made up of
// COMPONENTS, each a specific product version (a variant). Everything sent here
// satisfies `CreateBundleInput` / `UpdateBundleInput` from `@sparx/commerce-
// schemas`.
//
//   ['commerce','bundles']              the root every read nests under
//   ['commerce','bundles','list',{q}]   the list surface's window
//   ['commerce','bundles', id]          one bundle, with its components
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { apiErrorMessage } from '../../lib/api-error';
import { api } from '../../lib/api/client';
import { useDebouncedValue } from '../../lib/api/search';
// The read shapes are the product layer's — one definition, shared, so the
// bundle a product-scoped pane reads and the one this list reads cannot drift.
import type { Bundle, BundleComponent, BundleDetail } from './products-data';

export type { Bundle, BundleComponent, BundleDetail };

export const bundleKeys = {
  all: ['commerce', 'bundles'] as const,
  detail: (id: string) => [...bundleKeys.all, id] as const,
};

export type BundlePricingMode = 'sum_of_components' | 'fixed' | 'percent_off_sum';
export type BundleInventoryMode = 'decrement_components' | 'decrement_bundle_sku';

/* ── The list window ────────────────────────────────────────────────────── */

/** Sort direction, shared by every server-sorted list. */
export type SortDir = 'asc' | 'desc';

/**
 * The columns the bundles table may order by — EXACTLY the server's whitelist
 * (`ListBundlesQuery.sort_by` in api-rest). A bundle has no name of its own, so
 * `name` orders on the wrapper product's title; `components` orders on how many
 * products are inside. Sorting lives on the server because a client-side sort of
 * one loaded page silently presents that page as the whole answer.
 */
export type BundleSort = 'name' | 'pricingMode' | 'components' | 'updatedAt';

export interface BundleListFilter {
  q?: string;
  sortBy: BundleSort;
  order: SortDir;
  take?: number;
  skip?: number;
}

export function useBundles(filter: BundleListFilter) {
  return useQuery({
    queryKey: [...bundleKeys.all, 'list', filter] as const,
    queryFn: () =>
      api.list<Bundle>('/v1/commerce/bundles', {
        ...(filter.q?.trim() ? { q: filter.q.trim() } : {}),
        sort_by: filter.sortBy,
        order: filter.order,
        take: filter.take ?? 50,
        ...(filter.skip ? { skip: filter.skip } : {}),
      }),
    // Hold the previous window on screen while the next loads, so paging and
    // re-sorting don't blink the table out to empty and back.
    placeholderData: (previous) => previous,
  });
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useBundle(id: string) {
  return useQuery({
    queryKey: bundleKeys.detail(id),
    queryFn: () => api.get<BundleDetail>(`/v1/commerce/bundles/${id}`),
    enabled: id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/* ── The variant catalog (component + add-on picker) ────────────────────── */

/** A specific, sellable version of a product — what a bundle component and a
 *  configurator add-on both point at. */
/** One axis of a version: "Size" = "L". */
export interface VariantOption {
  name: string;
  value: string;
}

export interface VariantChoice {
  id: string;
  sku: string;
  title: string | null;
  /** The option values that make this version the one it is, in the shop's own
   *  option order. What actually tells two rows apart when `title` is blank,
   *  which on a seeded catalog is always (issue 182). The endpoint has always
   *  sent these; this console typed them away and drew ten identical rows. */
  options: VariantOption[];
  isDefault: boolean;
  priceCents: number;
  /** What this version costs the business, in cents, or null when none is on
   *  record. A quote line picked from it starts from this cost, so its margin
   *  shows at once (sparx persona issue 086). Optional: an older server sent none. */
  costCents?: number | null;
  currency: string;
  /** A rebuilt part's refundable core deposit per unit, in cents, or null when
   *  this version takes no core (sparx persona issue 051). */
  coreChargeCents: number | null;
  /** The buyer may bring the old part first and pay no deposit (issue 057).
   *  Only ever true alongside a deposit. The till asks which (issue 061). */
  coreFirstOffered: boolean;
  archivedAt: string | null;
  productId: string;
  productTitle: string;
  productHandle: string;
  productStatus: string;
}

/** The first window of the catalog: what a picker lists before anybody types. */
const CATALOG_KEY = ['commerce', 'variants', 'catalog'] as const;

/** How many versions a search asks for. Every picker draws 40 or fewer. */
const SEARCH_TAKE = 40;

/** How long typing has to pause before the server is asked. */
const SEARCH_DEBOUNCE_MS = 250;

/**
 * The first 500 versions THIS SITE sells, ordered by product title.
 *
 * A window, not the catalog: a parts counter with 693 versions has a tail this
 * never reaches. Nothing searches it any more (that is `useVariantSearch`); it
 * is what a picker shows before anybody has typed.
 *
 * The site rides the `x-sparx-property-id` header the client attaches to every
 * request, and switching site reloads the page, so there is no site in the key
 * here. It was genuinely tenant-wide until 2026-09-17, which put one business's
 * stock in another one's till.
 */
export function useVariantCatalog() {
  return useQuery({
    queryKey: CATALOG_KEY,
    queryFn: () => api.get<VariantChoice[]>('/v1/commerce/variants', { take: 500 }),
    staleTime: 60_000,
  });
}

/**
 * The catalog as a search box sees it, however large the catalog is.
 *
 * Empty search: the first window, exactly as before. Anything typed: the
 * SERVER is asked (`q`), so a version past the 500th is as findable as the
 * first. Until 2026-10-01 every picker filtered the first window in the
 * browser, and on a parts counter with 693 versions everything after roughly
 * the 500th alphabetically could not be found at the till at all (sparx
 * persona P01, issue 069).
 *
 * The previous answer stays on screen while the next one loads, so the list
 * narrows rather than blinking empty on every keystroke. A caller should run
 * `variantMatches` over `data` with the LIVE search, which narrows the held rows
 * at once, and must not call an empty result "nothing matches" while
 * `searching` is true: that empty list is an unanswered question, and it sends
 * somebody off to type in by hand a part they already stock.
 */
export function useVariantSearch(
  search: string,
  /** Off until the caller has something to ask: a picker that searches only
   *  from two letters (the invoice line editor) would otherwise pull the whole
   *  500-row first window it never draws. */
  options: { enabled?: boolean } = {}
) {
  const live = search.trim();
  const term = useDebouncedValue(live, SEARCH_DEBOUNCE_MS);
  const query = useQuery({
    enabled: options.enabled ?? true,
    queryKey: term === '' ? CATALOG_KEY : ([...CATALOG_KEY, 'search', term] as const),
    queryFn: () =>
      term === ''
        ? api.get<VariantChoice[]>('/v1/commerce/variants', { take: 500 })
        : api.get<VariantChoice[]>('/v1/commerce/variants', { q: term, take: SEARCH_TAKE }),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
  return {
    data: query.data,
    isPending: query.isPending,
    isError: query.isError,
    /** The rows in hand answer an older search; the current one is on its way. */
    searching: live !== term || query.isPlaceholderData,
    /** Ask again. A failed search keeps its error until the words change, so
     *  "try again" needs a button that really does. */
    retry: () => {
      void query.refetch();
    },
  };
}

/**
 * Every version of ONE product, in the catalog's own shape.
 *
 * For a picker that floats the product it is about to the top. In a big
 * catalog that product may be nowhere in the first window, so it is asked for
 * by name rather than hoped for.
 */
export function useProductVariantChoices(productId: string | undefined) {
  return useQuery({
    queryKey: [...CATALOG_KEY, 'product', productId ?? ''] as const,
    queryFn: () =>
      api.get<VariantChoice[]>('/v1/commerce/variants', {
        product_id: productId ?? '',
        take: 250,
      }),
    enabled: Boolean(productId),
    staleTime: 60_000,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

export function useInvalidateBundles() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: bundleKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: bundleKeys.detail(id) });
  };
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

export interface BundleComponentInput {
  variantId: string;
  defaultQuantity: number;
  isRequired: boolean;
  isSwappable: boolean;
  swappableProductId?: string;
  position: number;
}

export interface CreateBundleInput {
  bundleProductId: string;
  pricingMode: BundlePricingMode;
  fixedPriceCents?: number;
  percentOffSum?: number;
  inventoryMode: BundleInventoryMode;
  components: BundleComponentInput[];
}

export function useCreateBundle() {
  const invalidate = useInvalidateBundles();
  return useMutation({
    mutationFn: (input: CreateBundleInput) =>
      api.post<{ id: string }>('/v1/commerce/bundles', input),
    onSuccess: (created) => {
      invalidate(created.id);
    },
  });
}

/** What an edit can change. `bundleProductId` is absent — the wrapper product is
 *  fixed once the bundle exists (the server has no way to move it). */
export interface UpdateBundleInput {
  pricingMode?: BundlePricingMode;
  fixedPriceCents?: number | null;
  percentOffSum?: number | null;
  inventoryMode?: BundleInventoryMode;
  components?: BundleComponentInput[];
}

export function useUpdateBundle(id: string) {
  const invalidate = useInvalidateBundles();
  return useMutation({
    mutationFn: (patch: UpdateBundleInput) => api.patch(`/v1/commerce/bundles/${id}`, patch),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDeleteBundle(id: string) {
  const invalidate = useInvalidateBundles();
  return useMutation({
    mutationFn: () => api.delete(`/v1/commerce/bundles/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

export function bundleErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}
