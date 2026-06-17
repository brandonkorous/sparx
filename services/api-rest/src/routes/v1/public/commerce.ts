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
//   GET /v1/public/commerce/fitment/makes                ?tenant=<slug>
//
// Tenant resolution is identical to the CMS public surface
// (tenants table is the only non-RLS row, safe to look up by slug).
// All other reads run inside withTenant() so RLS scopes them.

import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';

import { ok, paged } from '@sparx/api-core/envelope';
import { notFound } from '@sparx/api-core/errors';
import { prisma, withTenant } from '@sparx/db';
import { isModuleEnabled } from '@sparx/auth';
import { computeAvailability } from '@sparx/inventory';
import { searchProducts } from '@sparx/search';
import { resolvePublicPropertyId, productSiteVisibilityWhere } from '../../../lib/property.js';

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

async function resolveTenantBySlug(slug: string): Promise<string> {
  const t = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!t) throw notFound('Tenant', slug);
  return t.id;
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
}) {
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
    averageRating: row.averageRating,
    reviewCount: row.reviewCount,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    // Hero thumbnail asset id (primary, else first product-level by position —
    // see productSelect). The storefront resolves it via /v1/public/media/<id>.
    primaryImageId: row.images?.[0]?.mediaAssetId ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

const publicCommerceRoutes: FastifyPluginAsync = (app) => {
  // ─── Collections ───────────────────────────────────────────────────

  app.get('/v1/public/commerce/collections', async (request) => {
    const q = TenantQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const rows = await withTenant({ tenantId }, (tx) =>
      tx.productCollection.findMany({
        where: { deletedAt: null },
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

  app.get('/v1/public/commerce/collections/:handle', async (request) => {
    const { handle } = HandleParams.parse(request.params);
    const q = TenantQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const row = await withTenant({ tenantId }, (tx) =>
      tx.productCollection.findFirst({
        where: { handle, deletedAt: null },
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
        where: { handle, deletedAt: null },
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
          select: productSelect(),
        }),
        tx.product.count({ where }),
      ]);
      return { rows, total };
    });
    if (!result) throw notFound('Collection', handle);
    return paged(result.rows.map(publicProduct), {
      page: q.page,
      per_page: q.perPage,
      total: result.total,
    });
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
                ...(q.fitmentMake ? { category: { name: q.fitmentMake } } : {}),
                ...(q.fitmentYear
                  ? {
                      rangeMin: { lte: q.fitmentYear },
                      OR: [{ rangeMax: { gte: q.fitmentYear } }, { rangeMax: null }],
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
          select: productSelect(),
        }),
        tx.product.count({ where }),
      ]);
      return { rows, total };
    });
    return paged(result.rows.map(publicProduct), {
      page: q.page,
      per_page: q.perPage,
      total: result.total,
    });
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
          select: productSelect(),
        })
      );
      const byId = new Map(rows.map((r) => [r.id, r]));
      ordered = ids.flatMap((id) => {
        const row = byId.get(id);
        return row ? [publicProduct(row)] : [];
      });
    }

    return paged(ordered, {
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
          select: FULL_PRODUCT_SELECT,
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
    const [result, inventoryActive] = await Promise.all([
      withTenant({ tenantId }, (tx) =>
        tx.product.findFirst({
          // Model B: a product not visible on the active site 404s by URL too.
          where: {
            handle,
            status: 'active',
            deletedAt: null,
            ...productSiteVisibilityWhere(propertyId),
          },
          select: FULL_PRODUCT_SELECT,
        })
      ),
      isModuleEnabled(tenantId, 'inventory'),
    ]);
    if (!result) throw notFound('Product', handle);
    return ok(mapFullProduct(result, inventoryActive));
  });

  // ─── Categories ────────────────────────────────────────────────────

  app.get('/v1/public/commerce/categories', async (request) => {
    const q = TenantQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const rows = await withTenant({ tenantId }, (tx) =>
      tx.productCategory.findMany({
        where: { deletedAt: null },
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

  // ─── Fitment ───────────────────────────────────────────────────────
  //
  // Surfaces the fitment domains the tenant has access to (global + own)
  // plus L1 categories per domain. Drives the storefront narrowing
  // filter — vehicle Year/Make/Model/Engine for an auto shop, Pet
  // Species/Breed for a pet store, Device Brand/Model for a phone case
  // shop. L2/L3 are lazy-loaded as the customer drills down.

  app.get('/v1/public/commerce/fitment/domains', async (request) => {
    const q = TenantQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const rows = await prisma.fitmentDomain.findMany({
      where: { OR: [{ tenantId: null }, { tenantId }], deletedAt: null },
      orderBy: [{ position: 'asc' }, { displayName: 'asc' }],
      select: {
        id: true,
        slug: true,
        displayName: true,
        description: true,
        iconKey: true,
        labels: true,
        rangeUnit: true,
        tenantId: true,
      },
    });
    return ok(
      rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        displayName: r.displayName,
        description: r.description,
        iconKey: r.iconKey,
        labels: r.labels,
        rangeUnit: r.rangeUnit,
        isGlobal: r.tenantId === null,
      }))
    );
  });

  app.get('/v1/public/commerce/fitment/domains/:domainId/categories', async (request) => {
    const q = TenantQuery.parse(request.query);
    const { domainId } = z.object({ domainId: z.string().uuid() }).parse(request.params);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const rows = await prisma.fitmentCategory.findMany({
      where: {
        domainId,
        OR: [{ tenantId: null }, { tenantId }],
        deletedAt: null,
      },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, iconMediaId: true, tenantId: true },
    });
    return ok(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        iconMediaId: r.iconMediaId,
        isGlobal: r.tenantId === null,
      }))
    );
  });

  app.get('/v1/public/commerce/fitment/categories/:categoryId/items', async (request) => {
    const q = TenantQuery.parse(request.query);
    const { categoryId } = z.object({ categoryId: z.string().uuid() }).parse(request.params);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const rows = await prisma.fitmentItem.findMany({
      where: {
        categoryId,
        OR: [{ tenantId: null }, { tenantId }],
        deletedAt: null,
      },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, tenantId: true },
    });
    return ok(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        isGlobal: r.tenantId === null,
      }))
    );
  });

  app.get('/v1/public/commerce/fitment/items/:itemId/variants', async (request) => {
    const q = TenantQuery.parse(request.query);
    const { itemId } = z.object({ itemId: z.string().uuid() }).parse(request.params);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const rows = await prisma.fitmentVariant.findMany({
      where: {
        itemId,
        OR: [{ tenantId: null }, { tenantId }],
        deletedAt: null,
      },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, attributes: true, tenantId: true },
    });
    return ok(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        attributes: r.attributes,
        isGlobal: r.tenantId === null,
      }))
    );
  });

  return Promise.resolve();
};

function productSelect() {
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
  };
}

// The FULL product shape (options + variants + every image + fitments) — the PDP
// payload, shared by GET …/products/:handle and the Builder's …/products/full so a
// pinned/looped product hydrates the same interactive buy-box (docs/98 Pillar 7).
const FULL_PRODUCT_SELECT = {
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
    orderBy: { isDefault: 'desc' },
    select: {
      id: true,
      sku: true,
      title: true,
      priceCents: true,
      compareAtPriceCents: true,
      isDefault: true,
      inventoryPolicy: true,
      optionAssignments: { select: { optionValueId: true } },
      inventoryLevels: { select: { onHand: true, allocated: true } },
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
      rangeMin: true,
      rangeMax: true,
      notes: true,
      domain: { select: { slug: true, displayName: true, rangeUnit: true } },
      category: { select: { name: true } },
      item: { select: { name: true } },
      variant: { select: { name: true } },
    },
  },
} satisfies Prisma.ProductSelect;

type FullProductRow = Prisma.ProductGetPayload<{ select: typeof FULL_PRODUCT_SELECT }>;

/** Map a full product row to the PUBLIC PDP shape (the storefront's PublicProduct).
 *  `inventoryActive` flows through to the availability rule: when the inventory
 *  module is off the variant degrades to untracked (always in stock) — docs/100 §2.4. */
function mapFullProduct(result: FullProductRow, inventoryActive: boolean) {
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
      rangeUnit: f.domain.rangeUnit,
      category: f.category.name,
      item: f.item?.name ?? null,
      variant: f.variant?.name ?? null,
      rangeMin: f.rangeMin === null ? null : Number(f.rangeMin),
      rangeMax: f.rangeMax === null ? null : Number(f.rangeMax),
      notes: f.notes,
    })),
  };
}

export default publicCommerceRoutes;
