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

// Printify-shaped normalized variants: each carries its options inline.
const SIZE_VARIANTS = [
  {
    supplierSku: 'PP1:101',
    title: '2x2',
    options: { Size: '2x2' },
    costPriceCents: 142,
    msrpCents: 236,
    inventoryQuantity: null,
    weight: 5,
  },
  {
    supplierSku: 'PP1:102',
    title: '3x3',
    options: { Size: '3x3' },
    costPriceCents: 158,
    msrpCents: 263,
    inventoryQuantity: null,
    weight: 7,
  },
  {
    supplierSku: 'PP1:103',
    title: '4x4',
    options: { Size: '4x4' },
    costPriceCents: 200,
    msrpCents: 333,
    inventoryQuantity: null,
    weight: 9,
  },
  {
    supplierSku: 'PP1:104',
    title: '6x6',
    options: { Size: '6x6' },
    costPriceCents: 232,
    msrpCents: 386,
    inventoryQuantity: null,
    weight: 12,
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
});
