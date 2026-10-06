// Builds the normalized ChannelProductInput the feed adapters push, from a sparx
// product + its variants/images/inventory (docs/106 §4.2). Pure read — the worker
// owns every DB write elsewhere.
//
// Two trivial pure helpers are INLINED here rather than dragging @wizeworks/inventory
// and @wizeworks/commerce (and their transitive closures) into a lean sync worker —
// each carries a pointer comment to its source of truth:
//   - sellable(): the canonical availability rule (@wizeworks/inventory
//     services/availability.ts — Σ max(0, onHand − allocated − safetyBuffer)); a
//     variant with NO stock rows is untracked → treated as in stock.
//   - mediaUrl(): the MediaAsset key → absolute URL prefix (@wizeworks/commerce
//     media-url.ts — verbatim for hot-linked http keys, else CDN/bucket prefix).

import type { Logger } from 'pino';
import { withTenant } from '@wizeworks/db';
import { resolveSiteOrigin, siteShowingRow, siteUrl } from '@wizeworks/db/site-origin';
import type { ChannelProductInput, ChannelProductVariantInput } from '@wizeworks/channels';

// ── THE PRODUCT PAGE A CHANNEL SENDS SHOPPERS TO ───────────────────────────
//
// Every feed (Google Shopping, Meta, Pinterest, Faire, ...) requires an ABSOLUTE
// link to the product's page. It used to be `SPARX_SITE_BASE` with the tenant slug
// substituted, and the push was skipped when that was unset. Nothing sets it, so no
// product was ever pushed to any channel (sparx persona issue 064). The link is now
// the site's real address, from the one resolver every customer-facing link uses.
//
// WHICH SITE. A channel connection belongs to one business (docs/131 §4), so the
// link opens on the connection's site. A connection with no site is tenant-wide, and
// the product then links to a site that shows it (the primary, unless it was scoped
// to particular sites). A product scoped only to a DIFFERENT business than the
// connection's is not that shop's product at all, so it is not pushed there: its
// page on the connection's site would be a 404, and its page anywhere else would be
// another business's listing under this shop's name.

function mediaUrl(key: string): string {
  if (/^https?:\/\//i.test(key)) return key;
  const cdn = process.env.SPARX_MEDIA_CDN_URL;
  if (cdn) return `${cdn.replace(/\/$/, '')}/${key.replace(/^\//, '')}`;
  const bucket = process.env.GCS_MEDIA_PUBLIC_BUCKET ?? process.env.GCS_MEDIA_BUCKET;
  if (bucket) return `https://storage.googleapis.com/${bucket}/${key.replace(/^\//, '')}`;
  return key;
}

interface LevelLite {
  onHand: number;
  allocated: number;
  safetyBuffer: number;
  /** Units on a shelf nothing sells from — quarantine, damaged, awaiting repair
   *  (docs/146 Phase 9.7). Zero on a location without shelves. */
  unsellableOnHand: number;
}

/** Sellable units across warehouses, net of the safety buffer. `null` when the
 *  variant has no stock rows (untracked → unbounded supply → in stock). Mirror of
 *  @wizeworks/inventory computeAvailability. */
function sellable(levels: LevelLite[]): number | null {
  if (levels.length === 0) return null;
  return levels.reduce(
    (sum, l) =>
      // Quarantined / damaged / awaiting-repair units are in the building and
      // not for sale (docs/146 Phase 9.7). Publishing them to a marketplace is
      // an oversell with a third party's cancellation policy attached.
      sum + Math.max(0, l.onHand - l.allocated - l.safetyBuffer - l.unsellableOnHand),
    0
  );
}

/** Sellable quantity for one variant — used by the inventory-push handler. */
export async function sellableForVariant(
  tenantId: string,
  variantId: string
): Promise<number | null> {
  const levels = await withTenant({ tenantId }, (tx) =>
    tx.inventoryLevel.findMany({
      where: { tenantId, variantId },
      select: { onHand: true, allocated: true, safetyBuffer: true, unsellableOnHand: true },
    })
  );
  return sellable(levels);
}

/** Load the product (+ variants/options/inventory), the absolute URL of its page on
 *  the channel's site, and the product-level image asset keys in one RLS-scoped
 *  read. `productUrl` is null when the product is not shown on that site. */
function loadProductData(tenantId: string, productId: string, channelSiteId: string | null) {
  return withTenant({ tenantId }, async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null },
      select: {
        id: true,
        title: true,
        description: true,
        handle: true,
        productType: true,
        vendor: true,
        tags: true,
        // Which sites show it (none = every site).
        propertyLinks: { select: { propertyId: true } },
        variants: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            sku: true,
            title: true,
            barcode: true,
            priceCents: true,
            currency: true,
            weightGrams: true,
            optionAssignments: {
              select: {
                optionValue: { select: { value: true, option: { select: { name: true } } } },
              },
            },
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
        images: {
          where: { variantId: null },
          orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
          select: { mediaAssetId: true },
        },
      },
    });
    if (!product) return null;
    const linked = product.propertyLinks.map((l) => l.propertyId);
    const shownOnChannelSite =
      channelSiteId === null || linked.length === 0 || linked.includes(channelSiteId);
    const productUrl = shownOnChannelSite
      ? siteUrl(
          await resolveSiteOrigin(tx, tenantId, siteShowingRow(linked, channelSiteId)),
          `/products/${encodeURIComponent(product.handle)}`
        )
      : null;
    const assetIds = product.images.map((i) => i.mediaAssetId);
    // mediaAssetId is a soft pointer (no FK) — resolve keys with a second read.
    const assets = assetIds.length
      ? await tx.mediaAsset.findMany({
          where: { id: { in: assetIds }, deletedAt: null },
          select: { id: true, key: true },
        })
      : [];
    return { product, productUrl, assets };
  });
}

/** The listing to push for one product to the channels of ONE site (`channelSiteId`,
 *  the connection's `propertyId`; null = a tenant-wide connection). Null when there
 *  is nothing to push there, with the reason logged. */
export async function buildChannelProduct(
  tenantId: string,
  productId: string,
  channelSiteId: string | null,
  log: Logger
): Promise<ChannelProductInput | null> {
  const data = await loadProductData(tenantId, productId, channelSiteId);

  if (!data?.product) {
    log.debug({ productId }, 'channel-sync: product not found / deleted, skipping');
    return null;
  }
  const { product, productUrl, assets } = data;
  if (!productUrl) {
    log.debug(
      { productId, channelSiteId },
      "channel-sync: product is not shown on this channel's site, skipping"
    );
    return null;
  }
  if (product.variants.length === 0) {
    log.debug({ productId }, 'channel-sync: product has no active variants, skipping');
    return null;
  }

  const keyById = new Map(assets.map((a) => [a.id, a.key]));
  const imageUrls = product.images
    .map((i) => keyById.get(i.mediaAssetId))
    .filter((k): k is string => !!k)
    .map(mediaUrl);

  const variants: ChannelProductVariantInput[] = product.variants.map((v) => {
    const options: Record<string, string> = {};
    for (const a of v.optionAssignments) {
      options[a.optionValue.option.name] = a.optionValue.value;
    }
    const qty = sellable(v.inventoryLevels);
    return {
      variantId: v.id,
      sku: v.sku,
      title: v.title ?? (Object.values(options).join(' / ') || product.title),
      options,
      priceCents: v.priceCents,
      // null (untracked) → 1 so feed channels read it as "in stock".
      availableQuantity: qty ?? 1,
      barcode: v.barcode ?? undefined,
      weightGrams: v.weightGrams ?? undefined,
    };
  });

  return {
    productId: product.id,
    title: product.title,
    description: product.description,
    imageUrls,
    // productType is a free-text proxy for the channel category; the precise
    // Google-taxonomy mapping is a later refinement (docs/106).
    category: product.productType,
    tags: product.tags,
    productUrl,
    currency: product.variants[0]?.currency ?? 'USD',
    brand: product.vendor,
    variants,
  };
}
