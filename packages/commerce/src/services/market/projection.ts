// sparx.market projection writer (docs/106 §4.7).
//
// The public marketplace is cross-tenant, but products + merchant identity live in
// FORCE-RLS tenant tables it cannot read. So eligible products are projected into
// two GLOBAL tables (cross-tenant SELECT / tenant write, like channel_shop_links):
//   • market_listings  — one row per opted-in product (the catalog card).
//   • market_merchants — one row per participating tenant (the directory).
//
// Projection is SYNCHRONOUS from the merchant-driven mutations (opt-in toggle,
// product edit, profile change) — a product "appears on sparx.market" the moment
// it is listed. The channel-sync-worker only refreshes the volatile in_stock/price
// fields on background inventory drift (see lib/market-projection in the worker).
//
// Eligibility (all must hold): product.marketListed && marketApproved &&
// status='active' && not deleted && the tenant's merchant profile is enabled.

import { withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import { mediaPublicUrl } from '../../media-url';
import type { ServiceContext } from '../../errors';

const SITE_BASE = process.env.SPARX_SITE_BASE ?? '';

// A listing is flagged `low_stock` when it is still buyable but its total sellable
// quantity across variants is at/under this floor — the "Only a few left" urgency
// badge (docs/117 S3). Kept intentionally coarse: the marketplace never exposes an
// exact remaining count cross-tenant, only the boolean signal.
const MARKET_LOW_STOCK_THRESHOLD = 5;

/** The seller's own storefront product URL (the "Visit their store" link). */
function storefrontProductUrl(slug: string | null, handle: string): string | null {
  if (!SITE_BASE || !slug) return null;
  const base = SITE_BASE.replace('{slug}', slug).replace(/\/$/, '');
  return `${base}/products/${encodeURIComponent(handle)}`;
}

function storefrontBaseUrl(slug: string | null): string | null {
  if (!SITE_BASE || !slug) return null;
  return SITE_BASE.replace('{slug}', slug).replace(/\/$/, '');
}

interface BrandOverride {
  businessName?: string | null;
  /** The site's light logo. `logoMediaId` is the LEGACY single-logo key, kept so an
   *  override written before the light/dark split still resolves. */
  logoLightMediaId?: string | null;
  logoMediaId?: string | null;
}

function readBrandOverride(value: unknown): BrandOverride {
  if (!value || typeof value !== 'object') return {};
  const v = value as Record<string, unknown>;
  return {
    businessName: typeof v.businessName === 'string' ? v.businessName : null,
    logoLightMediaId: typeof v.logoLightMediaId === 'string' ? v.logoLightMediaId : null,
    logoMediaId: typeof v.logoMediaId === 'string' ? v.logoMediaId : null,
  };
}

/** Resolve a MediaAsset id to its public CDN URL (soft pointer — no FK). */
async function resolveMediaUrl(
  tx: TxClient,
  mediaId: string | null | undefined
): Promise<string | null> {
  if (!mediaId) return null;
  const asset = await tx.mediaAsset.findFirst({
    where: { id: mediaId, deletedAt: null },
    select: { key: true },
  });
  return asset ? mediaPublicUrl(asset.key) : null;
}

/** The merchant's public identity (docs/131 §7): a site-chosen global `handle` for the
 *  `/merchants/{handle}` page, and the name/logo of the MARKETED SITE (`marketPropertyId`)
 *  — never "Korous Family Inc." the tenant. `storefrontSlug` (the tenant slug) is kept
 *  SEPARATELY for the "visit their store" link, which points at the real storefront and
 *  is a different URL from the marketplace merchant page. Falls back to the primary site
 *  + tenant slug only during the migration backfill window. */
async function resolveMerchantIdentity(
  tx: TxClient,
  tenantId: string,
  merchant: { marketPropertyId: string | null; handle: string | null }
) {
  const tenant = await tx.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true, socials: true },
  });
  const property = merchant.marketPropertyId
    ? await tx.property.findFirst({
        where: { id: merchant.marketPropertyId },
        select: { name: true, brandOverride: true },
      })
    : await tx.property.findFirst({
        where: { isPrimary: true },
        select: { name: true, brandOverride: true },
      });
  const brand = await tx.tenantBrand.findUnique({
    where: { tenantId },
    select: { logoLightMediaId: true },
  });
  const override = readBrandOverride(property?.brandOverride);
  const name = override.businessName ?? property?.name ?? tenant?.slug ?? 'Merchant';
  // The site's own logo wins; the tenant base is only the fallback for a site that
  // has never been branded. `logoMediaId` is the legacy single-logo key — an
  // override written before the light/dark split still carries the light logo there.
  const logoUrl = await resolveMediaUrl(
    tx,
    override.logoLightMediaId ?? override.logoMediaId ?? brand?.logoLightMediaId ?? null
  );
  return {
    // The marketplace handle → /merchants/{handle}. Never the tenant slug (post-backfill).
    slug: merchant.handle ?? tenant?.slug ?? null,
    // The storefront subdomain for the "visit their store" link — a separate URL.
    storefrontSlug: tenant?.slug ?? null,
    name,
    logoUrl,
    socials: tenant?.socials ?? [],
  };
}

/** A globally-unique marketplace slug for a product. Prefers the bare handle; on a
 *  collision with a DIFFERENT product, suffixes a short id so URLs stay clean. */
async function uniqueListingSlug(tx: TxClient, handle: string, productId: string): Promise<string> {
  const base = handle.slice(0, 140);
  const clash = await tx.marketListing.findFirst({
    where: { slug: base, NOT: { productId } },
    select: { id: true },
  });
  return clash ? `${base.slice(0, 140)}-${productId.slice(0, 8)}` : base;
}

/** Recount this tenant's live listings + refresh the merchant directory row from the
 *  profile + identity. Removes the merchant row when the profile is disabled. */
export async function refreshMarketMerchant(ctx: ServiceContext): Promise<void> {
  await withTenant(ctx, async (tx) => {
    await refreshMerchantOnTx(tx, ctx.tenantId);
  });
}

async function refreshMerchantOnTx(tx: TxClient, tenantId: string): Promise<void> {
  const profile = await tx.marketMerchantProfile.findUnique({ where: { tenantId } });
  if (!profile?.enabled) {
    await tx.marketMerchant.deleteMany({ where: { tenantId } });
    return;
  }
  const identity = await resolveMerchantIdentity(tx, tenantId, {
    marketPropertyId: profile.marketPropertyId,
    handle: profile.handle,
  });
  if (!identity.slug) return;
  const listingCount = await tx.marketListing.count({ where: { tenantId } });
  const bannerUrl = await resolveMediaUrl(tx, profile.bannerMediaId);

  // Seller trust rating (docs/117 S5): review-count-weighted mean across the
  // tenant's own listings (market_listings grants unconditional SELECT), so it
  // refreshes whenever any listing's rating changes and re-projects.
  const [ratingRow] = await tx.$queryRaw<{ rating: number | null; ratingCount: number }[]>`
    SELECT
      SUM(average_rating * review_count) / NULLIF(SUM(review_count), 0) AS rating,
      COALESCE(SUM(review_count), 0)::int AS "ratingCount"
    FROM market_listings
    WHERE tenant_id = ${tenantId}::uuid
  `;
  const rating = ratingRow?.rating ?? null;
  const ratingCount = ratingRow?.ratingCount ?? 0;

  const data = {
    tenantId,
    propertyId: profile.marketPropertyId,
    slug: identity.slug,
    name: identity.name,
    logoUrl: identity.logoUrl,
    bannerUrl,
    bio: profile.bio,
    location: profile.location,
    headline: profile.headline,
    siteUrl: storefrontBaseUrl(identity.storefrontSlug),
    socials: identity.socials as object,
    listingCount,
    rating,
    ratingCount,
    approved: true,
  };
  await tx.marketMerchant.upsert({
    where: { tenantId },
    create: data,
    update: data,
  });
}

/** Project ONE product into the marketplace catalog: upsert the listing row when the
 *  product is eligible, remove it otherwise, then refresh the merchant directory row
 *  (count + identity). The single projection entry point for product mutations. */
export async function projectMarketListing(ctx: ServiceContext, productId: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const profile = await tx.marketMerchantProfile.findUnique({
      where: { tenantId: ctx.tenantId },
      select: { enabled: true, defaultCategory: true, marketPropertyId: true, handle: true },
    });
    const product = await tx.product.findFirst({
      where: { id: productId, tenantId: ctx.tenantId },
      select: {
        id: true,
        title: true,
        handle: true,
        description: true,
        status: true,
        deletedAt: true,
        marketListed: true,
        marketCategory: true,
        marketFeatured: true,
        marketApproved: true,
        priceMinCents: true,
        priceMaxCents: true,
        inStock: true,
        averageRating: true,
        reviewCount: true,
        bestSellerRank: true,
        publishedAt: true,
        images: {
          where: { variantId: null },
          orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
          take: 1,
          select: { mediaAssetId: true },
        },
        // All active variants' inventory drives the low-stock signal (and the first
        // variant's currency). Bounded — a product carries a handful of variants.
        variants: {
          where: { deletedAt: null },
          select: {
            currency: true,
            inventoryLevels: {
              select: {
                onHand: true,
                allocated: true,
                safetyBuffer: true,
                unsellableOnHand: true,
              },
            },
          },
        },
      },
    });

    const eligible =
      !!profile?.enabled &&
      !!product &&
      product.deletedAt === null &&
      product.status === 'active' &&
      product.marketListed &&
      product.marketApproved;

    if (!eligible || !product) {
      await tx.marketListing.deleteMany({ where: { productId } });
      await refreshMerchantOnTx(tx, ctx.tenantId);
      return;
    }

    const identity = await resolveMerchantIdentity(tx, ctx.tenantId, {
      marketPropertyId: profile?.marketPropertyId ?? null,
      handle: profile?.handle ?? null,
    });
    if (!identity.slug) return;

    const slug = await uniqueListingSlug(tx, product.handle, product.id);
    const imageUrl = await resolveMediaUrl(tx, product.images[0]?.mediaAssetId ?? null);
    const category = product.marketCategory ?? profile?.defaultCategory ?? 'general';
    const descriptionSnippet = product.description
      ? product.description
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 480)
      : null;
    const searchText = [product.title, descriptionSnippet, identity.name, category]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .slice(0, 4000);

    // Total sellable across every tracked variant (mirrors getListingDetail's
    // per-variant math). An untracked product (no inventory levels) is never "low".
    const sellable = product.variants.reduce(
      (sum, v) =>
        sum +
        v.inventoryLevels.reduce(
          (s, l) => s + Math.max(0, l.onHand - l.allocated - l.safetyBuffer - l.unsellableOnHand),
          0
        ),
      0
    );
    const tracked = product.variants.some((v) => v.inventoryLevels.length > 0);
    const lowStock =
      product.inStock && tracked && sellable > 0 && sellable <= MARKET_LOW_STOCK_THRESHOLD;

    const data = {
      tenantId: ctx.tenantId,
      productId: product.id,
      merchantSlug: identity.slug,
      merchantName: identity.name,
      merchantLogoUrl: identity.logoUrl,
      title: product.title,
      handle: product.handle,
      slug,
      descriptionSnippet,
      imageUrl,
      category,
      priceMinCents: product.priceMinCents,
      priceMaxCents: product.priceMaxCents,
      currency: product.variants[0]?.currency ?? 'USD',
      inStock: product.inStock,
      averageRating: product.averageRating,
      reviewCount: product.reviewCount,
      bestSellerRank: product.bestSellerRank,
      lowStock,
      featured: product.marketFeatured,
      productUrl: storefrontProductUrl(identity.storefrontSlug, product.handle),
      searchText,
      publishedAt: product.publishedAt,
    };

    await tx.marketListing.upsert({
      where: { productId: product.id },
      create: data,
      update: data,
    });
    await refreshMerchantOnTx(tx, ctx.tenantId);
  });
}

/** Remove a product's listing (opt-out, archive, delete) + refresh the merchant. */
export async function removeMarketListing(ctx: ServiceContext, productId: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    await tx.marketListing.deleteMany({ where: { productId } });
    await refreshMerchantOnTx(tx, ctx.tenantId);
  });
}

/**
 * Tear down the tenant's entire marketplace presence (on disable): remove every
 * listing + the merchant directory row in one shot.
 *
 * ALSO THE ONLY THING THAT CLEANS UP AFTER A DELETED TENANT. `market_listings` and
 * `market_merchants` are FK-less by design (they are read cross-tenant, so they do not
 * relate to `Tenant`), which means no `ON DELETE CASCADE` reaches them — deleting a
 * tenant leaves both rows behind, live and unreferenced. `market_merchants.slug` is
 * globally unique, so an abandoned row also holds a public handle forever. There is no
 * tenant-delete path in the product today; the day one ships, it must call this first.
 * The test fixtures' `dropTestTenant` already does, and the note there explains what it
 * cost to find out.
 */
export async function removeAllMarketProjection(ctx: ServiceContext): Promise<void> {
  await withTenant(ctx, async (tx) => {
    await tx.marketListing.deleteMany({ where: { tenantId: ctx.tenantId } });
    await tx.marketMerchant.deleteMany({ where: { tenantId: ctx.tenantId } });
  });
}

/** Re-project every product the tenant currently has flagged `marketListed` — used
 *  when a merchant RE-ENABLES participation after a pause (the flags survive a
 *  disable; the projection rows do not). Bounded by the catalog's listed count. */
export async function reprojectAllListed(ctx: ServiceContext): Promise<void> {
  const productIds = await withTenant(ctx, (tx) =>
    tx.product
      .findMany({
        where: { tenantId: ctx.tenantId, marketListed: true, deletedAt: null },
        select: { id: true },
      })
      .then((rows) => rows.map((r) => r.id))
  );
  for (const productId of productIds) {
    await projectMarketListing(ctx, productId);
  }
  await refreshMarketMerchant(ctx);
}
