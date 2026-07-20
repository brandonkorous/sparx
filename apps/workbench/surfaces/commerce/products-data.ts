'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE SHARED PRODUCT DATA LAYER
//
// One module owns every product-shaped read and write in the workbench. The six
// tabs of the detail pane and the eight product-scoped facet panes all import
// from here, and none of them may declare a query key, a fetch, or a type of
// their own for product data.
//
// That is not tidiness. Two definitions of the same row is how a list ends up
// reading a field the other one never fetched, and two spellings of the same
// query key is how a Save in one pane leaves a stale number in the pane docked
// beside it. Both failures are invisible in the surface that causes them.
//
// ── The key contract ─────────────────────────────────────────────────────
//
//   productKeys.all                     ['commerce','products']
//   productKeys.lists()                 …,'list'          every list window
//   productKeys.list(query)             …,'list',{query}  one list window
//   productKeys.facets()                …,'facets'        type/vendor/tag lookups
//   productKeys.detail(id)              …,id              the product record
//   productKeys.facet(id,'variants')    …,id,'variants'   one facet of one product
//
// Everything about ONE product nests under `productKeys.detail(id)`, so a
// coarse invalidate of that prefix refreshes the product and every facet pane
// docked against it in one call. Two panes on the same product share the cache
// entry by construction — that is the whole answer to "what happens when two
// scoped panes are open on the same product": one fetch, two renderers, and a
// write in either updates both.
//
// ── Options and variants are related, not one blob ───────────────────────
//
// A product's OPTIONS are the axes it is sold along (Size, Colour) and its
// VARIANTS are the sellable points in that space. They are separate resources
// on the server, separate query keys here, and separate tabs in the UI — an
// edit to the axes has a blast radius (removing a value destroys the SKUs
// sitting on it) that routine price entry does not.
//
// They are COUPLED, though, and the coupling is declared once in
// `DERIVED_FACETS` rather than remembered at each call site: writing the option
// lattice invalidates variants, because the server rebinds them.
//
// ── Batching, and the N+1 not to repeat ──────────────────────────────────
//
// The dashboard's product page fetches stock with one request per variant. On a
// forty-variant product that is forty round trips for one panel — and in a
// DOCKABLE app it is worse than it looks, because the operator can have Stock
// open beside the editor beside a second product, multiplying it again.
//
// So every facet here reads in ONE request keyed on the product, never a loop
// over variants. `useProductStock` is the reference: it calls
// `/v1/inventory?product_id=…`, a filter added for exactly this (see
// packages/inventory/src/services/public-api.ts). Any facet added later follows
// the same rule — if the endpoint cannot answer per-product in one call, the
// endpoint gets fixed rather than the client looping.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';

/* ── Shapes: the product itself ─────────────────────────────────────────── */

/** Stored lifecycle. `draft` is written but not on sale, `active` is on sale,
 *  `archived` is retired but kept for history. */
export type ProductStatus = 'draft' | 'active' | 'archived';

/** A row in the catalog list. Names only what the list actually reads. */
export interface ProductRow {
  id: string;
  title: string;
  handle: string;
  status: ProductStatus;
  vendor: string | null;
  productType: string | null;
  variantCount: number;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  imageUrl: string | null;
  tags: string[];
  updatedAt: string;
}

/** One product in full, as the detail pane edits it. */
export interface Product {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  status: ProductStatus;
  productType: string | null;
  vendor: string | null;
  tags: string[];
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
  /** How many option AXES this product has. Zero means a single unnamed
   *  version; anything else means the variant set is derived from the lattice
   *  and must not be added to by hand. */
  optionCount: number;
  categoryIds: string[];
  collectionIds: string[];
  /** sparx.market opt-in — read by the Channels facet. */
  marketListed: boolean;
  marketCategory: string | null;
  /** Sites this product is shown on. EMPTY means every site — the default. */
  propertyIds: string[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

/* ── Shapes: the option lattice (the AXES) ──────────────────────────────── */

/** How an option is offered on the storefront. `swatch` needs `swatchHex`;
 *  `image_swatch` needs `swatchImageId`. */
export type OptionDisplayType = 'dropdown' | 'swatch' | 'image_swatch' | 'radio' | 'segmented';

export interface ProductOptionValue {
  id: string;
  optionId: string;
  value: string;
  /** `#RRGGBB`, set by the operator through a colour control. Stored data, not
   *  a design token — this is the colour of the THING being sold. */
  swatchHex: string | null;
  swatchImageId: string | null;
  position: number;
}

export interface ProductOption {
  id: string;
  productId: string;
  name: string;
  displayType: OptionDisplayType;
  position: number;
  values: ProductOptionValue[];
}

/* ── Shapes: variants (the POINTS in that space) ────────────────────────── */

export interface Variant {
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
  /** What happens when stock runs out: `deny` blocks the sale, `continue`
   *  allows a backorder. */
  inventoryPolicy: string;
  requiresShipping: boolean;
  /** Overrides the product's own fulfilment type when set. */
  fulfillmentType: string | null;
  dropshipSourceId: string | null;
  /** Set when the price is derived from a markup rule rather than typed. A
   *  variant bound to a rule must not be repriced by hand without saying so. */
  markupRuleId: string | null;
  isDefault: boolean;
  position: number;
  /** Where this variant sits in the lattice — one option-value id per axis.
   *  Empty on a product with no options. */
  optionValueIds: string[];
  imageCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/* ── Shapes: media ──────────────────────────────────────────────────────── */

export interface ProductImage {
  id: string;
  /** The specific variant this image belongs to, or null for a product-level
   *  image shown for every variant. */
  variantId: string | null;
  mediaAssetId: string;
  position: number;
  /** The product's hero image — the one lists, cards and search show. */
  isPrimary: boolean;
  alt: string | null;
  /** Option values this image is pinned to, e.g. "show when Colour = Red". */
  optionValueIds: string[];
}

/* ── Shapes: stock ──────────────────────────────────────────────────────── */

/** One (variant × warehouse) level. A product's stock is a list of these — a
 *  variant in three warehouses is three rows, which is why the facet has to sum
 *  per variant rather than expect one row each. */
export interface ProductStockLevel {
  variantId: string;
  sku: string | null;
  productId: string;
  productTitle: string | null;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  onHand: number;
  allocated: number;
  available: number;
  reorderPoint: number | null;
  reorderQuantity: number | null;
  avgCostCents: number | null;
  updatedAt: string;
}

/* ── Shapes: lookups ────────────────────────────────────────────────────── */

/** Suggestions for the free-text lookups on the detail pane. The server merges a
 *  platform baseline with whatever this business already uses, so these are never
 *  empty and never a closed list. */
export interface ProductFacets {
  productTypes: string[];
  vendors: string[];
  tags: string[];
  taxClasses: string[];
}

/* ── The query-key contract ─────────────────────────────────────────────── */

/**
 * Every facet a product can have a pane or tab for.
 *
 * Adding one here is what reserves its cache namespace — do that in the same
 * change that registers its surface, so a facet can never exist with an
 * ad-hoc key.
 */
export type ProductFacetKey =
  | 'options'
  | 'variants'
  | 'media'
  | 'translations'
  | 'inventory'
  | 'fitment'
  | 'configurator'
  | 'b2b-pricing'
  | 'reviews'
  | 'channels'
  | 'dropship'
  | 'subscriptions';

export const productKeys = {
  all: ['commerce', 'products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (query: ProductQuery) => [...productKeys.lists(), query] as const,
  facets: () => [...productKeys.all, 'facets'] as const,
  detail: (id: string) => [...productKeys.all, id] as const,
  facet: (id: string, facet: ProductFacetKey) => [...productKeys.all, id, facet] as const,
};

/** Retained for callers that only need the root prefix. */
export const PRODUCTS_KEY = productKeys.all;

/**
 * Facets whose contents are a FUNCTION of another facet, so writing the one
 * must refresh the other.
 *
 * Declared once here rather than remembered at each mutation, because the
 * failure mode is silent: rebuild the option lattice, and the variants pane
 * docked beside it goes on showing SKUs bound to option values that no longer
 * exist.
 */
const DERIVED_FACETS: Partial<Record<ProductFacetKey, ProductFacetKey[]>> = {
  // The server rebinds variants when the lattice is replaced, and media
  // pinned to an option value loses its binding with it.
  options: ['variants', 'media'],
  // A new variant needs a stock row; a retired one stops having one. Media is
  // per-variant too.
  variants: ['inventory', 'media'],
};

/* ── Queries ────────────────────────────────────────────────────────────── */

/** Server-side sort. The list is paged, so sorting the loaded window in the
 *  browser would sort ONE page and present it as the answer — "cheapest product"
 *  would hand back the cheapest one on page three. */
export type ProductSortKey = 'updatedAt' | 'title' | 'priceMinCents';
export type SortDirection = 'asc' | 'desc';

export interface ProductQuery {
  q?: string;
  status?: ProductStatus;
  /** Include retired products. The server hides them unless asked. */
  includeArchived?: boolean;
  sortBy: ProductSortKey;
  order: SortDirection;
  take: number;
  skip: number;
}

export function useProducts(query: ProductQuery) {
  return useQuery({
    queryKey: productKeys.list(query),
    queryFn: () =>
      api.list<ProductRow>('/v1/commerce/products', {
        ...(query.q ? { q: query.q } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.includeArchived ? { include_archived: true } : {}),
        sort_by: query.sortBy,
        order: query.order,
        take: query.take,
        skip: query.skip,
      }),
    // Keeps the current window on screen while the next one loads, so paging and
    // re-sorting don't blink the table out to an empty state and back.
    placeholderData: (previous) => previous,
  });
}

/**
 * The product record itself — read by the detail pane AND by every scoped pane
 * through `useProductScope`. One key, so eight docked panes are one request.
 *
 * A 404 is meaningful to callers (it means deleted, not broken), so it is NOT
 * retried into a generic failure — see `isNotFound` in product-scope.tsx.
 */
export function useProduct(id: string) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => api.get<Product>(`/v1/commerce/products/${id}`),
    // 'new' is the detail pane before the product exists — nothing to fetch.
    enabled: id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/** The AXES this product is sold along. Separate from variants deliberately. */
export function useProductOptions(productId: string) {
  return useQuery({
    queryKey: productKeys.facet(productId, 'options'),
    queryFn: () => api.get<ProductOption[]>(`/v1/commerce/products/${productId}/variants/options`),
    enabled: productId !== 'new',
  });
}

/** The sellable SKUs. Each carries `optionValueIds` placing it in the lattice. */
export function useProductVariants(productId: string) {
  return useQuery({
    queryKey: productKeys.facet(productId, 'variants'),
    queryFn: () => api.get<Variant[]>(`/v1/commerce/products/${productId}/variants`),
    enabled: productId !== 'new',
  });
}

/** Every image on the product, product-level and per-variant, in one call. */
export function useProductMedia(productId: string) {
  return useQuery({
    queryKey: productKeys.facet(productId, 'media'),
    queryFn: () => api.get<ProductImage[]>(`/v1/commerce/products/${productId}/images`),
    enabled: productId !== 'new',
  });
}

/**
 * Every stock level for this product — all its variants, all warehouses, ONE
 * request.
 *
 * This is the batching rule made concrete. The obvious implementation is a
 * query per variant, and it is what the dashboard does; at forty variants that
 * is forty round trips to render one panel, and the workbench can have this
 * pane open twice. `take: 200` is the endpoint's ceiling and comfortably clears
 * the largest realistic product (a variant in three warehouses is three rows,
 * so the true limit is ~66 variants); beyond that the answer is a paged facet
 * pane, never a loop.
 */
export function useProductStock(productId: string) {
  return useQuery({
    queryKey: productKeys.facet(productId, 'inventory'),
    queryFn: () =>
      api.list<ProductStockLevel>('/v1/inventory', { product_id: productId, take: 200 }),
    enabled: productId !== 'new',
  });
}

/** Long-lived: these are suggestion lists, not live state, and re-fetching them
 *  per keystroke of a lookup would be absurd. */
export function useProductFacets() {
  return useQuery({
    queryKey: productKeys.facets(),
    queryFn: () => api.get<ProductFacets>('/v1/commerce/products/facets'),
    staleTime: 5 * 60_000,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

/**
 * The ONE way anything in this cluster says "that changed".
 *
 * Call it with the facet you wrote and it refreshes that facet, anything
 * derived from it, the product record, and the lists — because a price, a
 * status or a variant count all show in more than one place. Panes must not
 * hand-roll `invalidateQueries` for product data: the derived-facet coupling is
 * exactly the part that gets forgotten.
 */
export function useInvalidateProduct() {
  const queryClient = useQueryClient();

  return (productId?: string, facet?: ProductFacetKey) => {
    // A list row shows title, status, price range and variant count, so almost
    // any write moves it.
    void queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    if (!productId) return;
    void queryClient.invalidateQueries({ queryKey: productKeys.detail(productId) });
    if (!facet) return;
    for (const derived of DERIVED_FACETS[facet] ?? []) {
      void queryClient.invalidateQueries({ queryKey: productKeys.facet(productId, derived) });
    }
  };
}

/* ── Mutations: the product ─────────────────────────────────────────────── */

/** What create sends. A price is required even though the product row has no
 *  price column, because the first variant is created with it — a product nobody
 *  can buy is not a product anyone meant to make. */
export interface NewProduct {
  title: string;
  handle?: string;
  status: ProductStatus;
  priceCents: number;
  sku: string;
}

/**
 * Raised when the product was created but its first variant was not.
 *
 * A half-created product is a real outcome, not a hypothetical: the two are
 * separate writes because `POST /products` rejects an inline `variants` array.
 * The id travels with the error so the caller can land on the product that DOES
 * exist rather than telling someone nothing happened and letting them make a
 * second one.
 */
export class VariantAfterCreateError extends Error {
  constructor(
    readonly productId: string,
    /** The failure the price call actually returned — carried so the caller can
     *  show the server's own sentence rather than this class's summary. Named
     *  `reason` rather than `cause`, which is a member of Error itself. */
    readonly reason: unknown
  ) {
    super('The product was added, but its price could not be saved.');
    this.name = 'VariantAfterCreateError';
  }
}

export function useCreateProduct() {
  const invalidate = useInvalidateProduct();
  return useMutation({
    mutationFn: async (input: NewProduct) => {
      const created = await api.post<{ id: string; handle: string }>('/v1/commerce/products', {
        title: input.title,
        ...(input.handle ? { handle: input.handle } : {}),
        status: input.status,
      });
      try {
        await api.post(`/v1/commerce/products/${created.id}/variants`, {
          sku: input.sku,
          priceCents: input.priceCents,
          isDefault: true,
        });
      } catch (error) {
        throw new VariantAfterCreateError(created.id, error);
      }
      return created;
    },
    onSuccess: (created) => {
      invalidate(created.id, 'variants');
    },
    onError: (error) => {
      // A half-created product still changed the catalog, so the list must not
      // keep showing the world as it was before.
      if (error instanceof VariantAfterCreateError) invalidate(error.productId, 'variants');
    },
  });
}

/** Everything the detail pane's tabs write to the product record itself.
 *  Partial: an omitted field is left alone by the server, and `null` clears one. */
export interface ProductPatch {
  title?: string;
  handle?: string;
  description?: string | null;
  productType?: string | null;
  vendor?: string | null;
  tags?: string[];
  taxClass?: string | null;
  originCountry?: string | null;
  hsCode?: string | null;
  requiresShipping?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImageId?: string | null;
  propertyIds?: string[];
  categoryIds?: string[];
  collectionIds?: string[];
}

export function useUpdateProduct(id: string) {
  const invalidate = useInvalidateProduct();
  return useMutation({
    mutationFn: (patch: ProductPatch) => api.patch<Product>(`/v1/commerce/products/${id}`, patch),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/** Put it on sale, or take it off sale. Two endpoints rather than a status PATCH
 *  because publishing also refreshes the search + sitemap snapshots server-side. */
export function usePublishProduct(id: string) {
  const invalidate = useInvalidateProduct();
  return useMutation({
    mutationFn: (published: boolean) =>
      api.post(`/v1/commerce/products/${id}/${published ? 'publish' : 'unpublish'}`),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/** Retire it without losing it. Archived products keep their order history and
 *  can be brought back. */
export function useArchiveProduct(id: string) {
  const invalidate = useInvalidateProduct();
  return useMutation({
    mutationFn: (archived: boolean) =>
      api.post(`/v1/commerce/products/${id}/${archived ? 'archive' : 'restore'}`),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDeleteProduct(id: string) {
  const invalidate = useInvalidateProduct();
  return useMutation({
    mutationFn: () => api.delete(`/v1/commerce/products/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/* ── Mutations: variants ────────────────────────────────────────────────── */

export interface NewVariant {
  sku: string;
  priceCents: number;
  compareAtPriceCents?: number | null;
  costCents?: number | null;
  /** Where in the lattice this variant sits — one option-value id per axis.
   *  Required on a product WITH options; the server rejects a set that does not
   *  span every axis exactly once. Omit only on an option-less product. */
  optionValueIds?: string[];
  isDefault?: boolean;
}

export function useCreateVariant(productId: string) {
  const invalidate = useInvalidateProduct();
  return useMutation({
    mutationFn: (input: NewVariant) =>
      api.post<{ id: string; sku: string }>(`/v1/commerce/products/${productId}/variants`, {
        sku: input.sku,
        priceCents: input.priceCents,
        ...(input.compareAtPriceCents != null
          ? { compareAtPriceCents: input.compareAtPriceCents }
          : {}),
        ...(input.costCents != null ? { costCents: input.costCents } : {}),
        ...(input.optionValueIds ? { optionValueIds: input.optionValueIds } : {}),
        ...(input.isDefault ? { isDefault: true } : {}),
      }),
    onSuccess: () => {
      invalidate(productId, 'variants');
    },
  });
}

/** Everything on a variant except its code, which has its own endpoint. */
export interface VariantPatch {
  title?: string | null;
  barcode?: string | null;
  priceCents?: number;
  compareAtPriceCents?: number | null;
  costCents?: number | null;
  weight?: number | null;
  dimensions?: { lengthMm?: number; widthMm?: number; heightMm?: number };
  inventoryPolicy?: string;
  requiresShipping?: boolean;
  fulfillmentType?: string | null;
  dropshipSourceId?: string | null;
  position?: number;
}

/**
 * Save one variant.
 *
 * The code (SKU) has its OWN endpoint, because it is unique across the whole
 * business and a clash has to come back as a conflict naming the offending code
 * rather than as a silent no-op. So a variant whose code changed is two calls,
 * and the rename goes FIRST: if it clashes, nothing else has been written and
 * the operator sees the real problem instead of a half-saved row.
 */
export function useUpdateVariant(productId: string) {
  const invalidate = useInvalidateProduct();
  return useMutation({
    mutationFn: async (input: { id: string; sku?: string; patch: VariantPatch }) => {
      if (input.sku) {
        await api.post(`/v1/commerce/variants/${input.id}/rename-sku`, { sku: input.sku });
      }
      await api.patch(`/v1/commerce/variants/${input.id}`, input.patch);
    },
    onSuccess: () => {
      invalidate(productId, 'variants');
    },
  });
}

/** Retire one variant. Archived, never deleted — a variant is referenced by every
 *  order that ever contained it. */
export function useArchiveVariant(productId: string) {
  const invalidate = useInvalidateProduct();
  return useMutation({
    mutationFn: (variantId: string) => api.post(`/v1/commerce/variants/${variantId}/archive`),
    onSuccess: () => {
      invalidate(productId, 'variants');
    },
  });
}

export function useSetDefaultVariant(productId: string) {
  const invalidate = useInvalidateProduct();
  return useMutation({
    mutationFn: (variantId: string) => api.post(`/v1/commerce/variants/${variantId}/default`),
    onSuccess: () => {
      invalidate(productId, 'variants');
    },
  });
}

/* ── Mutations: the option lattice ──────────────────────────────────────── */

export interface OptionValueInput {
  value: string;
  swatchHex?: string;
  swatchImageId?: string;
  position: number;
}

export interface OptionInput {
  name: string;
  displayType: OptionDisplayType;
  position: number;
  values: OptionValueInput[];
}

/**
 * Replaces the product's ENTIRE option lattice in one transaction.
 *
 * There is no "add one value" endpoint — the server drops the existing options,
 * values, and the variant-to-value assignments that referenced them, then
 * inserts the new set. Variant ROWS survive, but they come out unbound and must
 * be re-placed with `useAssignVariantOptions`.
 *
 * That blast radius is why Options is its own tab and why this is the one write
 * in this file that must never be issued without a confirm naming what is lost.
 */
export function useSetProductOptions(productId: string) {
  const invalidate = useInvalidateProduct();
  return useMutation({
    mutationFn: (options: OptionInput[]) =>
      api.post(`/v1/commerce/products/${productId}/variants/options`, { options }),
    onSuccess: () => {
      invalidate(productId, 'options');
    },
  });
}

/** Places one variant at a point in the lattice. */
export function useAssignVariantOptions(productId: string) {
  const invalidate = useInvalidateProduct();
  return useMutation({
    mutationFn: (input: { variantId: string; optionValueIds: string[] }) =>
      api.post('/v1/commerce/variants/assign-options', input),
    onSuccess: () => {
      invalidate(productId, 'variants');
    },
  });
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

/**
 * The server's own sentence for a 4xx, which is worth showing verbatim: these
 * routes explain the actual problem ("SKU \"ABC-1\" already exists", "Handle is
 * already taken") far better than anything this side could infer from a status
 * code. A 5xx carries no such sentence, so it falls back to the caller's wording.
 */
export function productErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof VariantAfterCreateError) {
    return productErrorMessage(error.reason, fallback);
  }
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}

/* ── Saying what a state means ──────────────────────────────────────────── */

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/**
 * Is this on sale? In the words an owner would use.
 *
 * "Active" and "draft" are the stored words, and neither says what is actually
 * true of the thing: whether a shopper can find it and buy it today.
 */
export function productState(product: {
  status: ProductStatus;
  variantCount?: number;
  priceMinCents?: number | null;
}): { label: string; tone: Tone; detail: string } {
  if (product.status === 'archived') {
    return {
      label: 'Retired',
      tone: 'neutral',
      detail:
        'This product is off your website and cannot be bought. Past orders containing it are unaffected, and you can put it back on sale at any time.',
    };
  }
  if (product.status === 'active') {
    // On sale but priceless is a real state the platform allows, and it is the
    // one worth shouting about: the product is live and nobody can buy it.
    if (product.variantCount === 0 || product.priceMinCents == null) {
      return {
        label: 'No price set',
        tone: 'warning',
        detail:
          'This product is meant to be on sale, but it has no price, so nobody can buy it. Set one on the Variants tab to fix that.',
      };
    }
    return {
      label: 'On sale',
      tone: 'success',
      detail: 'Shoppers can find this product on your website and buy it.',
    };
  }
  return {
    label: 'Not on sale',
    tone: 'info',
    detail:
      'This is saved but hidden — nobody can see it on your website yet. Put it on sale when you are ready.',
  };
}

/* ── Formatting ─────────────────────────────────────────────────────────── */

export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}

/** What a product costs, in one phrase. A product whose variants differ in price
 *  has a RANGE, and collapsing it to the lowest number tells a half-truth on the
 *  one screen where the number matters. */
export function priceLabel(product: {
  priceMinCents: number | null;
  priceMaxCents: number | null;
}): string {
  const { priceMinCents: min, priceMaxCents: max } = product;
  if (min == null) return 'No price';
  if (max == null || max === min) return formatCents(min);
  return `${formatCents(min)} – ${formatCents(max)}`;
}

/** A handle is the part of a web address that identifies this product, so it is
 *  lowercase, digits and hyphens — matching what api-rest derives from a title. */
export function slugifyHandle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 127);
}

/** A first product code, derived from the title, so nobody has to invent one to
 *  get started. Stays fully editable — a business with its own coding scheme
 *  types theirs over the top. */
export function suggestSku(title: string): string {
  const base = title
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20);
  return base === '' ? '' : `${base}-1`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
}
