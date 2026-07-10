import { PackageOpen, Plus } from 'lucide-react';

import { Badge, Card, EmptyState } from '@wizeworks/silicaui-react';
import { ListPageShell, PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { resolveSiteScope, resolvePropertyFilter } from '@/lib/sites';
import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { parsePageParams } from '@/lib/pagination';
import { ProductsSelectionTable } from './_components/products-selection-table';
import { ProductsImportExport } from './_components/products-import-export';
import { BulkPriceRevertBanner } from './_components/bulk-price-revert-banner';
import type { ReversibleOp } from './_lib/bulk-price-types';
import { getUserPreferences } from '../../_shell/preferences';

interface ProductListItem {
  id: string;
  title: string;
  handle: string;
  status: string;
  vendor: string | null;
  productType: string | null;
  variantCount: number;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  updatedAt: string;
}

// Typesense product search document (the subset this list needs). Returned by
// /v1/search/products — typo-tolerant across title / handle / vendor / SKU.
interface ProductSearchDoc {
  product_id: string;
  title: string;
  handle: string;
  status: 'draft' | 'active' | 'archived';
  vendor?: string;
  product_type?: string;
  price_min_cents: number;
  price_max_cents: number;
  updated_at: number; // epoch seconds
}

// Products index — the pilot for the ListToolbar (docs/34 §7.1): live search +
// quick filters + sort + Table/Cards toggle, all driven through the query
// string. Filters live in the URL so saved views / shared links serialize
// cleanly; the toggle falls back to the user's `defaultListView` preference.

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

const SORT_OPTIONS = [
  { value: 'updatedAt', label: 'Recently updated' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'createdAt', label: 'Newest' },
];

export default async function ProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { page, perPage, skip, take } = parsePageParams(params);
  const status = parseStatus(stringParam(params.status));
  // vendor / tag / type stay URL-readable for deep links; the toolbar surfaces
  // status + search + sort. Search covers title / handle / vendor.
  const vendor = stringParam(params.vendor);
  const tag = stringParam(params.tag);
  const productType = stringParam(params.type);
  const q = stringParam(params.q);
  const sortBy = stringParam(params.sort_by) ?? 'updatedAt';
  // Selecting the Archived status implies surfacing archived rows at all.
  const includeArchived = status === 'archived' || stringParam(params.archived) === '1';
  // Model B (docs/49 §3): the back-office Site filter — which site's catalog to
  // show (products VISIBLE on it: global + scoped-there). Only offered to
  // multi-site tenants. Switching the global site switcher shifts this list:
  // absent `?site=` → the ACTIVE site; `?site=all` → the whole catalog; a
  // specific id → that site (a per-list override of the global switch).
  const siteParam = stringParam(params.site);

  // Resolve the active site BEFORE the fetch so the list defaults to it (the
  // switch drives the catalog). prefs is needed later for the view toggle.
  const [prefs, scope, reversibleOps] = await Promise.all([
    getUserPreferences(),
    resolveSiteScope(),
    api
      .get<ReversibleOp[]>('/v1/commerce/products/bulk-price/reversible')
      .catch(() => [] as ReversibleOp[]),
  ]);
  // Most-recent bulk price op still inside its 30-minute undo window (B-3).
  const latestRevert = reversibleOps[0] ?? null;
  const { sites, multiSite, activePropertyId } = scope;
  // Single-site tenants never filter (no behavior change). Multi-site: explicit
  // `?site=` wins, `all` clears, absent follows the active site.
  const propertyFilter = resolvePropertyFilter(scope, siteParam);

  // With a query, search via Typesense (typo-tolerant across title / handle /
  // vendor / SKU); without one, list straight from Postgres with the status
  // facet + sort. variantCount isn't indexed, so search rows render it as —.
  let products: ProductListItem[];
  let total: number;
  if (q) {
    const sq = new URLSearchParams({
      q,
      page: String(page),
      per_page: String(perPage),
      ...(propertyFilter ? { property: propertyFilter } : {}),
    });
    const { data, meta } = await api.getPaged<ProductSearchDoc[]>(
      `/v1/search/products?${sq.toString()}`
    );
    products = data.map((d) => ({
      id: d.product_id,
      title: d.title,
      handle: d.handle,
      status: d.status,
      vendor: d.vendor ?? null,
      productType: d.product_type ?? null,
      variantCount: Number.NaN, // not indexed — rendered as —
      priceMinCents: d.price_min_cents,
      priceMaxCents: d.price_max_cents,
      updatedAt: new Date(d.updated_at * 1000).toISOString(),
    }));
    total = (meta?.total as number | undefined) ?? products.length;
  } else {
    const { data, meta } = await api.getPaged<ProductListItem[]>(
      `/v1/commerce/products?${new URLSearchParams({
        take: String(take),
        skip: String(skip),
        sort_by: sortBy,
        ...(includeArchived ? { include_archived: 'true' } : {}),
        ...(status ? { status } : {}),
        ...(vendor ? { vendor } : {}),
        ...(tag ? { tag } : {}),
        ...(productType ? { product_type: productType } : {}),
        ...(propertyFilter ? { property: propertyFilter } : {}),
      }).toString()}`
    );
    products = data;
    total = (meta?.total as number | undefined) ?? products.length;
  }
  // `?view=` overrides; absent → the user's saved default (§7.2).
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';
  // The Site filter only makes sense once a tenant runs more than one site. It
  // defaults to the active site (so the chip mirrors the global switcher) with
  // an explicit "All sites" escape.
  const siteFilter = multiSite
    ? [
        {
          key: 'site',
          label: 'Site',
          defaultValue: activePropertyId,
          options: [
            { value: 'all', label: 'All sites' },
            ...sites.map((s) => ({ value: s.id, label: s.name })),
          ],
        },
      ]
    : [];

  return (
    <ListPageShell
      header={
        <PageHeader
          icon={<PackageOpen className="h-5 w-5" />}
          title="Products"
          badge={
            <Badge color="module">
              {total} product{total === 1 ? '' : 's'}
            </Badge>
          }
          description="Your catalog. Variants, options, fitment, and configurator templates hang off each product. Draft → Active publishes to the storefront; archived rows stay searchable but render as 410."
          className="mb-0"
        />
      }
      toolbar={
        <>
          <ListToolbar
            searchPlaceholder="Search title, handle, or vendor…"
            filters={[{ key: 'status', label: 'Statuses', options: STATUS_OPTIONS }, ...siteFilter]}
            sortOptions={SORT_OPTIONS}
            enableViewToggle
            actions={<ProductsImportExport />}
            primaryAction={
              <EntityCreateButton
                entityType="product"
                newHref="/commerce/products/new"
                color="module"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
              >
                New
              </EntityCreateButton>
            }
          />
          {latestRevert ? <BulkPriceRevertBanner op={latestRevert} /> : null}
        </>
      }
      pager={<ListPager total={total} />}
    >
      {products.length === 0 ? (
        <Card>
          <EmptyState
            icon={<PackageOpen className="h-5 w-5" />}
            title={total === 0 ? 'No products yet' : 'No products match these filters'}
            description={
              total === 0
                ? 'Start your catalog with a single product. Variants, options, and fitment can be added after the basics are saved.'
                : 'Adjust filters or clear the search to broaden the results.'
            }
            actions={
              total === 0 ? (
                <EntityCreateButton
                  entityType="product"
                  newHref="/commerce/products/new"
                  color="module"
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  New
                </EntityCreateButton>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <ProductsSelectionTable products={products} view={view} />
      )}
    </ListPageShell>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}

function parseStatus(v: string | undefined): 'draft' | 'active' | 'archived' | undefined {
  return v === 'draft' || v === 'active' || v === 'archived' ? v : undefined;
}
