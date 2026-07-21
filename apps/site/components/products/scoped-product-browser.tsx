// The faceted, sortable, paginated product LISTING — the one implementation, shared by
// every browse surface (docs/127 §8). The `/products` PLP renders it whole-catalog; the
// collection and category detail pages render it SCOPED (to a collection's membership or
// a category's browse-node rollup) by passing `scope`. Before this, only `/products` had
// facets — a collection page was a bare grid. Now the same facet panel, sort toolbar,
// grid, and pagination back all three, so narrowing "hoodies under $80, in stock" works
// inside a collection exactly as it does across the catalog.
//
// All state lives in the URL (`?sort=&minPrice=&inStock=&fl0=…&page=`), so every variant
// is a distinct, SSR-cacheable page and the facet form/pager are plain links + a GET form
// — no client JS required. `basePath` points the facet form + pager at the current route
// so filters stay on THIS surface; `scope` is threaded into the listing query.

import { FacetPanel, type FacetValues, type FitmentLevel } from '@/components/facet-panel';
import { Pagination } from '@/components/pagination';
import { ProductGrid } from '@/components/product-grid';
import { SortSelect } from '@/components/sort-select';
import {
  listFitmentDomains,
  listFitmentNodes,
  listProducts,
  type ProductListFilters,
  type ProductSort,
  type PublicFitmentDomain,
  type PublicFitmentNode,
} from '@/lib/commerce';
import type { ResolvedSite } from '@/lib/site-context';

export type SearchParams = Record<string, string | string[] | undefined>;

/** What the listing is scoped to. Omitted → the whole catalog (the PLP). A collection
 *  handle → that collection's members; a category handle → that category's browse-node
 *  rollup (self + descendants). Exactly one is meaningful at a time. */
export interface BrowseScope {
  collection?: string;
  category?: string;
}

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// Dollar string → integer cents, ignoring junk.
function dollarsToCents(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
}

const PER_PAGE = 24;

// Resolve the fitment level drill from the URL. Walks the domain's `level` dimensions in
// order: level 0 = the domain's top-level nodes; each subsequent level loads the children
// of the node selected at the previous level (read from fl0, fl1, …). Stops once a level
// has no selection or the picked node is a leaf. Returns the resolved chain plus the
// deepest selected node (its name drives the product filter).
async function resolveFitmentLevels(
  tenantSlug: string,
  domain: PublicFitmentDomain,
  sp: SearchParams
): Promise<{ levels: FitmentLevel[]; selectedNode: PublicFitmentNode | null }> {
  const levelDims = domain.dimensions.filter((d) => d.kind === 'level');
  const levels: FitmentLevel[] = [];
  let selectedNode: PublicFitmentNode | null = null;
  let parentId: string | undefined;

  for (let i = 0; i < levelDims.length; i++) {
    const dimension = levelDims[i]!;
    const nodes = await listFitmentNodes(tenantSlug, domain.id, parentId).catch<
      PublicFitmentNode[]
    >(() => []);
    if (nodes.length === 0) break;

    const selectedId = one(sp[`fl${i}`]) ?? '';
    const picked = nodes.find((n) => n.id === selectedId) ?? null;
    levels.push({ dimension, nodes, selectedId: picked ? picked.id : '' });

    if (!picked) break;
    selectedNode = picked;
    if (picked.childCount === 0) break; // leaf — no deeper tier to drill
    parentId = picked.id;
  }

  return { levels, selectedNode };
}

export async function ScopedProductBrowser({
  site,
  searchParams,
  basePath,
  scope,
  /** Optional page heading rendered above the two-column layout. The PLP passes its
   *  query-dependent title; the collection/category cores render their own richer header
   *  (hero, breadcrumbs) and omit this. */
  heading,
}: {
  site: ResolvedSite;
  searchParams: SearchParams;
  basePath: string;
  scope?: BrowseScope;
  heading?: string;
}) {
  const sp = searchParams;
  const q = one(sp.q);
  const sort = (one(sp.sort) ?? 'relevance') as ProductSort;
  const minPrice = one(sp.minPrice);
  const maxPrice = one(sp.maxPrice);
  const inStock = one(sp.inStock) === 'true';
  const fitmentDomain = one(sp.fitmentDomain);
  const page = Math.max(1, Number(one(sp.page) ?? '1') || 1);

  // Load the fitment domains, resolve the active one + its level drill chain so the facet
  // panel can render domain-appropriate labels and range widgets.
  const domains = await listFitmentDomains(site.slug).catch<PublicFitmentDomain[]>(() => []);
  const activeDomain = domains.find((d) => d.slug === fitmentDomain) ?? domains[0] ?? null;
  const { levels, selectedNode } = activeDomain
    ? await resolveFitmentLevels(site.slug, activeDomain, sp)
    : { levels: [], selectedNode: null };

  // The deepest selected node's NAME narrows the catalog (the API matches it against node
  // ancestry). The first `range` value (year/weight/size) narrows numerically.
  const rangeDims = activeDomain?.dimensions.filter((d) => d.kind === 'range') ?? [];
  const fitmentRanges: Record<string, string> = {};
  for (const dim of rangeDims) {
    const v = one(sp[dim.key]);
    if (v) fitmentRanges[dim.key] = v;
  }
  const primaryRange = rangeDims.map((d) => fitmentRanges[d.key]).find((v) => v) ?? undefined;

  const filters: ProductListFilters = {
    ...(q ? { q } : {}),
    sort,
    ...(minPrice ? { minPriceCents: dollarsToCents(minPrice) } : {}),
    ...(maxPrice ? { maxPriceCents: dollarsToCents(maxPrice) } : {}),
    ...(inStock ? { inStock: true } : {}),
    ...(selectedNode ? { fitmentNodeName: selectedNode.name } : {}),
    ...(primaryRange ? { fitmentRangeValue: Number(primaryRange) } : {}),
    // The scope — narrows the whole listing to a collection's members or a category's
    // rollup. Omitted for the whole-catalog PLP.
    ...(scope?.collection ? { collection: scope.collection } : {}),
    ...(scope?.category ? { category: scope.category } : {}),
    page,
    perPage: PER_PAGE,
  };
  const result = await listProducts(site.slug, filters);

  const totalPages = Math.max(1, Math.ceil(result.total / result.perPage));
  const { defaultCurrency: currency, defaultLocale: locale } = site.commerce;

  const facetValues: FacetValues = {
    q,
    sort,
    minPrice,
    maxPrice,
    inStock,
    ...(activeDomain ? { fitmentDomain: activeDomain.slug } : {}),
    fitmentRanges,
  };

  return (
    <>
      {heading ? (
        <header style={{ marginBottom: '0.5rem' }}>
          <h1 className="st-h1">{heading}</h1>
        </header>
      ) : null}

      <div className="st-plp">
        <aside>
          <FacetPanel
            action={basePath}
            domains={domains}
            activeDomain={activeDomain}
            levels={levels}
            values={facetValues}
          />
        </aside>

        <div>
          <div className="st-toolbar">
            <span className="st-toolbar__count">
              {result.total} {result.total === 1 ? 'product' : 'products'}
            </span>
            <SortSelect value={sort} />
          </div>

          <ProductGrid
            products={result.items}
            tenantSlug={site.slug}
            currency={currency}
            locale={locale}
          />

          {totalPages > 1 ? (
            <Pagination
              basePath={basePath}
              currentParams={sp}
              page={page}
              totalPages={totalPages}
            />
          ) : null}
        </div>
      </div>
    </>
  );
}
