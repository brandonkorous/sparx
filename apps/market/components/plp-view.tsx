// Shared PLP layout: facet sidebar + results toolbar + product grid + pager.
// Server component used by /products, the category landing pages, and /search.
// It owns the catalog fetch given a normalized param bag, so each page just maps
// its searchParams into ListProductsParams and hands it here.

import { listProducts, type ListProductsParams, type MarketSort } from '@/lib/market';
import { MarketPager } from './market-pager';
import { ProductGrid } from './product-grid';
import { PlpFacets, PlpSort, type PlpFacetState } from './plp-facets';

export interface PlpViewProps {
  /** Route the facet controls + pager push to (e.g. '/products', '/auto'). */
  basePath: string;
  /** The raw searchParams (for the pager's query preservation). */
  searchParams: Record<string, string | string[] | undefined>;
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
  searchParams,
  query,
  facetState,
  perPage,
  lockCategory = false,
  emptyTitle,
  emptyHint,
}: PlpViewProps) {
  const result = await listProducts({ ...query, perPage });
  const totalPages = Math.max(1, Math.ceil(result.total / result.perPage));
  const sort: MarketSort = query.sort ?? 'relevance';

  return (
    <div className="mx-plp">
      <aside>
        <PlpFacets basePath={basePath} state={facetState} lockCategory={lockCategory} />
      </aside>

      <div>
        <div className="mx-toolbar">
          <span className="mx-toolbar__count">
            {result.total.toLocaleString()} {result.total === 1 ? 'product' : 'products'}
          </span>
          <PlpSort basePath={basePath} sort={sort} />
        </div>

        <ProductGrid products={result.items} emptyTitle={emptyTitle} emptyHint={emptyHint} />

        <MarketPager
          basePath={basePath}
          searchParams={searchParams}
          page={result.page}
          totalPages={totalPages}
        />
      </div>
    </div>
  );
}
