// Public read endpoints for storefronts. No auth — results are
// restricted to active (non-archived, non-deleted) products and
// rules-driven memberships. Tenant resolution by slug.
//
//   GET /v1/public/commerce/collections                  ?tenant=<slug>
//   GET /v1/public/commerce/collections/:handle          ?tenant=<slug>
//   GET /v1/public/commerce/collections/:handle/products ?tenant=<slug>[&page=&perPage=]
//   GET /v1/public/commerce/products                     ?tenant=<slug>[&page=&perPage=&q=]
//   GET /v1/public/commerce/products/:handle             ?tenant=<slug>
//   GET /v1/public/commerce/categories                   ?tenant=<slug>
//   GET /v1/public/commerce/categories/:handle           ?tenant=<slug>
//   GET /v1/public/commerce/categories/:handle/products  ?tenant=<slug>[&page=&perPage=]
//   GET /v1/public/commerce/fitment/domains              ?tenant=<slug>
//   GET /v1/public/commerce/fitment/domains/:domainId/nodes ?tenant=<slug>[&parentId=<uuid>]
//
// Tenant resolution is identical to the CMS public surface
// (tenants table is the only non-RLS row, safe to look up by slug).
// All other reads run inside withTenant() so RLS scopes them.

import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';

import type { FastifyRequest } from 'fastify';

import { ok, paged } from '@sparx/api-core/envelope';
import { notFound } from '@sparx/api-core/errors';
import { prisma, withTenant } from '@sparx/db';
import { isModuleEnabled } from '@sparx/auth';
import { computeAvailability } from '@sparx/inventory';
import { pricingService } from '@sparx/commerce';
import { searchProducts } from '@sparx/search';
import {
  resolvePublicPropertyId,
  productSiteVisibilityWhere,
  collectionSiteVisibilityWhere,
  categorySiteVisibilityWhere,
} from '../../../lib/property.js';
import { tryVerifyProductPreview } from '../../../lib/preview.js';
import { requireTenantIdBySlug } from '../../../lib/tenant-slug.js';
import { optionalCustomer } from '../../../lib/customer-session.js';

// `property` (a stable site slug) scopes catalog reads to one web PROPERTY
// (docs/49 Model B). The storefront passes it for non-primary sites; omitted →
// the tenant's primary site. Resolved on EVERY read so the primary shows only
// global + primary-scoped products, never another site's exclusive items.
const TenantQuery = z.object({
  tenant: z.string().min(1).max(63),
  property: z.string().min(1).max(63).optional(),
});

const PagingQuery = z.object({
  tenant: z.string().min(1).max(63),
  property: z.string().min(1).max(63).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(24),
});

const ProductListQuery = PagingQuery.extend({
  q: z.string().optional(),
  vendor: z.string().optional(),
  productType: z.string().optional(),
  tag: z.string().optional(),
  fitmentMake: z.string().optional(),
  fitmentYear: z.coerce.number().int().optional(),
});

// Typesense-backed storefront search. Typo-tolerant, faceted, fast. Typesense
// owns ranking/filtering/faceting; Postgres still owns the canonical display
// row (ratings, inventory, image) so cards render identically to the PLP — we
// hydrate the hit ids in Typesense's relevance order. `sort` mirrors the PLP's
// ProductSort vocabulary.
const SearchQuery = PagingQuery.extend({
  q: z.string().optional(),
  vendor: z.string().optional(),
  productType: z.string().optional(),
  tag: z.string().optional(),
  inStock: z.coerce.boolean().optional(),
  minPriceCents: z.coerce.number().int().min(0).optional(),
  maxPriceCents: z.coerce.number().int().min(0).optional(),
  fitmentMakes: z.string().optional(),
  fitmentModels: z.string().optional(),
  fitmentEngines: z.string().optional(),
  fitmentYear: z.coerce.number().int().optional(),
  sort: z
    .enum(['relevance', 'price-asc', 'price-desc', 'title-asc', 'title-desc', 'newest'])
    .default('relevance'),
});

const SEARCH_SORT_BY: Record<string, string | undefined> = {
  relevance: undefined, // Typesense default: _text_match,best_seller_rank,updated_at
  'price-asc': 'price_min_cents:asc',
  'price-desc': 'price_max_cents:desc',
  'title-asc': 'title:asc',
  'title-desc': 'title:desc',
  newest: 'updated_at:desc',
};

function splitCsv(value?: string): string[] | undefined {
  if (!value) return undefined;
  const parts = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

const HandleParams = z.object({ handle: z.string().min(1).max(255) });

// Batched own-record fetch by id (docs/98 Pillar 7 record-display): a node PINNED to
// a collection/category resolves ITS fields. Mirrors `products/full`'s id contract.
const IdsQuery = z.object({
  tenant: z.string().min(1).max(63),
  ids: z.string().optional(),
});

/** Parse a `?ids=a,b,c` list into valid uuids (deduped order kept, capped at 48). */
function parseIdList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => z.string().uuid().safeParse(s).success)
    .slice(0, 48);
}

/** Re-sort fetched rows to the requested id order (Prisma `in` doesn't preserve it). */
function orderByIds<T extends { id: string }>(ids: string[], rows: T[]): T[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.flatMap((id) => {
    const r = byId.get(id);
    return r ? [r] : [];
  });
}

// The own-record fields a collection / category PIN exposes (id + name + handle +
// description + hero asset id). `heroMediaId` is the raw asset id — the builder's
// record mapper resolves it to a URL, exactly as products return `primaryImageId`.
const RECORD_SELECT = {
  id: true,
  name: true,
  handle: true,
  description: true,
  heroMediaId: true,
} as const;

// Cached in lib/tenant-slug.ts (docs/127 §5).
const resolveTenantBySlug = requireTenantIdBySlug;

/**
 * Product reads are otherwise fully anonymous/cacheable — but a signed-in
 * B2B customer needs to see THEIR price on the same pages every shopper
 * uses (no separate "B2B site"). Resolves the viewer's ACTIVE B2B
 * membership when a customer session cookie is present, else null (the
 * common, still-cacheable case — most visitors are anonymous or retail).
 */
async function resolveViewerB2bAccountId(
  request: FastifyRequest,
  tenantId: string
): Promise<string | undefined> {
  const resolved = await optionalCustomer(request, { tenantId });
  if (!resolved) return undefined;
  return withTenant({ tenantId }, async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: resolved.customerId },
      select: { b2bAccountId: true },
    });
    return pricingService.resolveActiveB2bAccountId(
      tx,
      resolved.customerId,
      customer?.b2bAccountId
    );
  });
}

/**
 * Card-list "your price" fast path: the DEFAULT variant's contract price
 * only (not the full price-list/bulk-tier waterfall `resolve()` runs for the
 * PDP/cart) — one batched query regardless of page size, so a 24-product grid
 * costs the same as a single product. Anonymous/non-B2B viewers (the common
 * case) skip this entirely and the response is unchanged from today.
 */
async function resolveDefaultVariantContractPrices(
  tenantId: string,
  b2bAccountId: string,
  variantIds: string[]
): Promise<Map<string, number>> {
  if (variantIds.length === 0) return new Map();
  const now = new Date();
  const rows = await withTenant({ tenantId }, (tx) =>
    tx.contractPrice.findMany({
      where: {
        b2bAccountId,
        variantId: { in: variantIds },
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gte: now } }],
      },
      orderBy: { validFrom: 'desc' },
      select: { variantId: true, priceCents: true },
    })
  );
  const map = new Map<string, number>();
  for (const r of rows) {
    if (!map.has(r.variantId)) map.set(r.variantId, r.priceCents); // first hit = most recent
  }
  return map;
}

/** Attaches `yourPriceCents` to a page of `publicProduct()`-mapped cards for the
 *  signed-in viewer — null for every card when there's no B2B viewer or no
 *  matching contract price, which is the common case and costs one extra query. */
async function withYourPrices(
  tenantId: string,
  products: ReturnType<typeof publicProduct>[],
  viewerB2bAccountId: string | undefined
): Promise<(ReturnType<typeof publicProduct> & { yourPriceCents: number | null })[]> {
  if (!viewerB2bAccountId) {
    return products.map((p) => ({ ...p, yourPriceCents: null }));
  }
  const variantIds = products.flatMap((p) => (p.defaultVariantId ? [p.defaultVariantId] : []));
  const contractPrices = await resolveDefaultVariantContractPrices(
    tenantId,
    viewerB2bAccountId,
    variantIds
  );
  return products.map((p) => ({
    ...p,
    yourPriceCents: p.defaultVariantId ? (contractPrices.get(p.defaultVariantId) ?? null) : null,
  }));
}

// Combine a product's per-site rollup buckets ([site] + the null legacy/shared
// bucket) into the one star average + count a storefront shows (docs/131 §4).
// Averages can't be averaged, so this sums the raw rating sums and counts across
// the buckets: sum(sumRating)/sum(reviewCount). `rollups` is present ONLY on the
// site-scoped selects (productSelect(propertyId) / fullProductSelect) — when it is,
// it is AUTHORITATIVE (an empty array means "no reviews on this site", NOT a
// fallback), because recomputeProductRating + the priming backfill keep a rollup
// row for every (product, site) that has any approved review. The tenant-wide
// product.average_rating / review_count columns are the fallback only for the
// non-site-scoped by-ids path, which passes no rollup.
function siteRating(
  rollups: { sumRating: number; reviewCount: number }[] | undefined,
  fallbackAverage: number | null,
  fallbackCount: number
): { averageRating: number | null; reviewCount: number } {
  if (!rollups) return { averageRating: fallbackAverage, reviewCount: fallbackCount };
  const reviewCount = rollups.reduce((sum, r) => sum + r.reviewCount, 0);
  const ratingSum = rollups.reduce((sum, r) => sum + r.sumRating, 0);
  return { averageRating: reviewCount > 0 ? ratingSum / reviewCount : null, reviewCount };
}

function publicProduct(row: {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  vendor: string | null;
  productType: string | null;
  tags: string[];
  priceMinCents: number | null;
  priceMaxCents: number | null;
  inStock: boolean;
  averageRating: number | null;
  reviewCount: number;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: Date;
  images?: { mediaAssetId: string }[];
  variants?: { id: string }[];
  reviewRollups?: { sumRating: number; reviewCount: number }[];
}) {
  const rating = siteRating(row.reviewRollups, row.averageRating, row.reviewCount);
  return {
    id: row.id,
    title: row.title,
    handle: row.handle,
    description: row.description,
    vendor: row.vendor,
    productType: row.productType,
    tags: row.tags,
    priceMinCents: row.priceMinCents,
    priceMaxCents: row.priceMaxCents,
    inStock: row.inStock,
    averageRating: rating.averageRating,
    reviewCount: rating.reviewCount,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    // Hero thumbnail asset id (primary, else first product-level by position —
    // see productSelect). The storefront resolves it via /v1/public/media/<id>.
    primaryImageId: row.images?.[0]?.mediaAssetId ?? null,
    // The variant an add-to-cart lands on when the shopper picks no options:
    // the explicit default, else lowest position (see productSelect). A builder
    // buy box binds this so its <form> submits a real cart line (docs/118).
    // Null only for a product with no live variants — such a card can render,
    // but its add-to-cart must not fire.
    defaultVariantId: row.variants?.[0]?.id ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

const publicCommerceRoutes: FastifyPluginAsync = (app) => {
  // ─── Collections ───────────────────────────────────────────────────

  app.get('/v1/public/commerce/collections', async (request) => {
    const q = TenantQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    // Model B: the collection index is scoped to the active site, so a collection
    // pinned to specific sites never shows on the others (empty pins = all sites).
    const propertyId = await resolvePublicPropertyId(tenantId, q.property);
    const rows = await withTenant({ tenantId }, (tx) =>
      tx.productCollection.findMany({
        where: { deletedAt: null, ...collectionSiteVisibilityWhere(propertyId) },
        orderBy: [{ featured: 'desc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          name: true,
          handle: true,
          description: true,
          heroMediaId: true,
          featured: true,
          seoTitle: true,
          seoDescription: true,
        },
      })
    );
    return ok(rows);
  });

  // Record-display pins (docs/98 Pillar 7): a node pinned to a collection renders
  // the collection's OWN fields (name, description, hero), distinct from listing its
  // products. Batched by id, order preserved — the analogue of products/full. Static
  // segment, so it never shadows (or is shadowed by) `/collections/:handle`.
  app.get('/v1/public/commerce/collections/full', async (request) => {
    const q = IdsQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const ids = parseIdList(q.ids);
    if (ids.length === 0) return ok([]);
    const rows = await withTenant({ tenantId }, (tx) =>
      tx.productCollection.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: RECORD_SELECT,
      })
    );
    return ok(orderByIds(ids, rows));
  });

  app.get('/v1/public/commerce/collections/:handle', async (request) => {
    const { handle } = HandleParams.parse(request.params);
    const q = TenantQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    // A collection hidden on the active site 404s here too, so a stale/shared link
    // can't reach a site-scoped collection's detail page.
    const propertyId = await resolvePublicPropertyId(tenantId, q.property);
    const row = await withTenant({ tenantId }, (tx) =>
      tx.productCollection.findFirst({
        where: { handle, deletedAt: null, ...collectionSiteVisibilityWhere(propertyId) },
        select: {
          id: true,
          name: true,
          handle: true,
          description: true,
          heroMediaId: true,
          featured: true,
          seoTitle: true,
          seoDescription: true,
          ogImageId: true,
        },
      })
    );
    if (!row) throw notFound('Collection', handle);
    return ok(row);
  });

  app.get('/v1/public/commerce/collections/:handle/products', async (request) => {
    const { handle } = HandleParams.parse(request.params);
    const q = PagingQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const propertyId = await resolvePublicPropertyId(tenantId, q.property);
    const result = await withTenant({ tenantId }, async (tx) => {
      const collection = await tx.productCollection.findFirst({
        // A collection hidden on the active site yields no product list (404),
        // matching its detail endpoint.
        where: { handle, deletedAt: null, ...collectionSiteVisibilityWhere(propertyId) },
        select: { id: true },
      });
      if (!collection) return null;
      // Model B: products in the collection AND visible on the active site.
      const where = {
        collectionLinks: { some: { collectionId: collection.id } },
        status: 'active' as const,
        deletedAt: null,
        ...productSiteVisibilityWhere(propertyId),
      };
      const [rows, total] = await Promise.all([
        tx.product.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          take: q.perPage,
          skip: (q.page - 1) * q.perPage,
          select: productSelect(propertyId),
        }),
        tx.product.count({ where }),
      ]);
      return { rows, total };
    });
    if (!result) throw notFound('Collection', handle);
    const viewerB2bAccountId = await resolveViewerB2bAccountId(request, tenantId);
    return paged(
      await withYourPrices(tenantId, result.rows.map(publicProduct), viewerB2bAccountId),
      {
        page: q.page,
        per_page: q.perPage,
        total: result.total,
      }
    );
  });

  // ─── Products ──────────────────────────────────────────────────────

  app.get('/v1/public/commerce/products', async (request) => {
    const q = ProductListQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const propertyId = await resolvePublicPropertyId(tenantId, q.property);
    const where = {
      status: 'active' as const,
      deletedAt: null,
      // Model B: only products visible on the active site (global or scoped here).
      ...productSiteVisibilityWhere(propertyId),
      ...(q.vendor ? { vendor: q.vendor } : {}),
      ...(q.productType ? { productType: q.productType } : {}),
      ...(q.tag ? { tags: { has: q.tag } } : {}),
      ...(q.q
        ? {
            OR: [
              { title: { contains: q.q, mode: 'insensitive' as const } },
              { description: { contains: q.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(q.fitmentMake || q.fitmentYear
        ? {
            fitments: {
              some: {
                // Descendant-by-name: "Ford" matches a product attached at the
                // Ford node OR any model/engine under it (node.pathNames).
                ...(q.fitmentMake ? { node: { pathNames: { has: q.fitmentMake } } } : {}),
                // Numeric narrowing against the rule's range windows.
                ...(q.fitmentYear
                  ? {
                      ranges: {
                        some: {
                          AND: [
                            { OR: [{ min: { lte: q.fitmentYear } }, { min: null }] },
                            { OR: [{ max: { gte: q.fitmentYear } }, { max: null }] },
                          ],
                        },
                      },
                    }
                  : {}),
              },
            },
          }
        : {}),
    };
    const result = await withTenant({ tenantId }, async (tx) => {
      const [rows, total] = await Promise.all([
        tx.product.findMany({
          where,
          orderBy: [{ inStock: 'desc' }, { updatedAt: 'desc' }],
          take: q.perPage,
          skip: (q.page - 1) * q.perPage,
          select: productSelect(propertyId),
        }),
        tx.product.count({ where }),
      ]);
      return { rows, total };
    });
    const viewerB2bAccountId = await resolveViewerB2bAccountId(request, tenantId);
    return paged(
      await withYourPrices(tenantId, result.rows.map(publicProduct), viewerB2bAccountId),
      {
        page: q.page,
        per_page: q.perPage,
        total: result.total,
      }
    );
  });

  // ─── Search (Typesense) ────────────────────────────────────────────
  //
  // Typo-tolerant faceted search. Typesense ranks + filters + facets; we
  // hydrate the resulting product ids from Postgres (same select + mapper as
  // the PLP) so the card shape is identical and ratings/inventory stay out of
  // the index. Facet counts ride in `meta.facets` for the storefront sidebar.
  app.get('/v1/public/commerce/search', async (request) => {
    const q = SearchQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const propertyId = await resolvePublicPropertyId(tenantId, q.property);

    // Build the price filter in Typesense grammar (cents, matching the index).
    const priceParts: string[] = [];
    if (q.minPriceCents !== undefined) priceParts.push(`price_min_cents:>=${q.minPriceCents}`);
    if (q.maxPriceCents !== undefined) priceParts.push(`price_max_cents:<=${q.maxPriceCents}`);
    const filterExtras = [
      q.vendor ? `vendor:=\`${q.vendor}\`` : null,
      q.productType ? `product_type:=\`${q.productType}\`` : null,
      q.tag ? `tags:=\`${q.tag}\`` : null,
      q.inStock === true ? 'in_stock:=true' : null,
      ...priceParts,
    ].filter((p): p is string => p !== null);

    const result = await searchProducts({
      tenantId,
      // Model B (docs/49 §3): scope the Typesense query to the active site so the
      // `found` count + facets are site-correct, not just the hydrated rows.
      propertyId,
      q: q.q,
      page: q.page,
      perPage: q.perPage,
      sortBy: SEARCH_SORT_BY[q.sort],
      filterBy: filterExtras.length > 0 ? filterExtras.join(' && ') : undefined,
      fitmentMakes: splitCsv(q.fitmentMakes),
      fitmentModels: splitCsv(q.fitmentModels),
      fitmentEngines: splitCsv(q.fitmentEngines),
      fitmentYear: q.fitmentYear,
    });

    // Hydrate the canonical display rows in Typesense's relevance order.
    const ids = result.hits.map((h) => h.document.product_id);
    let ordered: ReturnType<typeof publicProduct>[] = [];
    if (ids.length > 0) {
      const rows = await withTenant({ tenantId }, (tx) =>
        tx.product.findMany({
          // Model B: Typesense now scopes by `property_ids` (so `found` is
          // site-correct), but we keep this PG visibility filter as a
          // belt-and-suspenders for the rolling-reindex window where a freshly
          // re-scoped product hasn't been re-projected yet.
          where: {
            id: { in: ids },
            status: 'active',
            deletedAt: null,
            ...productSiteVisibilityWhere(propertyId),
          },
          select: productSelect(propertyId),
        })
      );
      const byId = new Map(rows.map((r) => [r.id, r]));
      ordered = ids.flatMap((id) => {
        const row = byId.get(id);
        return row ? [publicProduct(row)] : [];
      });
    }

    const viewerB2bAccountId = await resolveViewerB2bAccountId(request, tenantId);
    return paged(await withYourPrices(tenantId, ordered, viewerB2bAccountId), {
      page: result.page,
      per_page: result.perPage,
      total: result.found,
      // Facet counts for the storefront sidebar. Shape: { field: [{value,count}] }.
      facets: Object.fromEntries(
        result.facetCounts.map((f) => [
          f.fieldName,
          f.counts.map((c) => ({ value: c.value, count: c.count })),
        ])
      ),
    });
  });

  // Bulk hydrate a set of products by id, preserving the requested order.
  // Drives hand-picked Site Builder sections (featured-products manual source)
  // and is the building block for cart/wishlist hydration. Only active,
  // non-deleted products are returned; unknown ids are silently dropped.
  app.get('/v1/public/commerce/products/by-ids', async (request) => {
    const q = z
      .object({
        tenant: z.string().min(1).max(63),
        ids: z.string().min(1),
      })
      .parse(request.query);
    const ids = q.ids
      .split(',')
      .map((s) => s.trim())
      .filter((s) => z.string().uuid().safeParse(s).success)
      .slice(0, 100);
    if (ids.length === 0) return ok([]);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const rows = await withTenant({ tenantId }, (tx) =>
      tx.product.findMany({
        where: { id: { in: ids }, status: 'active', deletedAt: null },
        select: productSelect(),
      })
    );
    // Preserve caller-requested order (Prisma's `in` does not guarantee it).
    const byId = new Map(rows.map((r) => [r.id, r]));
    const ordered = ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [publicProduct(row)] : [];
    });
    return ok(ordered);
  });

  // FULL products for the Builder data spine (docs/98 Pillar 7). Returns the same
  // PDP payload (options + variants + images) so a pinned product card / collection
  // grid renders a working buy-box. Sourced by EITHER an id list (an entity pin —
  // order preserved), a collection id, a category id, or — with none — the whole
  // catalog (the `all` source), capped by `limit`. Active + site-visible only, so a
  // pinned-but-unpublished product simply doesn't render.
  app.get('/v1/public/commerce/products/full', async (request) => {
    const q = z
      .object({
        tenant: z.string().min(1).max(63),
        property: z.string().min(1).max(63).optional(),
        ids: z.string().optional(),
        collection: z.string().uuid().optional(),
        category: z.string().uuid().optional(),
        limit: z.coerce.number().int().min(1).max(48).default(24),
      })
      .parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const propertyId = await resolvePublicPropertyId(tenantId, q.property);
    const ids = q.ids
      ? q.ids
          .split(',')
          .map((s) => s.trim())
          .filter((s) => z.string().uuid().safeParse(s).success)
          .slice(0, 48)
      : null;
    if (ids?.length === 0) return ok([]);

    const where: Prisma.ProductWhereInput = {
      status: 'active',
      deletedAt: null,
      ...productSiteVisibilityWhere(propertyId),
      ...(ids ? { id: { in: ids } } : {}),
      ...(q.collection ? { collectionLinks: { some: { collectionId: q.collection } } } : {}),
      ...(q.category ? { categoryLinks: { some: { categoryId: q.category } } } : {}),
    };
    const [rows, inventoryActive] = await Promise.all([
      withTenant({ tenantId }, (tx) =>
        tx.product.findMany({
          where,
          orderBy: [{ inStock: 'desc' }, { updatedAt: 'desc' }],
          // An id pin returns every requested product; a source is capped.
          take: ids ? undefined : q.limit,
          select: fullProductSelect(propertyId),
        })
      ),
      isModuleEnabled(tenantId, 'inventory'),
    ]);
    let list = rows.map((r) => mapFullProduct(r, inventoryActive));
    // Preserve the requested id order (Prisma's `in` does not guarantee it).
    if (ids) {
      const byId = new Map(list.map((p) => [p.id, p]));
      list = ids.flatMap((id) => {
        const p = byId.get(id);
        return p ? [p] : [];
      });
    }
    return ok(list);
  });

  app.get('/v1/public/commerce/products/:handle', async (request) => {
    const { handle } = HandleParams.parse(request.params);
    const q = TenantQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const propertyId = await resolvePublicPropertyId(tenantId, q.property);
    // A valid product-preview token (editor minted, 15-min TTL) relaxes the
    // published-only + site-visibility filter so a DRAFT can be previewed. The
    // token is scoped to one product by `sub`, asserted against the match below
    // so it can't be replayed against a different product via the handle.
    const previewProductId = tryVerifyProductPreview(app, request, tenantId);
    const [result, inventoryActive, viewerB2bAccountId] = await Promise.all([
      withTenant({ tenantId }, (tx) =>
        tx.product.findFirst({
          // Model B: a product not visible on the active site 404s by URL too.
          where: {
            handle,
            deletedAt: null,
            ...(previewProductId
              ? {}
              : { status: 'active', ...productSiteVisibilityWhere(propertyId) }),
          },
          select: fullProductSelect(propertyId),
        })
      ),
      isModuleEnabled(tenantId, 'inventory'),
      resolveViewerB2bAccountId(request, tenantId),
    ]);
    if (!result) throw notFound('Product', handle);
    // Token is bound to one product — reject a handle that resolves elsewhere.
    if (previewProductId && previewProductId !== result.id) throw notFound('Product', handle);

    // "Your price" — resolved through the SAME priority chain (contract price →
    // price list → bulk tier) the cart already uses, so the number shown here is
    // exactly what checkout will charge, not a separate estimate. Anonymous and
    // non-B2B viewers never hit this branch — they get the flat retail price
    // exactly as before, so the response stays cacheable in that common case.
    let yourPrices: Map<string, number> | undefined;
    if (viewerB2bAccountId) {
      const priced = await Promise.all(
        result.variants.map((v) =>
          pricingService.resolve(
            { tenantId },
            {
              variantId: v.id,
              quantity: 1,
              channel: 'storefront',
              currency: v.currency,
              b2bAccountId: viewerB2bAccountId,
              customerSegmentIds: [],
            }
          )
        )
      );
      yourPrices = new Map(
        result.variants
          .map((v, i) => [v.id, priced[i]!.unitPriceCents] as const)
          .filter(([, cents], i) => cents !== result.variants[i]!.priceCents)
      );
    }
    return ok(mapFullProduct(result, inventoryActive, yourPrices));
  });

  // ─── Categories ────────────────────────────────────────────────────

  app.get('/v1/public/commerce/categories', async (request) => {
    const q = TenantQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    // Model B: the category index is scoped to the active site.
    const propertyId = await resolvePublicPropertyId(tenantId, q.property);
    const rows = await withTenant({ tenantId }, (tx) =>
      tx.productCategory.findMany({
        where: { deletedAt: null, ...categorySiteVisibilityWhere(propertyId) },
        orderBy: [{ path: 'asc' }, { position: 'asc' }],
        select: {
          id: true,
          name: true,
          handle: true,
          description: true,
          parentId: true,
          path: true,
          position: true,
          featured: true,
          iconMediaId: true,
          heroMediaId: true,
        },
      })
    );
    return ok(rows);
  });

  // Record-display pins (docs/98 Pillar 7): a node pinned to a category renders the
  // category's OWN fields (a category banner), distinct from listing its products.
  app.get('/v1/public/commerce/categories/full', async (request) => {
    const q = IdsQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const ids = parseIdList(q.ids);
    if (ids.length === 0) return ok([]);
    const rows = await withTenant({ tenantId }, (tx) =>
      tx.productCategory.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: RECORD_SELECT,
      })
    );
    return ok(orderByIds(ids, rows));
  });

  // A category's OWN record (name, description, hero, seo/og) — the storefront
  // browse-node detail page (/category/:handle). Static `/categories/full` above
  // is registered first, so this param route never shadows it.
  app.get('/v1/public/commerce/categories/:handle', async (request) => {
    const { handle } = HandleParams.parse(request.params);
    const q = TenantQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    // A category hidden on the active site 404s here too.
    const propertyId = await resolvePublicPropertyId(tenantId, q.property);
    const row = await withTenant({ tenantId }, (tx) =>
      tx.productCategory.findFirst({
        where: { handle, deletedAt: null, ...categorySiteVisibilityWhere(propertyId) },
        select: {
          id: true,
          name: true,
          handle: true,
          description: true,
          parentId: true,
          path: true,
          position: true,
          featured: true,
          iconMediaId: true,
          heroMediaId: true,
          seoTitle: true,
          seoDescription: true,
          ogImageId: true,
        },
      })
    );
    if (!row) throw notFound('Category', handle);
    return ok(row);
  });

  // Products in a category — BROWSE-NODE ROLLUP. Unlike a collection (a flat
  // membership), a category is a tree node, so its page shows everything under it:
  // products linked to the category itself OR any descendant. Descendants resolve
  // off the materialized dot-path (`path` = self, `<path>.%` = the subtree), and
  // Model B site-visibility still scopes the result to the active site.
  app.get('/v1/public/commerce/categories/:handle/products', async (request) => {
    const { handle } = HandleParams.parse(request.params);
    const q = PagingQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const propertyId = await resolvePublicPropertyId(tenantId, q.property);
    const result = await withTenant({ tenantId }, async (tx) => {
      const category = await tx.productCategory.findFirst({
        // A category hidden on the active site yields no rollup (its node 404s),
        // matching its detail endpoint — not just an empty product list.
        where: { handle, deletedAt: null, ...categorySiteVisibilityWhere(propertyId) },
        select: { id: true, path: true },
      });
      if (!category) return null;
      const descendants = await tx.productCategory.findMany({
        where: { path: { startsWith: `${category.path}.` }, deletedAt: null },
        select: { id: true },
      });
      const categoryIds = [category.id, ...descendants.map((d) => d.id)];
      // `some` matches a product once even if it links to several of these
      // categories, so no de-dup is needed.
      const where = {
        categoryLinks: { some: { categoryId: { in: categoryIds } } },
        status: 'active' as const,
        deletedAt: null,
        ...productSiteVisibilityWhere(propertyId),
      };
      const [rows, total] = await Promise.all([
        tx.product.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          take: q.perPage,
          skip: (q.page - 1) * q.perPage,
          select: productSelect(propertyId),
        }),
        tx.product.count({ where }),
      ]);
      return { rows, total };
    });
    if (!result) throw notFound('Category', handle);
    const viewerB2bAccountId = await resolveViewerB2bAccountId(request, tenantId);
    return paged(
      await withYourPrices(tenantId, result.rows.map(publicProduct), viewerB2bAccountId),
      {
        page: q.page,
        per_page: q.perPage,
        total: result.total,
      }
    );
  });

  // ─── Fitment ───────────────────────────────────────────────────────
  //
  // Surfaces the fitment domains the tenant has installed plus a generic
  // node drill down the domain's `level` dimensions. Drives the storefront
  // narrowing filter — Make → Model → Engine (narrowed by Year) for an auto
  // shop, Species → Breed (narrowed by Weight) for a pet store, Brand → Model
  // for a phone-case shop. Each level's children are lazy-loaded as the
  // customer drills, so the panel stays generic over the domain's shape.

  app.get('/v1/public/commerce/fitment/domains', async (request) => {
    const q = TenantQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const rows = await prisma.fitmentDomain.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: [{ position: 'asc' }, { displayName: 'asc' }],
      select: {
        id: true,
        slug: true,
        displayName: true,
        description: true,
        iconKey: true,
        dimensions: true,
      },
    });
    return ok(
      rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        displayName: r.displayName,
        description: r.description,
        iconKey: r.iconKey,
        // Ordered FitmentDimension[]: { key, label, kind: 'level'|'range', unit? }.
        // `level` dims form the drill tree (in order); `range` dims are the
        // numeric narrowing widgets (Year/Weight/…).
        dimensions: r.dimensions,
      }))
    );
  });

  // Generic node drill. Absent `?parentId=` → the domain's top-level nodes
  // (parentId: null); a uuid → that node's children. One endpoint walks the
  // whole `level` tree regardless of depth, so the storefront facet is fully
  // generic over `dimensions`. `childCount` lets the panel know whether the
  // next level exists (a leaf = end of the drill).
  app.get('/v1/public/commerce/fitment/domains/:domainId/nodes', async (request) => {
    const q = z
      .object({ tenant: z.string().min(1).max(63), parentId: z.guid().optional() })
      .parse(request.query);
    const { domainId } = z.object({ domainId: z.guid() }).parse(request.params);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const rows = await prisma.fitmentNode.findMany({
      where: { domainId, tenantId, parentId: q.parentId ?? null, deletedAt: null },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        dimensionKey: true,
        depth: true,
        position: true,
        _count: { select: { children: { where: { deletedAt: null } } } },
      },
    });
    return ok(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        dimensionKey: r.dimensionKey,
        depth: r.depth,
        position: r.position,
        childCount: r._count.children,
      }))
    );
  });

  return Promise.resolve();
};

// The per-site rating rollup fragment (docs/131 §4): the product's [site] + null
// buckets, which `siteRating` combines into the storefront star average. Included
// on every SITE-SCOPED select so a product listed on two businesses shows each its
// own average instead of the tenant-wide blend. Omitted from the non-scoped by-ids
// path, which has no site context and keeps the tenant-wide columns.
function reviewRollupsSelect(propertyId: string) {
  return {
    where: { OR: [{ propertyId }, { propertyId: null }] },
    select: { sumRating: true, reviewCount: true },
  } satisfies Prisma.Product$reviewRollupsArgs;
}

function productSelect(propertyId?: string) {
  return {
    id: true,
    title: true,
    handle: true,
    description: true,
    vendor: true,
    productType: true,
    tags: true,
    priceMinCents: true,
    priceMaxCents: true,
    inStock: true,
    averageRating: true,
    reviewCount: true,
    seoTitle: true,
    seoDescription: true,
    updatedAt: true,
    // Hero thumbnail: explicit primary first, else first product-level image by
    // position (mirrors productService.list). Resolved to a URL storefront-side.
    images: {
      where: { variantId: null },
      orderBy: [{ isPrimary: 'desc' as const }, { position: 'asc' as const }],
      take: 1,
      select: { mediaAssetId: true },
    },
    // The default variant, for `defaultVariantId` (see publicProduct). Explicit
    // default first, then lowest position — `isDefault` alone leaves ties in a
    // nondeterministic order, which would make a buy box add a different variant
    // on different requests.
    variants: {
      where: { deletedAt: null },
      orderBy: [{ isDefault: 'desc' as const }, { position: 'asc' as const }],
      take: 1,
      select: { id: true },
    },
    // Per-site rating (only when the read is scoped to a site).
    ...(propertyId ? { reviewRollups: reviewRollupsSelect(propertyId) } : {}),
  };
}

// The FULL product shape (options + variants + every image + fitments) — the PDP
// payload, shared by GET …/products/:handle and the Builder's …/products/full so a
// pinned/looped product hydrates the same interactive buy-box (docs/98 Pillar 7).
// A function (not a const) so the per-site rating rollup (docs/131 §4) is scoped to
// the active site — the PDP star average must be this business's, not the blend.
function fullProductSelect(propertyId: string) {
  return {
    id: true,
    title: true,
    handle: true,
    description: true,
    vendor: true,
    productType: true,
    tags: true,
    priceMinCents: true,
    priceMaxCents: true,
    inStock: true,
    averageRating: true,
    reviewCount: true,
    seoTitle: true,
    seoDescription: true,
    updatedAt: true,
    reviewRollups: reviewRollupsSelect(propertyId),
    fulfillmentType: true,
    weightGrams: true,
    lengthMm: true,
    widthMm: true,
    heightMm: true,
    options: {
      orderBy: { position: 'asc' },
      select: {
        id: true,
        name: true,
        displayType: true,
        position: true,
        values: {
          orderBy: { position: 'asc' },
          select: { id: true, value: true, swatchHex: true, position: true },
        },
      },
    },
    variants: {
      where: { deletedAt: null },
      // Default first, then position — same order as productSelect, so this row's
      // `variants[0]` is the same variant `publicProduct` reports as
      // `defaultVariantId` (mapFullProduct spreads it). `isDefault` alone leaves
      // ties nondeterministic.
      orderBy: [{ isDefault: 'desc' as const }, { position: 'asc' as const }],
      select: {
        id: true,
        sku: true,
        title: true,
        priceCents: true,
        compareAtPriceCents: true,
        currency: true,
        isDefault: true,
        inventoryPolicy: true,
        optionAssignments: { select: { optionValueId: true } },
        inventoryLevels: { select: { onHand: true, allocated: true, safetyBuffer: true } },
      },
    },
    images: {
      orderBy: { position: 'asc' },
      select: {
        id: true,
        mediaAssetId: true,
        variantId: true,
        alt: true,
        position: true,
        optionValueLinks: { select: { optionValueId: true } },
      },
    },
    fitments: {
      select: {
        id: true,
        notes: true,
        node: { select: { name: true, pathNames: true } },
        ranges: { select: { dimensionKey: true, min: true, max: true } },
        domain: { select: { slug: true, displayName: true, dimensions: true } },
      },
    },
  } satisfies Prisma.ProductSelect;
}

type FullProductRow = Prisma.ProductGetPayload<{
  select: ReturnType<typeof fullProductSelect>;
}>;

/** Map a full product row to the PUBLIC PDP shape (the storefront's PublicProduct).
 *  `inventoryActive` flows through to the availability rule: when the inventory
 *  module is off the variant degrades to untracked (always in stock) — docs/100 §2.4. */
function mapFullProduct(
  result: FullProductRow,
  inventoryActive: boolean,
  yourPrices?: Map<string, number>
) {
  return {
    ...publicProduct(result),
    fulfillmentType: result.fulfillmentType,
    weightGrams: result.weightGrams,
    dimensions:
      result.lengthMm || result.widthMm || result.heightMm
        ? { lengthMm: result.lengthMm, widthMm: result.widthMm, heightMm: result.heightMm }
        : null,
    options: result.options,
    variants: result.variants.map((v) => {
      // Sum available across every warehouse via the shared availability rule; the
      // cart engine picks the real one at reserve time — here we just want one
      // number the buy-box can render. Untracked (module off) → always available.
      const { available, inStock } = computeAvailability(v.inventoryLevels, v.inventoryPolicy, {
        inventoryActive,
      });
      return {
        id: v.id,
        sku: v.sku,
        title: v.title,
        priceCents: v.priceCents,
        compareAtPriceCents: v.compareAtPriceCents,
        // Present only for a signed-in customer whose active B2B membership
        // resolves a different price than the flat retail one above — null for
        // every anonymous/retail viewer (the storefront falls back to priceCents).
        yourPriceCents: yourPrices?.get(v.id) ?? null,
        isDefault: v.isDefault,
        inventoryPolicy: v.inventoryPolicy,
        optionValueIds: v.optionAssignments.map((ov) => ov.optionValueId),
        available: available ?? 0,
        inStock,
      };
    }),
    images: result.images.map((img) => ({
      id: img.id,
      mediaAssetId: img.mediaAssetId,
      variantId: img.variantId,
      alt: img.alt,
      position: img.position,
      optionValueIds: img.optionValueLinks.map((l) => l.optionValueId),
    })),
    fitments: result.fitments.map((f) => ({
      id: f.id,
      domainSlug: f.domain.slug,
      domainLabel: f.domain.displayName,
      // The domain's ordered dimension list so the PDP can label each range.
      dimensions: f.domain.dimensions,
      // Deepest level node name + its ancestor path (root → self), null/[] for
      // a whole-domain (universal) rule.
      nodeName: f.node?.name ?? null,
      nodePath: f.node?.pathNames ?? [],
      ranges: f.ranges.map((r) => ({
        dimensionKey: r.dimensionKey,
        min: r.min === null ? null : Number(r.min),
        max: r.max === null ? null : Number(r.max),
      })),
      notes: f.notes,
    })),
  };
}

export default publicCommerceRoutes;
