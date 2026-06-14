// Search results. Typo-tolerant, faceted search via Typesense (api-rest
// /v1/public/commerce/search). Renders a prominent search field, a facet
// sidebar driven by Typesense facet counts (brand / type / fitment / price /
// availability), result count, sort, and a paginated grid. All filter state
// lives in the URL so every result page is shareable + SSR-cacheable.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { EmptyState } from '@/components/empty-state';
import { Pagination } from '@/components/pagination';
import { ProductGrid } from '@/components/product-grid';
import { SearchFacets } from '@/components/search-facets';
import { SortSelect } from '@/components/sort-select';
import {
  searchEverything,
  searchProducts,
  type ProductSort,
  type SiteSearchHit,
} from '@/lib/commerce';
import { resolveSite } from '@/lib/site-context';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Search' };

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const PER_PAGE = 24;

const dollarsToCents = (v: string | undefined): number | undefined => {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
};

const SITE_HIT_LABEL: Record<string, string> = { collection: 'Collection', cms_page: 'Page' };
const labelForType = (t: string) => SITE_HIT_LABEL[t] ?? 'Result';

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const site = await resolveSite();
  if (!site) notFound();

  const sp = (await searchParams) ?? {};
  const q = (one(sp.q) ?? '').trim();
  const sort = (one(sp.sort) ?? 'relevance') as ProductSort;
  const page = Math.max(1, Number(one(sp.page) ?? '1') || 1);
  const minPrice = one(sp.minPrice);
  const maxPrice = one(sp.maxPrice);
  const vendor = one(sp.vendor);
  const productType = one(sp.productType);
  const fitmentMakes = one(sp.fitmentMakes);
  const fitmentModels = one(sp.fitmentModels);
  const fitmentEngines = one(sp.fitmentEngines);
  const inStock = one(sp.inStock) === 'true';

  // A search runs whenever there's a query OR any active filter — so the
  // sidebar can refine an empty query into a pure browse-by-facet experience.
  const hasCriteria =
    inStock ||
    [q, vendor, productType, fitmentMakes, fitmentModels, fitmentEngines, minPrice, maxPrice].some(
      (v) => Boolean(v)
    );

  // Kick off the universal "search everything" alongside the product search.
  // Products appear in the grid below, so the strip surfaces the rest of the
  // site (collections, CMS pages). Starts here so it runs concurrently.
  const siteSearch = q ? searchEverything(site.slug, q, 12) : Promise.resolve<SiteSearchHit[]>([]);

  const result = hasCriteria
    ? await searchProducts(site.slug, {
        q: q || undefined,
        sort,
        page,
        perPage: PER_PAGE,
        vendor,
        productType,
        fitmentMakes,
        fitmentModels,
        fitmentEngines,
        inStock: inStock || undefined,
        minPriceCents: dollarsToCents(minPrice),
        maxPriceCents: dollarsToCents(maxPrice),
      })
    : { items: [], total: 0, page: 1, perPage: PER_PAGE, facets: {} };

  const siteHits = (await siteSearch).filter((h) => h.type !== 'product');

  const totalPages = Math.max(1, Math.ceil(result.total / result.perPage));
  const { defaultCurrency: currency, defaultLocale: locale } = site.commerce;

  return (
    <div className="st-container" style={{ paddingBlock: '2rem' }}>
      <h1 className="st-h1" style={{ marginBottom: '1.25rem' }}>
        Search
      </h1>

      <form action="/search" role="search" className="st-search" style={{ maxWidth: '560px' }}>
        <svg
          className="st-search__icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search products…"
          aria-label="Search products"
        />
      </form>

      {siteHits.length > 0 ? (
        <section style={{ marginBlock: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Pages &amp; collections</h2>
          <ul
            style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.375rem' }}
          >
            {siteHits.map((h) => (
              <li key={h.url}>
                <a
                  href={h.url}
                  style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'baseline' }}
                >
                  <span>{h.title}</span>
                  <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{labelForType(h.type)}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!hasCriteria ? (
        <EmptyState
          icon="🔎"
          title="Search the catalog"
          description="Type a product name, brand, or part number above."
        />
      ) : (
        <div className="st-plp" style={{ marginTop: '1.5rem' }}>
          <aside>
            <SearchFacets
              action="/search"
              facets={result.facets}
              values={{
                q,
                sort,
                vendor,
                productType,
                fitmentMakes,
                fitmentModels,
                fitmentEngines,
                minPrice,
                maxPrice,
                inStock,
              }}
            />
          </aside>
          <div>
            <div className="st-toolbar">
              <span className="st-toolbar__count">
                {result.total} {result.total === 1 ? 'result' : 'results'}
                {q ? ` for “${q}”` : ''}
              </span>
              <SortSelect value={sort} />
            </div>
            {result.items.length === 0 ? (
              <EmptyState
                icon="🤷"
                title={q ? `No results for “${q}”` : 'No matching products'}
                description="Check your spelling or loosen the filters."
                action={{ label: 'Browse all products', href: '/products' }}
              />
            ) : (
              <>
                <ProductGrid
                  products={result.items}
                  tenantSlug={site.slug}
                  currency={currency}
                  locale={locale}
                />
                {totalPages > 1 ? (
                  <Pagination
                    basePath="/search"
                    currentParams={sp}
                    page={page}
                    totalPages={totalPages}
                  />
                ) : null}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
