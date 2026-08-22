// The faceted, sortable, paginated product LISTING — the one implementation, shared by
// every browse surface (docs/127 §8). The `/products` PLP renders it whole-catalog; the
// collection and category detail pages render it SCOPED (to a collection's membership or a
// category's browse-node rollup) by passing `scope`. All three go through Typesense, so the
// facet panel is DATA-DERIVED: brand, type, tags, and each product-option axis (Color,
// Size, …) come back as live facet COUNTS from the tenant's own catalog — nothing hardcoded
// — alongside the generic fitment drill and price / availability.
//
// All state lives in the URL (`?sort=&minPrice=&inStock=&vendor=&options=…&fl0=&page=`), so
// every variant is a distinct, SSR-cacheable page and the facet form/pager are plain links
// + a GET form — no client JS. `basePath` points the facet form + pager at the current
// route so filters stay on THIS surface; `scope` narrows the search to a collection/category.

import { ButtonLink } from '@/components/button-link';
import { BrowseFacets, type BrowseFacetValues } from '@/components/products/browse-facets';
import type { FitmentLevel } from '@/components/facet-panel';
import { Pagination } from '@/components/pagination';
import { ProductGrid } from '@/components/product-grid';
import { SortSelect } from '@/components/sort-select';
import {
  listFitmentDomains,
  listFitmentNodes,
  searchProducts,
  type ProductSearchFilters,
  type ProductSort,
  type PublicFitmentDomain,
  type PublicFitmentNode,
} from '@/lib/commerce';
import type { ResolvedSite } from '@/lib/site-context';

export type SearchParams = Record<string, string | string[] | undefined>;

/** What the listing is scoped to. Omitted → the whole catalog (the PLP). */
export interface BrowseScope {
  collection?: string;
  category?: string;
}

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** A repeatable param → a trimmed string list (option-axis selections arrive this way). */
function many(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return (Array.isArray(v) ? v : [v]).map((s) => s.trim()).filter(Boolean);
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
// deepest selected node and its level index (which drives the fitment filter bucket).
async function resolveFitmentLevels(
  tenantSlug: string,
  domain: PublicFitmentDomain,
  sp: SearchParams
): Promise<{
  levels: FitmentLevel[];
  selectedNode: PublicFitmentNode | null;
  selectedDepth: number;
}> {
  const levelDims = domain.dimensions.filter((d) => d.kind === 'level');
  const levels: FitmentLevel[] = [];
  let selectedNode: PublicFitmentNode | null = null;
  let selectedDepth = -1;
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
    selectedDepth = i;
    if (picked.childCount === 0) break; // leaf — no deeper tier to drill
    parentId = picked.id;
  }

  return { levels, selectedNode, selectedDepth };
}

export async function ScopedProductBrowser({
  site,
  searchParams,
  basePath,
  scope,
  /** Optional page heading rendered above the two-column layout. The PLP passes its
   *  query-dependent title; the collection/category cores render their own richer header
   *  and omit this. */
  heading,
}: {
  site: ResolvedSite;
  searchParams: SearchParams;
  basePath: string;
  scope?: BrowseScope;
  heading?: string;
}) {
  const sp = searchParams;
  const q = (one(sp.q) ?? '').trim();
  const sort = (one(sp.sort) ?? 'relevance') as ProductSort;
  const minPrice = one(sp.minPrice);
  const maxPrice = one(sp.maxPrice);
  const inStock = one(sp.inStock) === 'true';
  const vendor = one(sp.vendor);
  const productType = one(sp.productType);
  const tag = one(sp.tag);
  const options = many(sp.options);
  const fitmentDomainSlug = one(sp.fitmentDomain);
  const page = Math.max(1, Number(one(sp.page) ?? '1') || 1);

  // Resolve the fitment domain + drill chain so the panel can render the applicability
  // filter and the deepest selection can narrow the search.
  const domains = await listFitmentDomains(site.slug).catch<PublicFitmentDomain[]>(() => []);
  const activeDomain = domains.find((d) => d.slug === fitmentDomainSlug) ?? domains[0] ?? null;
  const { levels, selectedNode, selectedDepth } = activeDomain
    ? await resolveFitmentLevels(site.slug, activeDomain, sp)
    : { levels: [], selectedNode: null, selectedDepth: -1 };

  // The deepest selected node narrows by its depth bucket (0 → makes, 1 → models, 2+ →
  // engines — the same depth buckets the index projection uses). A `range` value narrows
  // numerically.
  const rangeDims = activeDomain?.dimensions.filter((d) => d.kind === 'range') ?? [];
  const fitmentRanges: Record<string, string> = {};
  for (const dim of rangeDims) {
    const v = one(sp[dim.key]);
    if (v) fitmentRanges[dim.key] = v;
  }
  const primaryRange = rangeDims.map((d) => fitmentRanges[d.key]).find((v) => v) ?? undefined;

  const fitmentName = selectedNode?.name;
  const filters: ProductSearchFilters = {
    ...(q ? { q } : {}),
    sort,
    ...(scope?.collection ? { collection: scope.collection } : {}),
    ...(scope?.category ? { category: scope.category } : {}),
    ...(vendor ? { vendor } : {}),
    ...(productType ? { productType } : {}),
    ...(tag ? { tag } : {}),
    ...(options.length > 0 ? { options } : {}),
    ...(inStock ? { inStock: true } : {}),
    ...(minPrice ? { minPriceCents: dollarsToCents(minPrice) } : {}),
    ...(maxPrice ? { maxPriceCents: dollarsToCents(maxPrice) } : {}),
    ...(fitmentName && selectedDepth === 0 ? { fitmentMakes: fitmentName } : {}),
    ...(fitmentName && selectedDepth === 1 ? { fitmentModels: fitmentName } : {}),
    ...(fitmentName && selectedDepth >= 2 ? { fitmentEngines: fitmentName } : {}),
    ...(primaryRange ? { fitmentYear: Number(primaryRange) } : {}),
    page,
    perPage: PER_PAGE,
  };
  const result = await searchProducts(site.slug, filters);

  const totalPages = Math.max(1, Math.ceil(result.total / result.perPage));
  const { defaultCurrency: currency, defaultLocale: locale } = site.commerce;

  const facetValues: BrowseFacetValues = {
    q: q || undefined,
    sort,
    vendor,
    productType,
    tag,
    minPrice,
    maxPrice,
    inStock,
    options,
    ...(activeDomain ? { fitmentDomain: activeDomain.slug } : {}),
    fitmentRanges,
  };

  return (
    <>
      {heading ? (
        <header className="mb-2">
          <h1 className="text-base-content text-4xl font-semibold tracking-tight">{heading}</h1>
        </header>
      ) : null}

      <div className="grid grid-cols-[248px_minmax(0,1fr)] items-start gap-[clamp(1.5rem,3vw,3rem)] py-[clamp(1.5rem,4vw,3rem)] max-[900px]:grid-cols-1">
        {/* Once the two columns stack, the filters go BELOW the products. A phone that
            opens on a price box and a checkbox has buried the thing the shopper came
            for; the toolbar's "Filter" jumps down to them. */}
        <aside className="max-[900px]:order-2 max-[900px]:pt-2">
          <BrowseFacets
            action={basePath}
            facets={result.facets}
            values={facetValues}
            domains={domains}
            activeDomain={activeDomain}
            levels={levels}
          />
        </aside>

        <div className="max-[900px]:order-1">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <span className="text-base-content text-base">
              {result.total} {result.total === 1 ? 'product' : 'products'}
            </span>
            <div className="flex items-center gap-3">
              <span className="min-[901px]:hidden">
                <ButtonLink href="#browse-filters" variant="outline" prefetch={false}>
                  Filter
                </ButtonLink>
              </span>
              <SortSelect value={sort} />
            </div>
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
