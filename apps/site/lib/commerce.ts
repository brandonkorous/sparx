// Storefront commerce reads. Thin client over api-rest's
// /v1/public/commerce/* surface, mirroring lib/content.ts in shape so
// the rendering layer can treat both content + commerce reads the same
// way.

import { resolveActivePropertySlug } from './site-context';

const BASE_URL = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';

interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    per_page?: number;
    total?: number;
    total_pages?: number;
    // Search responses carry Typesense facet counts here.
    facets?: Record<string, { value: string; count: number }[]>;
  };
}

interface ErrorEnvelope {
  success: false;
  error: { code: string; message: string; request_id?: string };
}

async function publicGet<T>(
  path: string,
  query: Record<string, string | number | undefined>,
  tags: string[],
  // A draft-preview token (`?sparxPreview=` on the PDP). When present we forward
  // it as `Authorization: Preview <jwt>` and skip the cache — a preview must
  // always reflect the live draft, never a 60s-stale published snapshot.
  previewToken?: string
): Promise<{ data: T; meta?: SuccessEnvelope<T>['meta'] }> {
  const params = new URLSearchParams();
  // Model B (docs/49 §3): scope every public commerce read to the active site —
  // injected once here. Null for the primary site (api-rest defaults), so
  // single-site storefronts are unchanged. An explicit query `property` wins.
  const propertySlug = await resolveActivePropertySlug();
  if (propertySlug && query.property === undefined) params.set('property', propertySlug);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  // Coarse per-tenant tag (`commerce:<slug>`) alongside the granular ones so a
  // single revalidateTag('commerce:<slug>') purge clears all of a tenant's
  // commerce reads (revalidateTag is exact-match, not prefix). See app/api/revalidate.
  const coarse = query.tenant ? [`commerce:${String(query.tenant)}`] : [];
  const res = await fetch(`${BASE_URL}${path}?${params.toString()}`, {
    ...(previewToken
      ? { cache: 'no-store', headers: { Authorization: `Preview ${previewToken}` } }
      : { next: { revalidate: 60, tags: ['sparx-storefront', ...coarse, ...tags] } }),
  });
  const json = (await res.json()) as SuccessEnvelope<T> | ErrorEnvelope;
  if (!res.ok || 'error' in json) {
    const code = 'error' in json ? json.error.code : 'UNKNOWN';
    const message = 'error' in json ? json.error.message : `HTTP ${res.status}`;
    throw Object.assign(new Error(`api-rest ${path}: ${code}: ${message}`), { code });
  }
  return { data: json.data, meta: json.meta };
}

// ─── Types ─────────────────────────────────────────────────────────────

export interface PublicCollection {
  id: string;
  name: string;
  handle: string;
  description: string | null;
  heroMediaId: string | null;
  featured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageId?: string | null;
}

export interface PublicProductListItem {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  vendor: string | null;
  productType: string | null;
  tags: string[];
  priceMinCents: number | null;
  priceMaxCents: number | null;
  compareAtCents: number | null;
  inStock: boolean;
  averageRating: number | null;
  reviewCount: number;
  primaryImageId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
}

export interface PublicProductOptionValue {
  id: string;
  value: string;
  swatchHex: string | null;
  position: number;
}

export interface PublicProductOption {
  id: string;
  name: string;
  displayType: string;
  position: number;
  values: PublicProductOptionValue[];
}

export interface PublicProductVariant {
  id: string;
  sku: string;
  title: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  isDefault: boolean;
  inventoryPolicy: string;
  optionValueIds: string[];
  /** Summed available across every warehouse. */
  available: number;
  /** True when stock is available OR the variant accepts back-orders. */
  inStock: boolean;
}

export interface PublicProductImage {
  id: string;
  mediaAssetId: string;
  variantId: string | null;
  alt: string | null;
  position: number;
  optionValueIds: string[];
}

/** One axis of a fitment domain (its shape). `level` dimensions form the node
 *  tree in declared order; `range` dimensions are numeric narrowing axes
 *  (Year/Weight/Shoe size). `unit` is an optional hint for the range widget. */
export interface PublicFitmentDimension {
  key: string;
  label: string;
  kind: 'level' | 'range';
  unit?: string;
}

// One applicability row on a product, in the generalized fitment model.
// `domainLabel` is the merchant-facing noun for this vertical (e.g. "Vehicle",
// "Pet"); `nodeName`/`nodePath` are the deepest level node + its ancestry
// (root → self), or null/[] for a universal (whole-domain) rule; `ranges`
// carry a numeric window per range dimension (year/weight/size span — the unit
// lives on the matching dimension in `dimensions`).
export interface PublicProductFitmentRange {
  dimensionKey: string;
  min: number | null;
  max: number | null;
}

export interface PublicProductFitment {
  id: string;
  domainSlug: string;
  domainLabel: string;
  dimensions: PublicFitmentDimension[];
  nodeName: string | null;
  nodePath: string[];
  ranges: PublicProductFitmentRange[];
  notes: string | null;
}

export interface PublicProduct extends PublicProductListItem {
  fulfillmentType: string;
  weightGrams: number | null;
  dimensions: { lengthMm: number | null; widthMm: number | null; heightMm: number | null } | null;
  options: PublicProductOption[];
  variants: PublicProductVariant[];
  images: PublicProductImage[];
  fitments: PublicProductFitment[];
}

export interface PublicCategoryNode {
  id: string;
  name: string;
  handle: string;
  description: string | null;
  parentId: string | null;
  path: string;
  position: number;
  featured: boolean;
}

export interface PublicFitmentDomain {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  iconKey: string | null;
  /** Ordered dimension list — `level` dims drive the node drill (in order),
   *  `range` dims drive the numeric narrowing widgets. */
  dimensions: PublicFitmentDimension[];
}

/** One node in a domain's `level` tree (a Make, a Model, an Engine — or a
 *  Species, a Breed). `dimensionKey` names which level it sits at; `childCount`
 *  tells the panel whether a deeper level exists (0 = leaf, end of the drill). */
export interface PublicFitmentNode {
  id: string;
  name: string;
  slug: string;
  dimensionKey: string;
  depth: number;
  position: number;
  childCount: number;
}

// ─── Calls ─────────────────────────────────────────────────────────────

export async function listCollections(tenantSlug: string): Promise<PublicCollection[]> {
  const { data } = await publicGet<PublicCollection[]>(
    '/v1/public/commerce/collections',
    { tenant: tenantSlug },
    [`commerce:${tenantSlug}:collections`]
  );
  return data;
}

export async function getCollection(
  tenantSlug: string,
  handle: string
): Promise<PublicCollection | null> {
  try {
    const { data } = await publicGet<PublicCollection>(
      `/v1/public/commerce/collections/${encodeURIComponent(handle)}`,
      { tenant: tenantSlug },
      [`commerce:${tenantSlug}:collection:${handle}`]
    );
    return data;
  } catch (err) {
    if ((err as { code?: string }).code === 'NOT_FOUND') return null;
    throw err;
  }
}

export async function listCollectionProducts(
  tenantSlug: string,
  handle: string,
  page = 1,
  perPage = 24
): Promise<{ items: PublicProductListItem[]; total: number; page: number; perPage: number }> {
  const { data, meta } = await publicGet<PublicProductListItem[]>(
    `/v1/public/commerce/collections/${encodeURIComponent(handle)}/products`,
    { tenant: tenantSlug, page, perPage },
    [`commerce:${tenantSlug}:collection:${handle}:products`]
  );
  return {
    items: data,
    total: meta?.total ?? data.length,
    page: meta?.page ?? page,
    perPage: meta?.per_page ?? perPage,
  };
}

export type ProductSort =
  | 'relevance'
  | 'price-asc'
  | 'price-desc'
  | 'title-asc'
  | 'title-desc'
  | 'newest';

export interface ProductListFilters {
  q?: string;
  vendor?: string;
  productType?: string;
  tag?: string;
  /** Generalized fitment filter: the NAME of any selected `level` node (a Make,
   *  Model, Engine — or a Species, Breed). The API matches it against the
   *  node's ancestry (`node.pathNames has <name>`), so picking any level narrows
   *  to that subtree. Sent on the wire as `fitmentMake` (the API param name). */
  fitmentNodeName?: string;
  /** Optional numeric narrowing against a `range` dimension (year / weight /
   *  size — the unit is implied by the active domain). Sent as `fitmentYear`. */
  fitmentRangeValue?: number;
  minPriceCents?: number;
  maxPriceCents?: number;
  inStock?: boolean;
  sort?: ProductSort;
  page?: number;
  perPage?: number;
}

export async function listProducts(
  tenantSlug: string,
  filters: ProductListFilters = {}
): Promise<{ items: PublicProductListItem[]; total: number; page: number; perPage: number }> {
  const query: Record<string, string | number | undefined> = {
    tenant: tenantSlug,
    q: filters.q,
    vendor: filters.vendor,
    productType: filters.productType,
    tag: filters.tag,
    // The listing filter reads `fitmentMake` (a node name, matched against
    // node.pathNames) + `fitmentYear` (a numeric range value). Generic over the
    // domain — the names are historical, the behaviour is name + numeric.
    fitmentMake: filters.fitmentNodeName,
    fitmentYear: filters.fitmentRangeValue,
    minPriceCents: filters.minPriceCents,
    maxPriceCents: filters.maxPriceCents,
    inStock: filters.inStock === undefined ? undefined : String(filters.inStock),
    sort: filters.sort,
    page: filters.page,
    perPage: filters.perPage,
  };
  const { data, meta } = await publicGet<PublicProductListItem[]>(
    '/v1/public/commerce/products',
    query,
    [`commerce:${tenantSlug}:products`]
  );
  return {
    items: data,
    total: meta?.total ?? data.length,
    page: meta?.page ?? filters.page ?? 1,
    perPage: meta?.per_page ?? filters.perPage ?? 24,
  };
}

// ─── Typesense search ───────────────────────────────────────────────────

export interface SearchFacetValue {
  value: string;
  count: number;
}

/** Facet counts keyed by Typesense field name (vendor, product_type, tags,
 *  fitment_makes, …). Drives the search-page filter sidebar. */
export type SearchFacets = Record<string, SearchFacetValue[]>;

export interface ProductSearchFilters {
  q?: string;
  vendor?: string;
  productType?: string;
  tag?: string;
  inStock?: boolean;
  minPriceCents?: number;
  maxPriceCents?: number;
  fitmentMakes?: string;
  fitmentModels?: string;
  fitmentEngines?: string;
  fitmentYear?: number;
  sort?: ProductSort;
  page?: number;
  perPage?: number;
}

export interface ProductSearchResult {
  items: PublicProductListItem[];
  total: number;
  page: number;
  perPage: number;
  facets: SearchFacets;
}

/** Typo-tolerant faceted product search (Typesense, via api-rest). Returns the
 *  same PublicProductListItem cards as the PLP plus facet counts for the
 *  filter sidebar. */
export async function searchProducts(
  tenantSlug: string,
  filters: ProductSearchFilters = {}
): Promise<ProductSearchResult> {
  const query: Record<string, string | number | undefined> = {
    tenant: tenantSlug,
    q: filters.q,
    vendor: filters.vendor,
    productType: filters.productType,
    tag: filters.tag,
    inStock: filters.inStock === undefined ? undefined : String(filters.inStock),
    minPriceCents: filters.minPriceCents,
    maxPriceCents: filters.maxPriceCents,
    fitmentMakes: filters.fitmentMakes,
    fitmentModels: filters.fitmentModels,
    fitmentEngines: filters.fitmentEngines,
    fitmentYear: filters.fitmentYear,
    sort: filters.sort,
    page: filters.page,
    perPage: filters.perPage,
  };
  const { data, meta } = await publicGet<PublicProductListItem[]>(
    '/v1/public/commerce/search',
    query,
    [`commerce:${tenantSlug}:search`]
  );
  const facets: SearchFacets = meta?.facets ?? {};
  return {
    items: data,
    total: meta?.total ?? data.length,
    page: meta?.page ?? filters.page ?? 1,
    perPage: meta?.per_page ?? filters.perPage ?? 24,
    facets,
  };
}

export interface SiteSearchHit {
  /** 'product' | 'collection' | 'cms_page' */
  type: string;
  title: string;
  subtitle: string | null;
  url: string;
}

/** Public "search everything" across the storefront (products, collections,
 *  CMS pages) via the universal index. Degrades to an empty list rather than
 *  throwing — it's a supplementary strip beside the product grid, never
 *  load-bearing. */
export async function searchEverything(
  tenantSlug: string,
  q: string,
  perPage = 20
): Promise<SiteSearchHit[]> {
  if (!q.trim()) return [];
  try {
    const { data } = await publicGet<{ results: SiteSearchHit[]; total: number }>(
      '/v1/public/search',
      { tenant: tenantSlug, q, perPage },
      [`commerce:${tenantSlug}:search`]
    );
    return data.results;
  } catch {
    return [];
  }
}

/** Products related to the given one: same product type, self excluded.
 *  Falls back to an empty list rather than throwing — it's a nice-to-have
 *  section, never load-bearing. */
export async function listRelatedProducts(
  tenantSlug: string,
  product: Pick<PublicProduct, 'id' | 'productType'>,
  limit = 4
): Promise<PublicProductListItem[]> {
  if (!product.productType) return [];
  try {
    const { items } = await listProducts(tenantSlug, {
      productType: product.productType,
      perPage: limit + 1,
    });
    return items.filter((p) => p.id !== product.id).slice(0, limit);
  } catch {
    return [];
  }
}

/** Hydrate a hand-picked set of products by id, in the requested order.
 *  Backs Site Builder's manual featured-products source. Unknown/inactive ids
 *  are dropped by the API. Returns [] (never throws) so a section degrades to
 *  empty rather than erroring the whole page. */
export async function getProductsByIds(
  tenantSlug: string,
  ids: string[]
): Promise<PublicProductListItem[]> {
  if (ids.length === 0) return [];
  try {
    const { data } = await publicGet<PublicProductListItem[]>(
      '/v1/public/commerce/products/by-ids',
      { tenant: tenantSlug, ids: ids.join(',') },
      [`commerce:${tenantSlug}:products`]
    );
    return data;
  } catch {
    return [];
  }
}

/** Hydrate FULL products (options + variants + images) for the Builder data spine
 *  (docs/98 Pillar 7) — by a hand-picked id list (entity pins, order preserved), a
 *  collection id, a category id, or — with none of those — the whole catalog (the
 *  `all` source), capped by `limit`. Returns [] (never throws) so a builder page
 *  degrades to empty rather than erroring. */
export async function getProductsFull(
  tenantSlug: string,
  opts: { ids?: string[]; collection?: string; category?: string; limit?: number } = {}
): Promise<PublicProduct[]> {
  if (opts.ids?.length === 0) return [];
  try {
    const { data } = await publicGet<PublicProduct[]>(
      '/v1/public/commerce/products/full',
      {
        tenant: tenantSlug,
        ids: opts.ids && opts.ids.length > 0 ? opts.ids.join(',') : undefined,
        collection: opts.collection,
        category: opts.category,
        limit: opts.limit,
      },
      [`commerce:${tenantSlug}:products`]
    );
    return data;
  } catch {
    return [];
  }
}

/** A collection / category OWN-record (docs/98 Pillar 7 record-display) — its own
 *  fields, NOT its products. `heroMediaId` resolves to an image via `mediaUrl`. */
export interface PublicEntityRecord {
  id: string;
  name: string;
  handle: string;
  description: string | null;
  heroMediaId: string | null;
}

/** Hydrate collection OWN-records by id (record-display pins), order preserved.
 *  Returns [] (never throws) so a builder page degrades to empty. */
export async function getCollectionRecordsFull(
  tenantSlug: string,
  ids: string[]
): Promise<PublicEntityRecord[]> {
  if (ids.length === 0) return [];
  try {
    const { data } = await publicGet<PublicEntityRecord[]>(
      '/v1/public/commerce/collections/full',
      { tenant: tenantSlug, ids: ids.join(',') },
      [`commerce:${tenantSlug}:collections`]
    );
    return data;
  } catch {
    return [];
  }
}

/** Hydrate category OWN-records by id (record-display pins), order preserved. */
export async function getCategoryRecordsFull(
  tenantSlug: string,
  ids: string[]
): Promise<PublicEntityRecord[]> {
  if (ids.length === 0) return [];
  try {
    const { data } = await publicGet<PublicEntityRecord[]>(
      '/v1/public/commerce/categories/full',
      { tenant: tenantSlug, ids: ids.join(',') },
      [`commerce:${tenantSlug}:categories`]
    );
    return data;
  } catch {
    return [];
  }
}

export async function getProduct(
  tenantSlug: string,
  handle: string,
  // When set (the editor opened a `?sparxPreview=` link), the read is authorized
  // to return a DRAFT product and bypasses the cache.
  previewToken?: string
): Promise<PublicProduct | null> {
  try {
    const { data } = await publicGet<PublicProduct>(
      `/v1/public/commerce/products/${encodeURIComponent(handle)}`,
      { tenant: tenantSlug },
      [`commerce:${tenantSlug}:product:${handle}`],
      previewToken
    );
    return data;
  } catch (err) {
    if ((err as { code?: string }).code === 'NOT_FOUND') return null;
    throw err;
  }
}

export interface PublicQuestionAnswer {
  id: string;
  body: string;
  isOfficial: boolean;
  createdAt: string;
}

export interface PublicQuestion {
  id: string;
  displayName: string | null;
  body: string;
  createdAt: string;
  helpfulCount: number;
  answers: PublicQuestionAnswer[];
}

/** Published Q&A for a product (questions + merchant answers). Returns [] on
 *  failure — the PDP Q&A block is supplementary, never load-bearing. */
export interface PublicReview {
  id: string;
  rating: number;
  title: string;
  body: string;
  author: string | null;
  verifiedPurchase: boolean;
  helpfulCount: number;
  response: string | null;
  respondedAt: string | null;
  createdAt: string;
}

export interface PublicReviewList {
  summary: { averageRating: number; total: number };
  items: PublicReview[];
}

/** Approved reviews for a product (newest first) + the live rating summary.
 *  Returns an empty list on failure — the PDP reviews block degrades to its
 *  summary/empty state rather than erroring the whole page. */
export async function listProductReviews(
  tenantSlug: string,
  handle: string
): Promise<PublicReviewList> {
  try {
    const { data } = await publicGet<PublicReviewList>(
      `/v1/public/commerce/products/${encodeURIComponent(handle)}/reviews`,
      { tenant: tenantSlug },
      [`commerce:${tenantSlug}:product:${handle}:reviews`]
    );
    return data;
  } catch {
    return { summary: { averageRating: 0, total: 0 }, items: [] };
  }
}

export async function listProductQuestions(
  tenantSlug: string,
  handle: string
): Promise<PublicQuestion[]> {
  try {
    const { data } = await publicGet<PublicQuestion[]>(
      `/v1/public/commerce/products/${encodeURIComponent(handle)}/questions`,
      { tenant: tenantSlug },
      [`commerce:${tenantSlug}:product:${handle}:questions`]
    );
    return data;
  } catch {
    return [];
  }
}

export async function listFitmentDomains(tenantSlug: string): Promise<PublicFitmentDomain[]> {
  const { data } = await publicGet<PublicFitmentDomain[]>(
    '/v1/public/commerce/fitment/domains',
    { tenant: tenantSlug },
    [`commerce:${tenantSlug}:fitment:domains`]
  );
  return data;
}

/** Drill the domain's `level` node tree. Absent `parentId` → the top-level
 *  nodes (first level dimension); a node id → that node's children (the next
 *  level). One call walks any depth, so the storefront facet stays generic
 *  over `dimensions` — no per-vertical endpoints. */
export async function listFitmentNodes(
  tenantSlug: string,
  domainId: string,
  parentId?: string
): Promise<PublicFitmentNode[]> {
  const { data } = await publicGet<PublicFitmentNode[]>(
    `/v1/public/commerce/fitment/domains/${encodeURIComponent(domainId)}/nodes`,
    { tenant: tenantSlug, parentId },
    [`commerce:${tenantSlug}:fitment:nodes:${domainId}:${parentId ?? 'root'}`]
  );
  return data;
}
