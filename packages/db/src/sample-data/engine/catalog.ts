// Catalog slice — categories, collections, products (+ options, variants, joins).
// Gated on `commerce`. Populates the ctx id-maps every downstream slice reads.
//
// The category `path` is a dot-separated materialized path of handles (matches
// categoryService); products/collections/categories all use the `sample-` handle
// prefix so Clear finds them and they never collide with a tenant's own catalog.
// In-stock + price-range read columns are written directly (no event consumer
// runs against a seeded/loaded tenant).

import { sampleHandle, withSampleMeta } from '../markers';
import type { SampleDataPack, SampleProduct } from '../types';
import type { ApplyCtx, VariantMeta } from './context';

function variantStockSum(p: SampleProduct): boolean {
  return p.variants.some(
    (v) => (v.stock ?? []).flatMap((s) => s.movements).reduce((sum, m) => sum + m.delta, 0) > 0
  );
}

export async function applyCatalog(ctx: ApplyCtx, pack: SampleDataPack): Promise<void> {
  if (!ctx.isOn('commerce')) return;
  const { tx, tenantId } = ctx;

  // Categories — parents first (the pack lists them so), path from parent.
  const pathByKey = new Map<string, string>();
  for (const cat of pack.categories ?? []) {
    const handle = sampleHandle(cat.handle);
    const parentPath = cat.parentKey ? pathByKey.get(cat.parentKey) : undefined;
    const path = parentPath ? `${parentPath}.${handle}` : handle;
    const row = await tx.productCategory.create({
      data: {
        tenantId,
        parentId: cat.parentKey ? (ctx.categoryIdByKey.get(cat.parentKey) ?? null) : null,
        path,
        name: cat.name,
        handle,
        description: cat.description ?? null,
        featured: cat.featured ?? false,
      },
      select: { id: true },
    });
    ctx.categoryIdByKey.set(cat.key, row.id);
    pathByKey.set(cat.key, path);
    ctx.counts.categories += 1;
  }

  // Collections.
  for (const col of pack.collections ?? []) {
    const row = await tx.productCollection.create({
      data: {
        tenantId,
        name: col.name,
        handle: sampleHandle(col.handle),
        description: col.description ?? null,
        type: 'manual',
        featured: col.featured ?? false,
      },
      select: { id: true },
    });
    ctx.collectionIdByKey.set(col.key, row.id);
    ctx.counts.collections += 1;
  }

  // Products → options → variants → joins.
  for (const p of pack.products) {
    const prices = p.variants.map((v) => v.priceCents);
    const inStock = ctx.isOn('inventory') ? variantStockSum(p) : (p.inStock ?? true);
    const product = await tx.product.create({
      data: {
        tenantId,
        title: p.title,
        handle: sampleHandle(p.handle),
        description: p.description,
        status: 'active',
        productType: p.productType,
        vendor: p.vendor,
        tags: p.tags ?? [],
        fulfillmentType: p.fulfillmentType ?? 'physical',
        hazmatClass: p.hazmatClass ?? 'none',
        requiresShipping: (p.fulfillmentType ?? 'physical') === 'physical',
        seoTitle: p.seoTitle ?? null,
        seoDescription: p.seoDescription ?? null,
        priceMinCents: Math.min(...prices),
        priceMaxCents: Math.max(...prices),
        inStock,
        publishedAt: new Date(ctx.now),
        metadata: withSampleMeta(),
      },
      select: { id: true },
    });
    ctx.productIdByKey.set(p.key, product.id);
    ctx.counts.products += 1;

    // Options + values (only when authored) — value string → optionValueId.
    const valueIdByName = new Map<string, string>();
    for (const [oi, opt] of (p.options ?? []).entries()) {
      const option = await tx.productOption.create({
        data: {
          tenantId,
          productId: product.id,
          name: opt.name,
          displayType: opt.displayType ?? 'dropdown',
          position: oi,
        },
        select: { id: true },
      });
      for (const [vi, val] of opt.values.entries()) {
        const ov = await tx.productOptionValue.create({
          data: {
            tenantId,
            optionId: option.id,
            value: val.value,
            swatchHex: val.swatchHex ?? null,
            position: vi,
          },
          select: { id: true },
        });
        valueIdByName.set(val.value, ov.id);
      }
    }

    for (const [vi, v] of p.variants.entries()) {
      const variant = await tx.productVariant.create({
        data: {
          tenantId,
          productId: product.id,
          sku: v.sku,
          title: v.title,
          priceCents: v.priceCents,
          compareAtPriceCents: v.compareAtPriceCents ?? null,
          costCents: v.costCents,
          currency: 'USD',
          isDefault: vi === 0,
          position: vi,
          metadata: withSampleMeta(),
        },
        select: { id: true },
      });
      // Wire the option lattice when the variant pins values.
      for (const valueName of v.optionValues ?? []) {
        const optionValueId = valueIdByName.get(valueName);
        if (optionValueId) {
          await tx.productVariantOptionValue.create({
            data: { variantId: variant.id, optionValueId },
          });
        }
      }
      const meta: VariantMeta = {
        id: variant.id,
        productId: product.id,
        productKey: p.key,
        productTitle: p.title,
        sku: v.sku,
        title: v.title,
        priceCents: v.priceCents,
        costCents: v.costCents,
      };
      const vkey = v.key ?? v.sku;
      ctx.variantsByKey.set(vkey, meta);
      ctx.variantOrder.push(vkey);
    }

    // Category + collection memberships.
    for (const [ci, catKey] of (p.categoryKeys ?? []).entries()) {
      const categoryId = ctx.categoryIdByKey.get(catKey);
      if (categoryId) {
        await tx.categoryProduct.create({
          data: { categoryId, productId: product.id, isPrimary: ci === 0, position: ci },
        });
      }
    }
    for (const [ci, colKey] of (p.collectionKeys ?? []).entries()) {
      const collectionId = ctx.collectionIdByKey.get(colKey);
      if (collectionId) {
        await tx.collectionProduct.create({
          data: { collectionId, productId: product.id, position: ci },
        });
      }
    }
  }
}
