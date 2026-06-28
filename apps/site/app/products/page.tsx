// Product listing page (PLP). Faceted, sortable, paginated — all state lives
// in the URL so every variant is SSR-cacheable. Filters: price, availability,
// generalized fitment (a level-by-level node drill + numeric range narrowing),
// free-text search. Sort + pagination via query params.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/breadcrumbs';
import { FacetPanel, type FacetValues, type FitmentLevel } from '@/components/facet-panel';
import { Pagination } from '@/components/pagination';
import { ProductGrid } from '@/components/product-grid';
import { SortSelect } from '@/components/sort-select';
import {
  listFitmentDomains,
  listFitmentNodes,
  listProducts,
  type ProductSort,
  type PublicFitmentDomain,
  type PublicFitmentNode,
} from '@/lib/commerce';
import { resolveSite } from '@/lib/site-context';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Shop all products' };

type SearchParams = Record<string, string | string[] | undefined>;

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

// Resolve the fitment level drill from the URL. Walks the domain's `level`
// dimensions in order: level 0 = the domain's top-level nodes; each subsequent
// level loads the children of the node selected at the previous level (read
// from fl0, fl1, …). Stops once a level has no selection or the picked node is a
// leaf — so the panel only ever shows reachable tiers. Returns the resolved
// chain plus the deepest selected node (its name drives the product filter).
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

export default async function ProductsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const site = await resolveSite();
  if (!site) notFound();

  const sp = (await searchParams) ?? {};
  const q = one(sp.q);
  const sort = (one(sp.sort) ?? 'relevance') as ProductSort;
  const minPrice = one(sp.minPrice);
  const maxPrice = one(sp.maxPrice);
  const inStock = one(sp.inStock) === 'true';
  const fitmentDomain = one(sp.fitmentDomain);
  const page = Math.max(1, Number(one(sp.page) ?? '1') || 1);

  // Load the fitment domains, resolve the active one + its level drill chain so
  // the facet panel can render domain-appropriate labels and range widgets.
  const domains = await listFitmentDomains(site.slug).catch<PublicFitmentDomain[]>(() => []);
  const activeDomain = domains.find((d) => d.slug === fitmentDomain) ?? domains[0] ?? null;
  const { levels, selectedNode } = activeDomain
    ? await resolveFitmentLevels(site.slug, activeDomain, sp)
    : { levels: [], selectedNode: null };

  // The deepest selected node's NAME narrows the catalog (the API matches it
  // against node ancestry). The first `range` value (year/weight/size) narrows
  // numerically — the listing filter carries a single range axis.
  const rangeDims = activeDomain?.dimensions.filter((d) => d.kind === 'range') ?? [];
  const fitmentRanges: Record<string, string> = {};
  for (const dim of rangeDims) {
    const v = one(sp[dim.key]);
    if (v) fitmentRanges[dim.key] = v;
  }
  const primaryRange = rangeDims.map((d) => fitmentRanges[d.key]).find((v) => v) ?? undefined;

  const result = await listProducts(site.slug, {
    ...(q ? { q } : {}),
    sort,
    ...(minPrice ? { minPriceCents: dollarsToCents(minPrice) } : {}),
    ...(maxPrice ? { maxPriceCents: dollarsToCents(maxPrice) } : {}),
    ...(inStock ? { inStock: true } : {}),
    ...(selectedNode ? { fitmentNodeName: selectedNode.name } : {}),
    ...(primaryRange ? { fitmentRangeValue: Number(primaryRange) } : {}),
    page,
    perPage: PER_PAGE,
  });

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
    <div className="st-container">
      <Breadcrumbs
        items={[{ label: 'Home', href: '/' }, { label: q ? `Search: ${q}` : 'All products' }]}
      />

      <header style={{ marginBottom: '0.5rem' }}>
        <h1 className="st-h1">{q ? `Results for “${q}”` : 'All products'}</h1>
      </header>

      <div className="st-plp">
        <aside>
          <FacetPanel
            action="/products"
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
              basePath="/products"
              currentParams={sp}
              page={page}
              totalPages={totalPages}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
