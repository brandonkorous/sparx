// Dropship import → option lattice (the "imported product shows no variant
// picker" bug). A supplier-imported product carries its options inline on each
// normalized variant ({ Size: '3x3' }), but the storefront variant picker renders
// from ProductOption rows and resolves the chosen SKU via the
// ProductVariantOptionValue lattice. The import used to create bare variants and
// drop the options, so a 4-variant sticker showed NO size picker and stranded the
// buyer on the default variant.
//
// This pins the fix end-to-end against real Postgres + RLS, through the real HTTP
// routes:
//   • import materializes ProductOption + values (first-seen order) and pins each
//     variant onto its lattice point;
//   • a single-option-less variant imports with zero options (no spurious picker);
//   • re-sync (reimport) BACKFILLS the lattice for a product imported before the
//     fix, without clobbering a product that already has options.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { invalidateModuleCache } from '@sparx/auth';
import { prisma, withTenant } from '@sparx/db';
import { createApp } from '../../src/app.js';
import {
  authHeader,
  signToken,
  createTestTenant,
  dropTestTenant,
  type TestTenant,
} from '../helpers.js';

// Printify-shaped normalized variants: each carries its options inline, plus the
// per-variant mockups the adapter resolved from the supplier's `variant_ids`. The
// `shared.png` URL recurs across every variant (as a colour mockup would across
// its sizes) so the import's MediaAsset dedupe is exercised.
const SIZE_VARIANTS = [
  {
    supplierSku: 'PP1:101',
    title: '2x2',
    options: { Size: '2x2' },
    costPriceCents: 142,
    msrpCents: 236,
    inventoryQuantity: null,
    weight: 5,
    imageUrls: ['https://example.test/2x2.png', 'https://example.test/shared.png'],
  },
  {
    supplierSku: 'PP1:102',
    title: '3x3',
    options: { Size: '3x3' },
    costPriceCents: 158,
    msrpCents: 263,
    inventoryQuantity: null,
    weight: 7,
    imageUrls: ['https://example.test/3x3.png', 'https://example.test/shared.png'],
  },
  {
    supplierSku: 'PP1:103',
    title: '4x4',
    options: { Size: '4x4' },
    costPriceCents: 200,
    msrpCents: 333,
    inventoryQuantity: null,
    weight: 9,
    imageUrls: ['https://example.test/4x4.png', 'https://example.test/shared.png'],
  },
  {
    supplierSku: 'PP1:104',
    title: '6x6',
    options: { Size: '6x6' },
    costPriceCents: 232,
    msrpCents: 386,
    inventoryQuantity: null,
    weight: 12,
    imageUrls: ['https://example.test/6x6.png', 'https://example.test/shared.png'],
  },
];

async function enableDropship(tenantId: string): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: { modules: { dropship: { enabled: true } } } },
  });
  invalidateModuleCache();
}

async function seedSupplier(t: TestTenant): Promise<string> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const s = await tx.dropshipSupplier.create({
      data: { tenantId: t.tenantId, name: 'Printify Test', type: 'printful', status: 'active' },
      select: { id: true },
    });
    return s.id;
  });
}

async function seedDropshipProduct(
  t: TestTenant,
  supplierId: string,
  supplierProductId: string,
  variants: unknown[]
): Promise<string> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const dp = await tx.dropshipProduct.create({
      data: {
        tenantId: t.tenantId,
        supplierId,
        supplierProductId,
        title: 'Kiss-Cut Stickers',
        description: 'A kiss-cut sticker.',
        images: ['https://example.test/sticker.png'],
        variants: variants as object[],
        costPriceCents: 142,
        msrpCents: 236,
      },
      select: { id: true },
    });
    return dp.id;
  });
}

describe('dropship import → product option lattice', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('import materializes the option lattice and pins each variant', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableDropship(t.tenantId);
      const token = signToken(app, t);
      const supplierId = await seedSupplier(t);
      const dpId = await seedDropshipProduct(t, supplierId, 'PP1', SIZE_VARIANTS);

      const res = await app.inject({
        method: 'POST',
        url: `/v1/dropship/suppliers/${supplierId}/catalog/${dpId}/import`,
        headers: authHeader(token),
        payload: {},
      });
      expect(res.statusCode).toBe(201);
      const productId = res.json().data.productId as string;
      expect(res.json().data.variantCount).toBe(4);

      const { options, variants } = await withTenant({ tenantId: t.tenantId }, async (tx) => {
        const options = await tx.productOption.findMany({
          where: { productId },
          orderBy: { position: 'asc' },
          include: { values: { orderBy: { position: 'asc' } } },
        });
        const variants = await tx.productVariant.findMany({
          where: { productId, deletedAt: null },
          orderBy: { position: 'asc' },
          include: { optionAssignments: { include: { optionValue: true } } },
        });
        return { options, variants };
      });

      // Exactly one "Size" option with its four values in supplier order.
      expect(options).toHaveLength(1);
      expect(options[0]!.name).toBe('Size');
      expect(options[0]!.values.map((v) => v.value)).toEqual(['2x2', '3x3', '4x4', '6x6']);

      // Every variant is pinned to exactly its own size — this is what lets the
      // storefront resolve a picked size back to a SKU.
      expect(variants).toHaveLength(4);
      for (const v of variants) {
        expect(v.optionAssignments).toHaveLength(1);
        expect(v.optionAssignments[0]!.optionValue.value).toBe(v.title);
      }
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('imports a single optionless variant with no spurious options', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableDropship(t.tenantId);
      const token = signToken(app, t);
      const supplierId = await seedSupplier(t);
      const dpId = await seedDropshipProduct(t, supplierId, 'PP-SOLO', [
        {
          supplierSku: 'PPX:1',
          title: 'Default',
          options: {},
          costPriceCents: 500,
          msrpCents: 900,
          inventoryQuantity: null,
          weight: 10,
        },
      ]);

      const res = await app.inject({
        method: 'POST',
        url: `/v1/dropship/suppliers/${supplierId}/catalog/${dpId}/import`,
        headers: authHeader(token),
        payload: {},
      });
      expect(res.statusCode).toBe(201);
      const productId = res.json().data.productId as string;

      const optionCount = await withTenant({ tenantId: t.tenantId }, (tx) =>
        tx.productOption.count({ where: { productId } })
      );
      expect(optionCount).toBe(0);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('re-sync backfills the lattice for a product imported before the fix', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableDropship(t.tenantId);
      const token = signToken(app, t);
      const supplierId = await seedSupplier(t);
      const dpId = await seedDropshipProduct(t, supplierId, 'PP-BACKFILL', SIZE_VARIANTS);

      // Reproduce the pre-fix state: a commerce product + variants (sku =
      // supplierSku) with NO options, linked to the dropship product.
      const productId = await withTenant({ tenantId: t.tenantId }, async (tx) => {
        const product = await tx.product.create({
          data: {
            tenantId: t.tenantId,
            title: 'Kiss-Cut Stickers',
            handle: `kiss-cut-${Date.now()}`,
            status: 'draft',
            inStock: true,
            metadata: { dropshipSupplierId: supplierId, dropshipProductId: dpId },
          },
          select: { id: true },
        });
        for (const [idx, v] of SIZE_VARIANTS.entries()) {
          await tx.productVariant.create({
            data: {
              tenantId: t.tenantId,
              productId: product.id,
              sku: v.supplierSku,
              title: v.title,
              priceCents: v.msrpCents,
              costCents: v.costPriceCents,
              currency: 'USD',
              inventoryPolicy: 'continue',
              isDefault: idx === 0,
              position: idx,
              dropshipSourceId: supplierId,
            },
          });
        }
        await tx.dropshipProductLink.create({
          data: {
            tenantId: t.tenantId,
            productId: product.id,
            dropshipProductId: dpId,
            supplierSku: SIZE_VARIANTS[0]!.supplierSku,
            status: 'active',
          },
        });
        return product.id;
      });

      // Precondition: the bug state — variants but no options.
      const before = await withTenant({ tenantId: t.tenantId }, (tx) =>
        tx.productOption.count({ where: { productId } })
      );
      expect(before).toBe(0);

      const res = await app.inject({
        method: 'POST',
        url: `/v1/dropship/suppliers/${supplierId}/catalog/${dpId}/reimport`,
        headers: authHeader(token),
        payload: {},
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.optionsAdded).toBe(4);

      const { options, assignmentCount } = await withTenant(
        { tenantId: t.tenantId },
        async (tx) => {
          const options = await tx.productOption.findMany({
            where: { productId },
            include: { values: { orderBy: { position: 'asc' } } },
          });
          const assignmentCount = await tx.productVariantOptionValue.count({
            where: { variant: { productId } },
          });
          return { options, assignmentCount };
        }
      );
      expect(options).toHaveLength(1);
      expect(options[0]!.values.map((v) => v.value)).toEqual(['2x2', '3x3', '4x4', '6x6']);
      expect(assignmentCount).toBe(4);

      // Idempotent: a second re-sync (product now HAS options) backfills nothing.
      const again = await app.inject({
        method: 'POST',
        url: `/v1/dropship/suppliers/${supplierId}/catalog/${dpId}/reimport`,
        headers: authHeader(token),
        payload: {},
      });
      expect(again.statusCode).toBe(200);
      expect(again.json().data.optionsAdded).toBe(0);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('pins each variant’s mockups to its SKU and dedupes shared URLs', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableDropship(t.tenantId);
      const token = signToken(app, t);
      const supplierId = await seedSupplier(t);
      const dpId = await seedDropshipProduct(t, supplierId, 'PP-IMG', SIZE_VARIANTS);

      const res = await app.inject({
        method: 'POST',
        url: `/v1/dropship/suppliers/${supplierId}/catalog/${dpId}/import`,
        headers: authHeader(token),
        payload: {},
      });
      expect(res.statusCode).toBe(201);
      const productId = res.json().data.productId as string;

      const { images, keyById } = await withTenant({ tenantId: t.tenantId }, async (tx) => {
        const images = await tx.variantImage.findMany({
          where: { productId },
          select: { variantId: true, mediaAssetId: true, isPrimary: true },
        });
        const assets = await tx.mediaAsset.findMany({
          where: { id: { in: images.map((i) => i.mediaAssetId) } },
          select: { id: true, key: true },
        });
        return { images, keyById: new Map(assets.map((a) => [a.id, a.key])) };
      });

      // 1 product-level hero + 4 variants × 2 mockups = 9 rows.
      expect(images).toHaveLength(9);

      // Exactly one product-level image, and it's the hero.
      const productLevel = images.filter((i) => i.variantId === null);
      expect(productLevel).toHaveLength(1);
      expect(productLevel[0]!.isPrimary).toBe(true);
      expect(keyById.get(productLevel[0]!.mediaAssetId)).toBe('https://example.test/sticker.png');

      // Every variant got its two mockups, pinned to its SKU; none is the hero.
      const perVariant = images.filter((i) => i.variantId !== null);
      expect(perVariant).toHaveLength(8);
      expect(perVariant.every((i) => !i.isPrimary)).toBe(true);

      // The shared mockup is ONE MediaAsset reused across all four variants.
      const sharedRows = perVariant.filter(
        (i) => keyById.get(i.mediaAssetId) === 'https://example.test/shared.png'
      );
      expect(sharedRows).toHaveLength(4);
      expect(new Set(sharedRows.map((i) => i.mediaAssetId)).size).toBe(1);

      // Distinct assets total: sticker + shared + one per size = 6 (deduped).
      expect(new Set(images.map((i) => i.mediaAssetId)).size).toBe(6);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  // A supplier (Printify) flips an individual colour/size combo out of stock via
  // `is_available: false` while leaving it enabled. The import must keep the
  // variant (faithful to the supplier) but mark it `deny` so the storefront greys
  // just that combo out — `continue` for the rest. Absent flag → available.
  const colourVariant = (
    sku: string,
    colour: string,
    available?: boolean
  ): Record<string, unknown> => ({
    supplierSku: sku,
    title: colour,
    options: { Colour: colour },
    costPriceCents: 1000,
    msrpCents: 2400,
    inventoryQuantity: null,
    weight: 180,
    ...(available === undefined ? {} : { available }),
  });

  it('imports an unavailable combo as deny while the rest stay orderable', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableDropship(t.tenantId);
      const token = signToken(app, t);
      const supplierId = await seedSupplier(t);
      const dpId = await seedDropshipProduct(t, supplierId, 'PP-AVAIL', [
        colourVariant('AV:red', 'Red', true),
        colourVariant('AV:blue', 'Blue', false), // supplier currently can't make it
        colourVariant('AV:green', 'Green'), // flag absent → available
      ]);

      const res = await app.inject({
        method: 'POST',
        url: `/v1/dropship/suppliers/${supplierId}/catalog/${dpId}/import`,
        headers: authHeader(token),
        payload: {},
      });
      expect(res.statusCode).toBe(201);
      const productId = res.json().data.productId as string;

      const { inStock, policyBySku } = await withTenant({ tenantId: t.tenantId }, async (tx) => {
        const product = await tx.product.findUniqueOrThrow({
          where: { id: productId },
          select: { inStock: true },
        });
        const variants = await tx.productVariant.findMany({
          where: { productId, deletedAt: null },
          select: { sku: true, inventoryPolicy: true },
        });
        return {
          inStock: product.inStock,
          policyBySku: new Map(variants.map((v) => [v.sku, v.inventoryPolicy])),
        };
      });

      expect(policyBySku.get('AV:blue')).toBe('deny');
      expect(policyBySku.get('AV:red')).toBe('continue');
      expect(policyBySku.get('AV:green')).toBe('continue');
      // Other colours are orderable, so the product itself stays in stock.
      expect(inStock).toBe(true);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('marks the product out of stock when every combo is unavailable', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableDropship(t.tenantId);
      const token = signToken(app, t);
      const supplierId = await seedSupplier(t);
      const dpId = await seedDropshipProduct(t, supplierId, 'PP-AVAIL-NONE', [
        colourVariant('AN:red', 'Red', false),
        colourVariant('AN:blue', 'Blue', false),
      ]);

      const res = await app.inject({
        method: 'POST',
        url: `/v1/dropship/suppliers/${supplierId}/catalog/${dpId}/import`,
        headers: authHeader(token),
        payload: {},
      });
      expect(res.statusCode).toBe(201);
      const productId = res.json().data.productId as string;

      const inStock = await withTenant({ tenantId: t.tenantId }, async (tx) => {
        const p = await tx.product.findUniqueOrThrow({
          where: { id: productId },
          select: { inStock: true },
        });
        return p.inStock;
      });
      expect(inStock).toBe(false);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('re-sync re-applies changed availability both ways (deny ⇄ continue)', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableDropship(t.tenantId);
      const token = signToken(app, t);
      const supplierId = await seedSupplier(t);
      const allAvailable = [
        colourVariant('RS:red', 'Red', true),
        colourVariant('RS:blue', 'Blue', true),
      ];
      const dpId = await seedDropshipProduct(t, supplierId, 'PP-RESYNC-AVAIL', allAvailable);

      const imp = await app.inject({
        method: 'POST',
        url: `/v1/dropship/suppliers/${supplierId}/catalog/${dpId}/import`,
        headers: authHeader(token),
        payload: {},
      });
      expect(imp.statusCode).toBe(201);
      const productId = imp.json().data.productId as string;

      const policiesNow = (): Promise<Map<string, string>> =>
        withTenant({ tenantId: t.tenantId }, async (tx) => {
          const vs = await tx.productVariant.findMany({
            where: { productId, deletedAt: null },
            select: { sku: true, inventoryPolicy: true },
          });
          return new Map(vs.map((v) => [v.sku, v.inventoryPolicy]));
        });

      // Supplier later reports Red out of stock → re-sync flips it to deny.
      await withTenant({ tenantId: t.tenantId }, (tx) =>
        tx.dropshipProduct.update({
          where: { id: dpId },
          data: { variants: [colourVariant('RS:red', 'Red', false), allAvailable[1]!] as object[] },
        })
      );
      const down = await app.inject({
        method: 'POST',
        url: `/v1/dropship/suppliers/${supplierId}/catalog/${dpId}/reimport`,
        headers: authHeader(token),
        payload: {},
      });
      expect(down.statusCode).toBe(200);
      expect(down.json().data.unavailableVariants).toBe(1);
      const afterDown = await policiesNow();
      expect(afterDown.get('RS:red')).toBe('deny');
      expect(afterDown.get('RS:blue')).toBe('continue');

      // Red comes back in stock → re-sync restores it to continue (not stuck deny).
      await withTenant({ tenantId: t.tenantId }, (tx) =>
        tx.dropshipProduct.update({
          where: { id: dpId },
          data: { variants: allAvailable },
        })
      );
      const up = await app.inject({
        method: 'POST',
        url: `/v1/dropship/suppliers/${supplierId}/catalog/${dpId}/reimport`,
        headers: authHeader(token),
        payload: {},
      });
      expect(up.statusCode).toBe(200);
      expect(up.json().data.unavailableVariants).toBe(0);
      const afterUp = await policiesNow();
      expect(afterUp.get('RS:red')).toBe('continue');
      expect(afterUp.get('RS:blue')).toBe('continue');
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });
});
