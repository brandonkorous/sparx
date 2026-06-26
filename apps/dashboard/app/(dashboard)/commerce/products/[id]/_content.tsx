import { notFound } from 'next/navigation';

import {
  Badge,
  Heading,
  ModuleProvider,
  Stack,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import { listProperties, type Property } from '@/lib/sites';

import { DetailHeaderSlot } from '../../../_components/detail-header-slot';
import { GuardedTabs } from '../../../_components/guarded-tabs';

import type { ProductImageRow } from '../../variant-actions';

import { ConfiguratorPanel, type ConfiguratorTemplateRow } from './_components/configurator-panel';
import { FitmentPanel } from './_components/fitment-panel';
import { InventoryPanel } from './_components/inventory-panel';
import { ProductEditForm } from './_components/product-edit-form';
import type { ProductFacets } from './_components/product-facets';
import { ProductMediaPanel } from './_components/product-media-panel';
import { ProductPricingPanel } from './_components/product-pricing-panel';
import type { BulkTierRow } from './_components/product-bulk-tiers-editor';
import { ProductPreviewButton } from './_components/product-preview-button';
import { ProductSeoForm } from './_components/product-seo-form';
import { ProductStatusBar } from './_components/product-status-bar';
import { ProductSummaryRail } from './_components/product-summary-rail';
import { VariantsPanel } from './_components/variants-panel';

type ProductStatus = 'active' | 'draft' | 'archived';

interface ProductDetail {
  id: string;
  tenantId: string;
  title: string;
  handle: string;
  description: string | null;
  status: ProductStatus;
  productType: string | null;
  vendor: string | null;
  tags: string[];
  // Model B (docs/49 §3): web PROPERTIES this product is scoped to (empty = all).
  propertyIds?: string[];
  fulfillmentType: string;
  weightGrams: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  hazmatClass: string;
  requiresShipping: boolean;
  taxClass: string | null;
  originCountry: string | null;
  hsCode: string | null;
  metadata: Record<string, unknown>;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageId: string | null;
  defaultWarehouseId: string | null;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  inStock: boolean;
  averageRating: number | null;
  reviewCount: number;
  variantCount: number;
  optionCount: number;
  categoryIds: string[];
  collectionIds: string[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

interface OptionValueRow {
  id: string;
  optionId: string;
  value: string;
  swatchHex: string | null;
  swatchImageId: string | null;
  position: number;
}

interface OptionRow {
  id: string;
  productId: string;
  name: string;
  displayType: string;
  position: number;
  values: OptionValueRow[];
}

interface VariantRow {
  id: string;
  productId: string;
  sku: string;
  barcode: string | null;
  title: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  costCents: number | null;
  currency: string;
  weightGrams: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  inventoryPolicy: string;
  requiresShipping: boolean;
  fulfillmentType: string | null;
  dropshipSourceId: string | null;
  isDefault: boolean;
  position: number;
  metadata: Record<string, unknown>;
  markupRuleId: string | null;
  optionValueIds: string[];
  imageCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface MarkupRuleSummary {
  id: string;
  name: string;
  isActive: boolean;
  appliesTo: 'catalog' | 'document' | 'both';
}

interface ProductFitmentRow {
  id: string;
  productId: string;
  domainId: string;
  domainSlug: string;
  categoryId: string;
  categoryName: string;
  itemId: string | null;
  itemName: string | null;
  variantId: string | null;
  variantName: string | null;
  rangeMin: number | null;
  rangeMax: number | null;
  notes: string | null;
}

interface FitmentDomainRow {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  iconKey: string | null;
  labels: { l1: string; l2?: string; l3?: string; range?: string };
  rangeUnit: string | null;
  isGlobal: boolean;
  categoryCount: number;
}

interface WarehouseRow {
  id: string;
  name: string;
  code: string;
  type: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface InventoryLevelRow {
  variantId: string;
  warehouseId: string;
  warehouseCode: string;
  onHand: number;
  allocated: number;
  available: number;
  reorderPoint: number | null;
  reorderQuantity: number | null;
  leadTimeDays: number | null;
  unitCostCents: number | null;
  updatedAt: string;
}

// Detail content for a commerce product. Mounted by both the full-page
// route and the dashboard shell's drawer / modal. Container width + back
// link live in page.tsx.

export const dynamic = 'force-dynamic';

interface Props {
  id: string;
}

export async function ProductDetailContent({ id }: Props) {
  let product: ProductDetail;
  try {
    product = await api.get<ProductDetail>(`/v1/commerce/products/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  // Dropship-imported products stamp the source supplier in metadata. Used to
  // label vendor-priced variants on the Pricing tab with the real supplier name.
  const dropshipSupplierId =
    typeof product.metadata?.dropshipSupplierId === 'string'
      ? product.metadata.dropshipSupplierId
      : null;

  const [
    options,
    variants,
    fitments,
    domains,
    warehouses,
    sites,
    markupRulesRaw,
    tenant,
    images,
    supplierName,
    bulkTiers,
    facets,
    configuratorTemplates,
  ] = await Promise.all([
    api.get<OptionRow[]>(`/v1/commerce/products/${id}/variants/options`),
    api.get<VariantRow[]>(`/v1/commerce/products/${id}/variants?include_archived=true`),
    api.get<ProductFitmentRow[]>(`/v1/commerce/products/${id}/fitment`),
    api.get<FitmentDomainRow[]>('/v1/commerce/fitment/domains'),
    // Inventory is its own module (rides free with Commerce, so the gate passes);
    // the product Inventory tab reads warehouses + levels from /v1/inventory/*.
    api.get<WarehouseRow[]>('/v1/inventory/locations'),
    // Multi-site (docs/49 §3): the "Visible on sites" control. Defensive — a
    // failed read just hides the control (single-site behavior).
    listProperties().catch(() => [] as Property[]),
    // Catalog markup rules for the per-variant "Price by rule" control (docs/48).
    api.get<MarkupRuleSummary[]>('/v1/markup-rules').catch(() => [] as MarkupRuleSummary[]),
    // Tenant slug for the Media tab's public-media redirect URLs (works for
    // both stored uploads and hot-linked dropship images).
    api.get<{ slug: string }>('/v1/tenant'),
    // Product images — drives the Media tab's count badge and seeds the gallery
    // so it paints without a client round-trip.
    api
      .get<ProductImageRow[]>(`/v1/commerce/products/${id}/images`)
      .catch(() => [] as ProductImageRow[]),
    // Dropship supplier name for the Pricing tab's "Priced by" label. Defensive
    // — a non-dropship product, a disabled dropship module, or a deleted
    // supplier all degrade to the generic "Vendor" label.
    dropshipSupplierId
      ? api
          .get<{ name: string }>(`/v1/dropship/suppliers/${dropshipSupplierId}`)
          .then((s) => s.name)
          .catch(() => null)
      : Promise.resolve(null),
    // Variant-scoped bulk price tiers for the Pricing tab. Defensive — a failed
    // read degrades to an empty editor rather than breaking the whole detail view.
    api
      .get<BulkTierRow[]>(`/v1/commerce/bulk-tiers?product_id=${id}`)
      .catch(() => [] as BulkTierRow[]),
    // Open-ended option sets for the Overview tab's smart lookups (type, vendor,
    // tags, tax class). Defensive — a failed read degrades to empty suggestions
    // (the lookups still accept free text), never breaking the detail view.
    api
      .get<ProductFacets>('/v1/commerce/products/facets')
      .catch(() => ({ productTypes: [], vendors: [], tags: [], taxClasses: [] })),
    // Configurator templates bound to this product (docs/09). Defensive — a
    // failed read or disabled feature degrades to the empty-state CTA.
    api
      .get<ConfiguratorTemplateRow[]>(`/v1/commerce/products/${id}/configurator-templates`)
      .catch(() => [] as ConfiguratorTemplateRow[]),
  ]);

  // Only catalog-applying, active rules can price a variant inline.
  const markupRules = markupRulesRaw
    .filter((r) => r.isActive && r.appliesTo !== 'document')
    .map((r) => ({ id: r.id, name: r.name }));

  const inventoryLevels = await Promise.all(
    variants.map(async (variant) => ({
      variantId: variant.id,
      sku: variant.sku,
      variantTitle: variant.title,
      levels: await api.get<InventoryLevelRow[]>(`/v1/inventory/levels/variant/${variant.id}`),
    }))
  );

  // Roll up every variant×warehouse level for the context rail. null when the
  // tenant tracks no warehouses, so the rail drops the section rather than
  // implying a real zero on-hand. Currency comes off the first priced variant.
  const inventorySummary =
    warehouses.length === 0
      ? null
      : inventoryLevels.reduce(
          (acc, v) => {
            for (const l of v.levels) {
              acc.onHand += l.onHand;
              acc.available += l.available;
              if (l.reorderPoint !== null && l.available <= l.reorderPoint) acc.belowReorder += 1;
            }
            return acc;
          },
          { onHand: 0, available: 0, belowReorder: 0 }
        );
  const railCurrency = variants.find((v) => v.currency)?.currency ?? 'USD';

  // Shared props for the context rail — rendered twice (a full-height aside on a
  // wide host, a stacked card on a narrow one), same content, mirroring how the
  // wizard renders its summary in both places.
  const railProps = {
    handle: product.handle,
    productType: product.productType,
    vendor: product.vendor,
    priceMinCents: product.priceMinCents,
    priceMaxCents: product.priceMaxCents,
    currency: railCurrency,
    variantCount: product.variantCount,
    optionCount: product.optionCount,
    mediaCount: images.length,
    inventory: inventorySummary,
    fitmentCount: fitments.length,
    categoryCount: product.categoryIds.length,
    collectionCount: product.collectionIds.length,
    siteScope:
      sites.length > 1 ? { scoped: (product.propertyIds ?? []).length, total: sites.length } : null,
    averageRating: product.averageRating,
    reviewCount: product.reviewCount,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };

  return (
    <>
      {/* The surface's accessible name. Visually hidden so identity stays "shown
          once" in the editable Title field (no visible read-only restatement),
          but screen readers + the document outline still get a real h1 to anchor
          the h2 section headings beneath it — the frame chrome label is a span. */}
      <Heading level={1} as="h1" className="sr-only">
        {product.title}
      </Heading>

      {/* Identity (name + handle) lives ONLY in the editable Title/Handle fields
          on the Overview tab — no read-only header restating them. Status + the
          lifecycle actions teleport into the active frame's header bar, plus a
          Preview that works for any status (the token relaxes the published-only
          filter, so it shows a draft before it's live and the current state of an
          active product) — short enough to fit where "View on storefront" didn't. */}
      <DetailHeaderSlot>
        <ProductStatusBar
          productId={product.id}
          status={product.status}
          hasVariants={product.variantCount > 0}
        />
        <ProductPreviewButton
          productId={product.id}
          handle={product.handle}
          tenantSlug={tenant.slug}
        />
      </DetailHeaderSlot>

      {/* Tabbed editor (left, scrolls) + a persistent product CONTEXT RAIL (right) —
          the SAME full-height two-pane the create wizard uses (docs/86), so the
          summary fills its column edge-to-edge instead of floating as a card. The
          ModuleProvider is the flex + @container parent and tints the summary
          Commerce orange. Responsive: two panes on a wide host (modal / full page),
          collapsing to one (the summary stacks under the tabs) on a narrow drawer. */}
      <ModuleProvider module="commerce" className="@container flex h-full min-h-0">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-[var(--color-bg-subtle)]">
          <div className="p-6">
            <GuardedTabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="variants">
                  Variants
                  {product.variantCount > 0 && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      {product.variantCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="media">
                  Media
                  {images.length > 0 && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      {images.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="pricing">Pricing</TabsTrigger>
                <TabsTrigger value="inventory">Inventory</TabsTrigger>
                <TabsTrigger value="fitment">Fitment</TabsTrigger>
                <TabsTrigger value="configurator">Configurator</TabsTrigger>
                <TabsTrigger value="seo">SEO</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <Stack gap={6}>
                  <ProductEditForm
                    product={product}
                    sites={sites}
                    initialPropertyIds={product.propertyIds ?? []}
                    facets={facets}
                  />
                </Stack>
              </TabsContent>

              <TabsContent value="variants">
                <VariantsPanel
                  productId={product.id}
                  productTitle={product.title}
                  options={options}
                  variants={variants}
                  markupRules={markupRules}
                />
              </TabsContent>

              <TabsContent value="media">
                <ProductMediaPanel
                  productId={product.id}
                  tenantSlug={tenant.slug}
                  initialImages={images}
                />
              </TabsContent>

              <TabsContent value="pricing">
                <ProductPricingPanel
                  variants={variants}
                  markupRules={markupRules}
                  supplierName={supplierName}
                  tiers={bulkTiers}
                />
              </TabsContent>

              <TabsContent value="inventory">
                <InventoryPanel
                  productId={product.id}
                  variantsWithLevels={inventoryLevels}
                  warehouses={warehouses.map((w) => ({ id: w.id, code: w.code, name: w.name }))}
                />
              </TabsContent>

              <TabsContent value="fitment">
                <FitmentPanel
                  productId={product.id}
                  productTitle={product.title}
                  fitments={fitments}
                  domains={domains.map((d) => ({
                    id: d.id,
                    slug: d.slug,
                    displayName: d.displayName,
                    labels: d.labels,
                    rangeUnit: d.rangeUnit,
                  }))}
                />
              </TabsContent>

              <TabsContent value="configurator">
                <ConfiguratorPanel productId={product.id} templates={configuratorTemplates} />
              </TabsContent>

              <TabsContent value="seo">
                <ProductSeoForm
                  productId={product.id}
                  title={product.title}
                  handle={product.handle}
                  description={product.description}
                  seoTitle={product.seoTitle}
                  seoDescription={product.seoDescription}
                />
              </TabsContent>
            </GuardedTabs>

            {/* Narrow host: the aside is hidden, so the summary stacks here under
                the tabs as a tinted card. */}
            <div className="mt-6 @[820px]:hidden">
              <div className="rounded-lg border border-[var(--color-border-default)] bg-[color-mix(in_oklab,var(--module-active)_6%,var(--color-bg-surface))] p-5">
                <ProductSummaryRail {...railProps} />
              </div>
            </div>
          </div>
        </div>

        {/* Wide host: full-height summary aside, edge-to-edge with a left border —
            the identical treatment to the wizard's draft-summary column. */}
        <aside className="hidden w-[300px] shrink-0 overflow-y-auto border-l border-[var(--color-border-default)] bg-[color-mix(in_oklab,var(--module-active)_6%,var(--color-bg-surface))] px-6 py-6 @[820px]:block">
          <ProductSummaryRail {...railProps} />
        </aside>
      </ModuleProvider>
    </>
  );
}
