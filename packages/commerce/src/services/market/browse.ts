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

export interface MarketListingDetail extends MarketListingCard {
  productId: string;
  description: string | null;
  productUrl: string | null;
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
  merchant_logo_url    AS "merchantLogoUrl"
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

// ── Product detail (listing + the seller's purchasable variants) ────────────────

/** A single listing by its marketplace slug, with the seller's active variants
 *  resolved under the owning tenant (for add-to-cart). Null when not found. */
export async function getListingDetail(slug: string): Promise<MarketListingDetail | null> {
  const listing = await withSystem((tx) => tx.marketListing.findUnique({ where: { slug } }));
  if (!listing) return null;

  const variants = await withTenant({ tenantId: listing.tenantId }, async (tx) => {
    const rows = await tx.productVariant.findMany({
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
    });
    return rows.map((v) => {
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
  });

  return {
    slug: listing.slug,
    productId: listing.productId,
    title: listing.title,
    description: listing.descriptionSnippet,
    imageUrl: listing.imageUrl,
    priceMinCents: listing.priceMinCents,
    priceMaxCents: listing.priceMaxCents,
    currency: listing.currency,
    inStock: listing.inStock,
    averageRating: listing.averageRating,
    reviewCount: listing.reviewCount,
    category: listing.category,
    merchantSlug: listing.merchantSlug,
    merchantName: listing.merchantName,
    merchantLogoUrl: listing.merchantLogoUrl,
    productUrl: listing.productUrl,
    variants,
  };
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
