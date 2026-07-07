// sparx.market public browse (docs/106 §4.7) — the CROSS-TENANT reads that power
// the apps/market storefront (catalog, category pages, product detail, merchant
// directory + profiles).
//
// These read the GLOBAL projection tables (market_listings / market_merchants),
// whose RLS grants unconditional SELECT, via `withSystem` (no tenant context). The
// faceted catalog query uses Postgres FTS (the generated `search_tsv` + GIN index)
// — Phase-1 infra rule, no Typesense. Product DETAIL additionally resolves the
// seller's purchasable variants under the owning tenant (for add-to-cart).

import { Prisma, withSystem, withTenant } from '@sparx/db';
import { MarketBrowseQuery } from '@sparx/commerce-schemas';

import type { ServiceContext } from '../../errors';
import { mediaPublicUrl } from '../../media-url';
import {
  listReviewsForProduct,
  submit as submitProductReview,
  listQuestionsForProduct,
  submitQuestion as submitProductQuestion,
} from '../review-service';

// ── DTOs ────────────────────────────────────────────────────────────────────────

export interface MarketListingCard {
  slug: string;
  title: string;
  imageUrl: string | null;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  currency: string;
  inStock: boolean;
  averageRating: number | null;
  reviewCount: number;
  category: string;
  merchantSlug: string;
  merchantName: string;
  merchantLogoUrl: string | null;
  // Card-badge signals (docs/117 S3). bestSellerRank: 1 = top seller (NULL = unranked);
  // lowStock: in stock but running low; featured: sparx-curated placement.
  bestSellerRank: number | null;
  lowStock: boolean;
  featured: boolean;
}

export interface MarketBrowseResult {
  items: MarketListingCard[];
  total: number;
  page: number;
  perPage: number;
}

export interface MarketListingVariant {
  variantId: string;
  sku: string;
  title: string;
  options: Record<string, string>;
  priceCents: number;
  currency: string;
  inStock: boolean;
}

export interface MarketListingImage {
  url: string;
  alt: string | null;
}

export interface MarketListingDetail extends MarketListingCard {
  productId: string;
  description: string | null;
  productUrl: string | null;
  /** Ordered product gallery (primary first). Empty → fall back to `imageUrl`. */
  images: MarketListingImage[];
  variants: MarketListingVariant[];
}

export interface MarketMerchantSummary {
  slug: string;
  name: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  location: string | null;
  headline: string | null;
  siteUrl: string | null;
  socials: { platform: string; url: string }[];
  listingCount: number;
  // Seller trust signals (docs/117 S5).
  rating: number | null;
  ratingCount: number;
  /** When the seller joined sparx.market (ISO), for "Selling since" trust copy. */
  memberSince: string;
}

// ── Catalog browse ──────────────────────────────────────────────────────────────

interface RawCard {
  slug: string;
  title: string;
  imageUrl: string | null;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  currency: string;
  inStock: boolean;
  averageRating: number | null;
  reviewCount: number;
  category: string;
  merchantSlug: string;
  merchantName: string;
  merchantLogoUrl: string | null;
  bestSellerRank: number | null;
  lowStock: boolean;
  featured: boolean;
}

const CARD_COLUMNS = Prisma.sql`
  slug, title,
  image_url            AS "imageUrl",
  price_min_cents      AS "priceMinCents",
  price_max_cents      AS "priceMaxCents",
  currency,
  in_stock             AS "inStock",
  average_rating       AS "averageRating",
  review_count         AS "reviewCount",
  category,
  merchant_slug        AS "merchantSlug",
  merchant_name        AS "merchantName",
  merchant_logo_url    AS "merchantLogoUrl",
  best_seller_rank     AS "bestSellerRank",
  low_stock            AS "lowStock",
  featured
`;

/** Faceted, cross-tenant catalog browse over market_listings. Only approved listings
 *  surface (a listing row exists only for approved products — see projection). */
export async function browseListings(rawQuery: unknown): Promise<MarketBrowseResult> {
  const q = MarketBrowseQuery.parse(rawQuery);
  const offset = (q.page - 1) * q.perPage;

  const conditions: Prisma.Sql[] = [];
  if (q.category) conditions.push(Prisma.sql`category = ${q.category}`);
  if (q.merchant) conditions.push(Prisma.sql`merchant_slug = ${q.merchant}`);
  if (q.inStock) conditions.push(Prisma.sql`in_stock = true`);
  if (q.featured) conditions.push(Prisma.sql`featured = true`);
  if (q.minPriceCents !== undefined)
    conditions.push(Prisma.sql`price_min_cents >= ${q.minPriceCents}`);
  if (q.maxPriceCents !== undefined)
    conditions.push(Prisma.sql`price_max_cents <= ${q.maxPriceCents}`);
  const hasSearch = !!q.q && q.q.trim().length > 0;
  if (hasSearch) {
    conditions.push(Prisma.sql`search_tsv @@ websearch_to_tsquery('english', ${q.q})`);
  }
  const where = conditions.length
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
    : Prisma.empty;

  const orderBy = resolveOrderBy(q.sort, hasSearch ? q.q! : null);

  return withSystem(async (tx) => {
    const [items, countRows] = await Promise.all([
      tx.$queryRaw<RawCard[]>(
        Prisma.sql`SELECT ${CARD_COLUMNS} FROM market_listings ${where} ORDER BY ${orderBy} LIMIT ${q.perPage} OFFSET ${offset}`
      ),
      tx.$queryRaw<{ count: bigint }[]>(
        Prisma.sql`SELECT count(*)::bigint AS count FROM market_listings ${where}`
      ),
    ]);
    return {
      items,
      total: Number(countRows[0]?.count ?? 0n),
      page: q.page,
      perPage: q.perPage,
    };
  });
}

/** Resolve a set of listing slugs to cards, in the caller's order (the client-side
 *  favorites page passes its localStorage slug list). Unknown slugs are dropped. */
export async function getListingsBySlugs(slugs: string[]): Promise<MarketListingCard[]> {
  const unique = [...new Set(slugs)].slice(0, 100);
  if (unique.length === 0) return [];
  const rows = await withSystem((tx) =>
    tx.$queryRaw<RawCard[]>(
      Prisma.sql`SELECT ${CARD_COLUMNS} FROM market_listings WHERE slug IN (${Prisma.join(unique)})`
    )
  );
  // Preserve the caller's order (favorites are shown most-recent-first).
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  return unique.flatMap((slug) => {
    const row = bySlug.get(slug);
    return row ? [row] : [];
  });
}

/** The discovery-home "Trending now" rail — best sellers first, then most-reviewed
 *  and best-rated, so the strip is always populated even before rank data fills in. */
export async function getTrendingListings(limit = 12): Promise<MarketListingCard[]> {
  const take = Math.min(Math.max(limit, 1), 24);
  return withSystem((tx) =>
    tx.$queryRaw<RawCard[]>(
      Prisma.sql`SELECT ${CARD_COLUMNS} FROM market_listings
        ORDER BY best_seller_rank ASC NULLS LAST, review_count DESC, average_rating DESC NULLS LAST, featured DESC
        LIMIT ${take}`
    )
  );
}

function resolveOrderBy(sort: MarketBrowseQuery['sort'], searchTerm: string | null): Prisma.Sql {
  switch (sort) {
    case 'newest':
      return Prisma.sql`published_at DESC NULLS LAST, created_at DESC`;
    case 'lowest_price':
      return Prisma.sql`price_min_cents ASC NULLS LAST`;
    case 'highest_price':
      return Prisma.sql`price_max_cents DESC NULLS LAST`;
    case 'rating':
      return Prisma.sql`average_rating DESC NULLS LAST, review_count DESC`;
    case 'relevance':
    default:
      if (searchTerm) {
        return Prisma.sql`ts_rank(search_tsv, websearch_to_tsquery('english', ${searchTerm})) DESC, featured DESC`;
      }
      return Prisma.sql`featured DESC, created_at DESC`;
  }
}

// ── Facet counts (the sidebar's per-category + in-stock tallies) ────────────────
//
// Standard faceted-search semantics: each facet's counts honor every OTHER active
// filter but not its own axis, so the sidebar shows how the result set would change
// if the shopper toggled that facet. Category counts apply search + merchant + price
// + in-stock (but not the selected category); the in-stock tally applies everything
// except the in-stock toggle; `total` mirrors the grid (all filters).

export interface MarketCategoryFacet {
  slug: string;
  count: number;
}

export interface MarketFacets {
  categories: MarketCategoryFacet[];
  inStockCount: number;
  total: number;
}

/** The always-applied predicates (search + merchant + price + featured) — every
 *  facet count starts from these; category / in-stock are layered per facet. */
function baseFacetConditions(q: MarketBrowseQuery): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];
  if (q.merchant) conditions.push(Prisma.sql`merchant_slug = ${q.merchant}`);
  if (q.featured) conditions.push(Prisma.sql`featured = true`);
  if (q.minPriceCents !== undefined)
    conditions.push(Prisma.sql`price_min_cents >= ${q.minPriceCents}`);
  if (q.maxPriceCents !== undefined)
    conditions.push(Prisma.sql`price_max_cents <= ${q.maxPriceCents}`);
  if (q.q && q.q.trim().length > 0) {
    conditions.push(Prisma.sql`search_tsv @@ websearch_to_tsquery('english', ${q.q})`);
  }
  return conditions;
}

function whereClause(conditions: Prisma.Sql[]): Prisma.Sql {
  return conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;
}

/** Facet tallies for the faceted browse sidebar. */
export async function getListingFacets(rawQuery: unknown): Promise<MarketFacets> {
  const q = MarketBrowseQuery.parse(rawQuery);
  const base = baseFacetConditions(q);
  const inStockCond = q.inStock ? [Prisma.sql`in_stock = true`] : [];
  const categoryCond = q.category ? [Prisma.sql`category = ${q.category}`] : [];

  // Category counts: base + in-stock (NOT the selected category — so siblings show).
  const categoryWhere = whereClause([...base, ...inStockCond]);
  // In-stock tally: base + category, forcing in_stock (NOT the in-stock toggle).
  const inStockWhere = whereClause([...base, ...categoryCond, Prisma.sql`in_stock = true`]);
  // Total mirrors the grid: every active filter.
  const totalWhere = whereClause([...base, ...categoryCond, ...inStockCond]);

  return withSystem(async (tx) => {
    const [categoryRows, inStockRows, totalRows] = await Promise.all([
      tx.$queryRaw<{ category: string; count: bigint }[]>(
        Prisma.sql`SELECT category, count(*)::bigint AS count FROM market_listings ${categoryWhere} GROUP BY category`
      ),
      tx.$queryRaw<{ count: bigint }[]>(
        Prisma.sql`SELECT count(*)::bigint AS count FROM market_listings ${inStockWhere}`
      ),
      tx.$queryRaw<{ count: bigint }[]>(
        Prisma.sql`SELECT count(*)::bigint AS count FROM market_listings ${totalWhere}`
      ),
    ]);
    return {
      categories: categoryRows.map((r) => ({ slug: r.category, count: Number(r.count) })),
      inStockCount: Number(inStockRows[0]?.count ?? 0n),
      total: Number(totalRows[0]?.count ?? 0n),
    };
  });
}

// ── Search autocomplete (header suggest) ────────────────────────────────────────
//
// A lightweight prefix/substring suggest over the projection — product titles +
// merchant names — for the header search dropdown. ILIKE (no pg_trgm dependency);
// the full FTS query still powers actual search. Prefix matches rank first.

export interface MarketSuggestProduct {
  slug: string;
  title: string;
  category: string;
}

export interface MarketSuggestMerchant {
  slug: string;
  name: string;
}

export interface MarketSuggestResult {
  products: MarketSuggestProduct[];
  merchants: MarketSuggestMerchant[];
}

/** Escape the ILIKE wildcards (%, _, \) in user input so they match literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Header search suggestions: matching product titles + merchant names. */
export async function suggestListings(qRaw: string, limit = 6): Promise<MarketSuggestResult> {
  const q = qRaw.trim().slice(0, 80);
  if (q.length < 2) return { products: [], merchants: [] };
  const take = Math.min(Math.max(limit, 1), 10);
  const contains = `%${escapeLike(q)}%`;
  const prefix = `${escapeLike(q)}%`;

  return withSystem(async (tx) => {
    const [products, merchants] = await Promise.all([
      tx.$queryRaw<MarketSuggestProduct[]>(
        Prisma.sql`SELECT slug, title, category FROM market_listings
          WHERE title ILIKE ${contains}
          ORDER BY (title ILIKE ${prefix}) DESC, best_seller_rank ASC NULLS LAST, featured DESC
          LIMIT ${take}`
      ),
      tx.$queryRaw<MarketSuggestMerchant[]>(
        Prisma.sql`SELECT slug, name FROM market_merchants
          WHERE approved = true AND listing_count > 0 AND name ILIKE ${contains}
          ORDER BY (name ILIKE ${prefix}) DESC, featured DESC, listing_count DESC
          LIMIT 4`
      ),
    ]);
    return { products, merchants };
  });
}

// ── Product detail (listing + the seller's purchasable variants) ────────────────

/** A single listing by its marketplace slug, with the seller's active variants
 *  resolved under the owning tenant (for add-to-cart). Null when not found. */
export async function getListingDetail(slug: string): Promise<MarketListingDetail | null> {
  const listing = await withSystem((tx) => tx.marketListing.findUnique({ where: { slug } }));
  if (!listing) return null;

  const { variants, images } = await withTenant({ tenantId: listing.tenantId }, async (tx) => {
    const [rows, imageRows] = await Promise.all([
      tx.productVariant.findMany({
        where: { productId: listing.productId, deletedAt: null },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          sku: true,
          title: true,
          priceCents: true,
          currency: true,
          optionAssignments: {
            select: {
              optionValue: { select: { value: true, option: { select: { name: true } } } },
            },
          },
          inventoryLevels: { select: { onHand: true, allocated: true, safetyBuffer: true } },
        },
      }),
      // Product-level gallery images (variantId null), primary first. Resolved to
      // public CDN URLs so the marketplace renders a real gallery, not one thumb.
      tx.variantImage.findMany({
        where: { productId: listing.productId, variantId: null },
        orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
        select: { mediaAssetId: true, alt: true },
      }),
    ]);

    const assetIds = imageRows.map((i) => i.mediaAssetId);
    const assets = assetIds.length
      ? await tx.mediaAsset.findMany({
          where: { id: { in: assetIds }, deletedAt: null },
          select: { id: true, key: true },
        })
      : [];
    const keyById = new Map(assets.map((a) => [a.id, a.key]));
    const images: MarketListingImage[] = imageRows.flatMap((i) => {
      const key = keyById.get(i.mediaAssetId);
      return key ? [{ url: mediaPublicUrl(key), alt: i.alt }] : [];
    });

    const variants = rows.map((v) => {
      const options: Record<string, string> = {};
      for (const a of v.optionAssignments) {
        options[a.optionValue.option.name] = a.optionValue.value;
      }
      const tracked = v.inventoryLevels.length > 0;
      const sellable = v.inventoryLevels.reduce(
        (sum, l) => sum + Math.max(0, l.onHand - l.allocated - l.safetyBuffer),
        0
      );
      return {
        variantId: v.id,
        sku: v.sku,
        title: v.title ?? (Object.values(options).join(' / ') || listing.title),
        options,
        priceCents: v.priceCents,
        currency: v.currency,
        inStock: !tracked || sellable > 0,
      };
    });

    return { variants, images };
  });

  return {
    slug: listing.slug,
    productId: listing.productId,
    title: listing.title,
    description: listing.descriptionSnippet,
    imageUrl: listing.imageUrl,
    images,
    priceMinCents: listing.priceMinCents,
    priceMaxCents: listing.priceMaxCents,
    currency: listing.currency,
    inStock: listing.inStock,
    averageRating: listing.averageRating,
    reviewCount: listing.reviewCount,
    bestSellerRank: listing.bestSellerRank,
    lowStock: listing.lowStock,
    featured: listing.featured,
    category: listing.category,
    merchantSlug: listing.merchantSlug,
    merchantName: listing.merchantName,
    merchantLogoUrl: listing.merchantLogoUrl,
    productUrl: listing.productUrl,
    variants,
  };
}

// ── PDP depth: reviews, Q&A, related (on-demand tenant resolve) ──────────────────
//
// The marketplace is cross-tenant, but reviews / Q&A live in the seller's FORCE-RLS
// tables. So we resolve the listing slug → owning {tenantId, productId} via the
// global projection (withSystem), then delegate to the tenant-scoped review-service
// under a ServiceContext for THAT seller. No projection columns, no migration — the
// same on-demand pattern getListingDetail uses for variants. Only APPROVED reviews
// and PUBLISHED questions surface; moderation-only fields never leave the service.

/** Resolve a marketplace slug to the owning tenant + product. Null when unknown. */
async function resolveListingRef(
  slug: string
): Promise<{ tenantId: string; productId: string } | null> {
  const listing = await withSystem((tx) =>
    tx.marketListing.findUnique({
      where: { slug },
      select: { tenantId: true, productId: true },
    })
  );
  return listing ? { tenantId: listing.tenantId, productId: listing.productId } : null;
}

export interface MarketReview {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  author: string | null;
  verifiedPurchase: boolean;
  helpfulCount: number;
  response: string | null;
  respondedAt: string | null;
  createdAt: string;
}

export interface MarketReviewPage {
  summary: { averageRating: number; total: number };
  items: MarketReview[];
  page: number;
  perPage: number;
}

/** A listing's APPROVED reviews (newest first) + the live rating summary. Null when
 *  the listing slug is unknown. */
export async function getListingReviews(
  slug: string,
  opts: { page?: number; perPage?: number } = {}
): Promise<MarketReviewPage | null> {
  const ref = await resolveListingRef(slug);
  if (!ref) return null;
  const page = Math.max(opts.page ?? 1, 1);
  const perPage = Math.min(Math.max(opts.perPage ?? 20, 1), 50);
  const ctx: ServiceContext = { tenantId: ref.tenantId };
  const { items, total, averageRating } = await listReviewsForProduct(ctx, ref.productId, {
    status: 'approved',
    take: perPage,
    skip: (page - 1) * perPage,
  });
  return {
    summary: { averageRating, total },
    items: items.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      author: r.displayName,
      verifiedPurchase: r.verifiedPurchase,
      helpfulCount: r.helpfulCount,
      response: r.response,
      respondedAt: r.respondedAt,
      createdAt: r.createdAt,
    })),
    page,
    perPage,
  };
}

/** Submit a guest review for a listing (lands in the seller's moderation queue).
 *  Null when the listing slug is unknown. */
export async function submitListingReview(
  slug: string,
  input: { rating: number; authorName: string; title?: string; body: string }
): Promise<{ reviewId: string; status: string } | null> {
  const ref = await resolveListingRef(slug);
  if (!ref) return null;
  const ctx: ServiceContext = { tenantId: ref.tenantId };
  const result = await submitProductReview(ctx, {
    productId: ref.productId,
    rating: input.rating,
    displayName: input.authorName,
    ...(input.title ? { title: input.title } : {}),
    body: input.body,
  });
  return { reviewId: result.id, status: result.status };
}

export interface MarketQuestionAnswer {
  id: string;
  body: string;
  isOfficial: boolean;
  createdAt: string;
}

export interface MarketQuestion {
  id: string;
  displayName: string | null;
  body: string;
  createdAt: string;
  helpfulCount: number;
  answers: MarketQuestionAnswer[];
}

/** A listing's PUBLISHED questions + their answers. Null when the slug is unknown. */
export async function getListingQuestions(slug: string): Promise<MarketQuestion[] | null> {
  const ref = await resolveListingRef(slug);
  if (!ref) return null;
  const ctx: ServiceContext = { tenantId: ref.tenantId };
  const questions = await listQuestionsForProduct(ctx, ref.productId, { status: 'published' });
  return questions.map((q) => ({
    id: q.id,
    displayName: q.displayName,
    body: q.body,
    createdAt: q.createdAt,
    helpfulCount: q.helpfulCount,
    answers: q.answers.map((a) => ({
      id: a.id,
      body: a.body,
      isOfficial: a.isOfficial,
      createdAt: a.createdAt,
    })),
  }));
}

/** Submit a guest question for a listing (enters moderation). Null on unknown slug. */
export async function submitListingQuestion(
  slug: string,
  input: { displayName?: string; body: string }
): Promise<{ questionId: string } | null> {
  const ref = await resolveListingRef(slug);
  if (!ref) return null;
  const ctx: ServiceContext = { tenantId: ref.tenantId };
  const result = await submitProductQuestion(ctx, {
    productId: ref.productId,
    body: input.body,
    ...(input.displayName ? { displayName: input.displayName } : {}),
  });
  return { questionId: result.id };
}

/** Same-category listings, excluding the current one — the PDP "You may also like"
 *  rail. A projection query (no tenant resolve); featured + best-rated first. */
export async function getRelatedListings(slug: string, limit = 8): Promise<MarketListingCard[]> {
  const listing = await withSystem((tx) =>
    tx.marketListing.findUnique({ where: { slug }, select: { category: true } })
  );
  if (!listing) return [];
  const take = Math.min(Math.max(limit, 1), 24);
  return withSystem((tx) =>
    tx.$queryRaw<RawCard[]>(
      Prisma.sql`SELECT ${CARD_COLUMNS} FROM market_listings
        WHERE category = ${listing.category} AND slug <> ${slug}
        ORDER BY featured DESC, average_rating DESC NULLS LAST, review_count DESC
        LIMIT ${take}`
    )
  );
}

// ── Merchant directory + profile ────────────────────────────────────────────────

function mapSocials(value: unknown): { platform: string; url: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((s) => {
    if (s && typeof s === 'object') {
      const o = s as Record<string, unknown>;
      if (typeof o.platform === 'string' && typeof o.url === 'string') {
        return [{ platform: o.platform, url: o.url }];
      }
    }
    return [];
  });
}

export async function listMerchants(opts: {
  page?: number;
  perPage?: number;
  q?: string;
}): Promise<{ items: MarketMerchantSummary[]; total: number; page: number; perPage: number }> {
  const page = Math.max(opts.page ?? 1, 1);
  const perPage = Math.min(Math.max(opts.perPage ?? 24, 1), 60);
  const where = {
    approved: true,
    listingCount: { gt: 0 },
    ...(opts.q ? { name: { contains: opts.q, mode: 'insensitive' as const } } : {}),
  };
  return withSystem(async (tx) => {
    const [rows, total] = await Promise.all([
      tx.marketMerchant.findMany({
        where,
        orderBy: [{ featured: 'desc' }, { listingCount: 'desc' }],
        take: perPage,
        skip: (page - 1) * perPage,
      }),
      tx.marketMerchant.count({ where }),
    ]);
    return { items: rows.map(toMerchantSummary), total, page, perPage };
  });
}

export async function getMerchant(slug: string): Promise<MarketMerchantSummary | null> {
  const row = await withSystem((tx) => tx.marketMerchant.findUnique({ where: { slug } }));
  return row ? toMerchantSummary(row) : null;
}

function toMerchantSummary(row: {
  slug: string;
  name: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  location: string | null;
  headline: string | null;
  siteUrl: string | null;
  socials: unknown;
  listingCount: number;
  rating: number | null;
  ratingCount: number;
  createdAt: Date;
}): MarketMerchantSummary {
  return {
    slug: row.slug,
    name: row.name,
    logoUrl: row.logoUrl,
    bannerUrl: row.bannerUrl,
    bio: row.bio,
    location: row.location,
    headline: row.headline,
    siteUrl: row.siteUrl,
    socials: mapSocials(row.socials),
    listingCount: row.listingCount,
    rating: row.rating,
    ratingCount: row.ratingCount,
    memberSince: row.createdAt.toISOString(),
  };
}

/** Resolve the seller TENANT id from a merchant slug (for cart/checkout routing),
 *  validating the merchant is approved + participating. Null when unknown/disabled. */
export async function resolveMerchantTenantId(slug: string): Promise<string | null> {
  const row = await withSystem((tx) =>
    tx.marketMerchant.findUnique({ where: { slug }, select: { tenantId: true, approved: true } })
  );
  return row?.approved ? row.tenantId : null;
}
