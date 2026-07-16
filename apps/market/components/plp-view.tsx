// Shared PLP layout: facet sidebar (with live counts) + results toolbar + product
// grid + numbered pager. Server component used by /products, the category landing
// pages, and /search. It owns BOTH catalog reads — the page of results and the
// facet tallies — from a normalized param bag, fetched in parallel, so each page
// just maps its searchParams into ListProductsParams and hands them here.

import { listProducts, listFacets, type ListProductsParams, type MarketSort } from '@/lib/market';
import { MarketPager } from './market-pager';
import { ProductGrid } from './product-grid';
import { PlpFacets, PlpSort, type PlpFacetState } from './plp-facets';

export interface PlpViewProps {
  /** Route the facet controls + pager push to (e.g. '/products', '/auto'). */
  basePath: string;
  /** Normalized fetch params already derived from searchParams. */
  query: ListProductsParams;
  /** Facet control state (the human-facing dollar strings, not cents). */
  facetState: PlpFacetState;
  /** Page size. */
  perPage: number;
  /** Hide + lock the category facet (category landing pages). */
  lockCategory?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
}

export async function PlpView({
  basePath,
  query,
  facetState,
  perPage,
  lockCategory = false,
  emptyTitle,
  emptyHint,
}: PlpViewProps) {
  const [result, facets] = await Promise.all([
    listProducts({ ...query, perPage }),
    listFacets(query),
  ]);
  const totalPages = Math.max(1, Math.ceil(result.total / result.perPage));
  const sort: MarketSort = query.sort ?? 'relevance';

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[16rem_1fr] lg:gap-8">
      <aside className="lg:sticky lg:top-32">
        <PlpFacets
          basePath={basePath}
          state={facetState}
          counts={facets}
          lockCategory={lockCategory}
        />
      </aside>

      <div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <span className="text-base-content text-sm">
            {result.total.toLocaleString()} {result.total === 1 ? 'product' : 'products'}
          </span>
          <PlpSort basePath={basePath} sort={sort} />
        </div>

        <ProductGrid products={result.items} emptyTitle={emptyTitle} emptyHint={emptyHint} />

        <MarketPager basePath={basePath} page={result.page} totalPages={totalPages} />
      </div>
    </div>
  );
}
