import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';

import { Badge, Stack, Tabs, TabsContent, TabsList, TabsTrigger } from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import { listProperties, type Property } from '@/lib/sites';

import { DetailHeaderSlot } from '../../../_components/detail-header-slot';

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

// Tenant storefronts live at <slug>.sparx.zone (same origin the CMS preview
// uses). Env-overridable for non-prod zones.
const ZONE_DOMAIN = process.env.NEXT_PUBLIC_SPARX_ZONE_DOMAIN ?? 'sparx.zone';

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

  return (
    <>
      {/* Identity (name + handle) lives ONLY in the editable Title/Handle fields
          on the Overview tab — no read-only header restating them. Status + the
          lifecycle actions teleport into the active frame's header bar. An active
          product gets a live storefront link; a draft/archived one gets a
          token-based draft Preview (it has no public page yet). */}
      <DetailHeaderSlot>
        <ProductStatusBar
          productId={product.id}
          status={product.status}
          hasVariants={product.variantCount > 0}
        />
        {product.status === 'active' ? (
          <a
            href={`https://${tenant.slug}.${ZONE_DOMAIN}/products/${product.handle}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--module-active)]"
          >
            View on storefront
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <ProductPreviewButton
            productId={product.id}
            handle={product.handle}
            tenantSlug={tenant.slug}
          />
        )}
      </DetailHeaderSlot>

      <Tabs defaultValue="overview">
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
      </Tabs>
    </>
  );
}
