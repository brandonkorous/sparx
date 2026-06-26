// Shared searchParams → PLP query normalization. /products, the category
// landing pages, and /search all read the same facet vocabulary (q, category,
// sort, price range, in-stock, page), so the parsing lives here once and returns
// both the API fetch params (cents) and the facet control state (dollar strings).

import type { ListProductsParams, MarketSort } from './market';
import type { PlpFacetState } from '@/components/plp-facets';

export type RawSearchParams = Record<string, string | string[] | undefined>;

const SORTS = new Set<MarketSort>([
  'relevance',
  'newest',
  'lowest_price',
  'highest_price',
  'rating',
]);

export const PLP_PER_PAGE = 24;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Trim a raw param and collapse a now-empty string to undefined (an absent
 *  filter), so `?q=` and a missing `q` read identically. */
function trimmed(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t && t.length > 0 ? t : undefined;
}

function dollarsToCents(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
}

/** Parse the shared PLP filter vocabulary. `forcedCategory` pins the category on
 *  a category landing page (the URL there has no `?category=`). */
export function parsePlpParams(
  sp: RawSearchParams,
  forcedCategory?: string
): {
  query: ListProductsParams;
  facetState: PlpFacetState;
  page: number;
} {
  const q = trimmed(one(sp.q));
  const category = forcedCategory ?? one(sp.category);
  const rawSort = one(sp.sort);
  const sort: MarketSort =
    rawSort && SORTS.has(rawSort as MarketSort) ? (rawSort as MarketSort) : 'relevance';
  const minPrice = one(sp.minPrice);
  const maxPrice = one(sp.maxPrice);
  const inStock = one(sp.inStock) === 'true';
  const page = Math.max(1, Number(one(sp.page) ?? '1') || 1);

  const query: ListProductsParams = {
    ...(q ? { q } : {}),
    ...(category ? { category } : {}),
    sort,
    ...(dollarsToCents(minPrice) !== undefined ? { minPriceCents: dollarsToCents(minPrice) } : {}),
    ...(dollarsToCents(maxPrice) !== undefined ? { maxPriceCents: dollarsToCents(maxPrice) } : {}),
    ...(inStock ? { inStock: true } : {}),
    page,
  };

  const facetState: PlpFacetState = {
    ...(q ? { q } : {}),
    ...(category ? { category } : {}),
    sort,
    ...(minPrice ? { minPrice } : {}),
    ...(maxPrice ? { maxPrice } : {}),
    inStock,
  };

  return { query, facetState, page };
}
