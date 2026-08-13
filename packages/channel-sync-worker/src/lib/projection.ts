// Builds the normalized ChannelProductInput the feed adapters push, from a sparx
// product + its variants/images/inventory (docs/106 §4.2). Pure read — the worker
// owns every DB write elsewhere.
//
// Two trivial pure helpers are INLINED here rather than dragging @sparx/inventory
// and @sparx/commerce (and their transitive closures) into a lean sync worker —
// each carries a pointer comment to its source of truth:
//   - sellable(): the canonical availability rule (@sparx/inventory
//     services/availability.ts — Σ max(0, onHand − allocated − safetyBuffer)); a
//     variant with NO stock rows is untracked → treated as in stock.
//   - mediaUrl(): the MediaAsset key → absolute URL prefix (@sparx/commerce
//     media-url.ts — verbatim for hot-linked http keys, else CDN/bucket prefix).

import type { Logger } from 'pino';
import { withTenant } from '@sparx/db';
import type { ChannelProductInput, ChannelProductVariantInput } from '@sparx/channels';

// Storefront base, mirroring the email path's siteLink (SPARX_SITE_BASE with a
// {slug} placeholder, e.g. https://{slug}.sparx.zone). Custom-domain resolution is
// deferred platform-wide (same as email-data.ts); a feed needs an ABSOLUTE URL, so
// with no base configured the product is skipped, never fed a broken link.
const SITE_BASE = process.env.SPARX_SITE_BASE ?? '';

function storefrontUrl(tenantSlug: string, handle: string): string | null {
  if (!SITE_BASE) return null;
  const base = SITE_BASE.replace('{slug}', tenantSlug).replace(/\/$/, '');
  return `${base}/products/${encodeURIComponent(handle)}`;
}

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
 *  @sparx/inventory computeAvailability. */
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

/** Load the product (+ variants/options/inventory), the tenant slug, and the
 *  product-level image asset keys in one RLS-scoped read. */
function loadProductData(tenantId: string, productId: string) {
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
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
    const assetIds = product.images.map((i) => i.mediaAssetId);
    // mediaAssetId is a soft pointer (no FK) — resolve keys with a second read.
    const assets = assetIds.length
      ? await tx.mediaAsset.findMany({
          where: { id: { in: assetIds }, deletedAt: null },
          select: { id: true, key: true },
        })
      : [];
    return { product, slug: tenant?.slug ?? null, assets };
  });
}

export async function buildChannelProduct(
  tenantId: string,
  productId: string,
  log: Logger
): Promise<ChannelProductInput | null> {
  const data = await loadProductData(tenantId, productId);

  if (!data?.product) {
    log.debug({ productId }, 'channel-sync: product not found / deleted — skipping');
    return null;
  }
  const { product, slug, assets } = data;
  if (!slug) {
    log.warn({ productId, tenantId }, 'channel-sync: tenant slug unresolved — skipping push');
    return null;
  }
  const productUrl = storefrontUrl(slug, product.handle);
  if (!productUrl) {
    log.warn(
      { productId },
      'channel-sync: SPARX_SITE_BASE unset — cannot build an absolute product URL, skipping'
    );
    return null;
  }
  if (product.variants.length === 0) {
    log.debug({ productId }, 'channel-sync: product has no active variants — skipping');
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
