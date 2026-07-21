// The product listing experience — the pinned `commerce.plp` core (docs/122). It IS the
// shared `ScopedProductBrowser` (facet panel + sort + grid + pagination) with NO scope, so
// it lists the whole catalog. The collection and category detail pages render the SAME
// browser scoped to a collection/category, so all three surfaces share one faceted-listing
// implementation (docs/127 §8). The /products route drops this into an editable silica
// shell via a host node; the tenant surrounds the listing (intro copy, trust bar) without
// touching the facet/query logic. All filter state stays in the URL.

import { ScopedProductBrowser, type SearchParams } from './scoped-product-browser';
import type { ResolvedSite } from '@/lib/site-context';

export type { SearchParams };

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export async function ProductListing({
  site,
  searchParams,
}: {
  site: ResolvedSite;
  searchParams: SearchParams;
}) {
  // The heading is query-dependent, so the core owns it (not the shell).
  const q = one(searchParams.q);
  return (
    <ScopedProductBrowser
      site={site}
      searchParams={searchParams}
      basePath="/products"
      heading={q ? `Results for “${q}”` : 'All products'}
    />
  );
}
