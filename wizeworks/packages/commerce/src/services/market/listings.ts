// sparx.market product opt-in (docs/106 §4.7, docs/72 §2) — toggling a product into
// the public marketplace catalog.
//
// Opt-in sets the product-graph flags (marketListed / marketCategory /
// marketFeatured) on commerce_products and SYNCHRONOUSLY projects the listing, so a
// product appears on sparx.market the moment it is listed. Listing requires the
// tenant to participate (MarketMerchantProfile.enabled); un-listing never does.

import { withTenant } from '@wizeworks/db';
import { MarketBulkOptInInput, MarketProductOptInInput } from '@wizeworks/commerce-schemas';

import { writeAuditLog } from '../../audit';
import { CommerceNotFoundError, CommerceValidationError } from '../../errors';
import type { ServiceContext } from '../../errors';

import { projectMarketListing, removeMarketListing } from './projection';

export interface ProductMarketState {
  productId: string;
  listed: boolean;
  category: string | null;
  featured: boolean;
  approved: boolean;
}

async function assertParticipating(ctx: ServiceContext): Promise<void> {
  const profile = await withTenant(ctx, (tx) =>
    tx.marketMerchantProfile.findUnique({
      where: { tenantId: ctx.tenantId },
      select: { enabled: true },
    })
  );
  if (!profile?.enabled) {
    throw new CommerceValidationError(
      'Enable sparx.market for your store before listing products on it.'
    );
  }
}

/** List or un-list a single product, set its category/featured, and project. */
export async function setProductOptIn(
  ctx: ServiceContext,
  productId: string,
  input: MarketProductOptInInput,
  opts: { allowFeatured?: boolean } = {}
): Promise<ProductMarketState> {
  const data = MarketProductOptInInput.parse(input);
  if (data.listed) await assertParticipating(ctx);

  const product = await withTenant(ctx, async (tx) => {
    const existing = await tx.product.findFirst({
      where: { id: productId, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true, marketCategory: true, marketFeatured: true, marketApproved: true },
    });
    if (!existing) throw new CommerceNotFoundError('Product', productId);

    const updated = await tx.product.update({
      where: { id: productId },
      data: {
        marketListed: data.listed,
        marketCategory:
          data.category ?? existing.marketCategory ?? (data.listed ? 'general' : null),
        ...(opts.allowFeatured && data.featured !== undefined
          ? { marketFeatured: data.featured }
          : {}),
      },
      select: {
        id: true,
        marketListed: true,
        marketCategory: true,
        marketFeatured: true,
        marketApproved: true,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: data.listed ? 'commerce.market.product_listed' : 'commerce.market.product_unlisted',
      entityType: 'Product',
      entityId: productId,
      diff: { after: { marketListed: data.listed, marketCategory: updated.marketCategory } },
    });
    return updated;
  });

  if (product.marketListed) {
    await projectMarketListing(ctx, productId);
  } else {
    await removeMarketListing(ctx, productId);
  }

  return {
    productId: product.id,
    listed: product.marketListed,
    category: product.marketCategory,
    featured: product.marketFeatured,
    approved: product.marketApproved,
  };
}

/** Bulk list / un-list from the products table selection. */
export async function bulkSetProductOptIn(
  ctx: ServiceContext,
  input: MarketBulkOptInInput
): Promise<{ updated: number }> {
  const data = MarketBulkOptInInput.parse(input);
  if (data.listed) await assertParticipating(ctx);

  const ids = await withTenant(ctx, async (tx) => {
    const products = await tx.product.findMany({
      where: { id: { in: data.productIds }, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    const found = products.map((p) => p.id);
    if (found.length === 0) return [];
    await tx.product.updateMany({
      where: { id: { in: found }, tenantId: ctx.tenantId },
      data: {
        marketListed: data.listed,
        ...(data.category ? { marketCategory: data.category } : {}),
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: data.listed ? 'commerce.market.bulk_listed' : 'commerce.market.bulk_unlisted',
      entityType: 'Product',
      entityId: found[0] ?? '',
      diff: { after: { count: found.length, listed: data.listed } },
    });
    return found;
  });

  for (const productId of ids) {
    if (data.listed) {
      await projectMarketListing(ctx, productId);
    } else {
      await removeMarketListing(ctx, productId);
    }
  }
  return { updated: ids.length };
}

export interface OptedInProductRow {
  productId: string;
  title: string;
  handle: string;
  category: string | null;
  featured: boolean;
  approved: boolean;
  inStock: boolean;
  priceMinCents: number | null;
}

/** The tenant's currently-listed products, for the dashboard management table. */
export async function listOptedInProducts(
  ctx: ServiceContext,
  opts: { take?: number; skip?: number } = {}
): Promise<{ rows: OptedInProductRow[]; total: number }> {
  const take = Math.min(Math.max(opts.take ?? 50, 1), 200);
  const skip = Math.max(opts.skip ?? 0, 0);
  return withTenant(ctx, async (tx) => {
    const where = { tenantId: ctx.tenantId, marketListed: true, deletedAt: null };
    const [products, total] = await Promise.all([
      tx.product.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take,
        skip,
        select: {
          id: true,
          title: true,
          handle: true,
          marketCategory: true,
          marketFeatured: true,
          marketApproved: true,
          inStock: true,
          priceMinCents: true,
        },
      }),
      tx.product.count({ where }),
    ]);
    return {
      rows: products.map((p) => ({
        productId: p.id,
        title: p.title,
        handle: p.handle,
        category: p.marketCategory,
        featured: p.marketFeatured,
        approved: p.marketApproved,
        inStock: p.inStock,
        priceMinCents: p.priceMinCents,
      })),
      total,
    };
  });
}
