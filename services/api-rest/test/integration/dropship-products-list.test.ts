// Dropship products list + list sorting/filtering.
//
// Covers the reads the workbench "Supplier products" and "Suppliers" tables
// depend on, against real Postgres + RLS through the real HTTP routes:
//   • GET /v1/dropship/products — the cross-supplier aggregate: merges every
//     supplier's dropship_products, carries the owning supplier id/name, filters
//     by supplier / imported-vs-available / title, sorts on a server whitelist,
//     and pages with a real total;
//   • GET /v1/dropship/suppliers — the new `q` name search + the sort whitelist;
//   • the sort whitelist REJECTS an off-list column rather than interpolating it.

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

async function enableDropship(tenantId: string): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: { modules: { dropship: { enabled: true } } } },
  });
  invalidateModuleCache();
}

async function seedSupplier(t: TestTenant, name: string): Promise<string> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const s = await tx.dropshipSupplier.create({
      data: { tenantId: t.tenantId, name, type: 'printful', status: 'active' },
      select: { id: true },
    });
    return s.id;
  });
}

async function seedProduct(
  t: TestTenant,
  supplierId: string,
  opts: { supplierProductId: string; title: string; costPriceCents: number }
): Promise<string> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const dp = await tx.dropshipProduct.create({
      data: {
        tenantId: t.tenantId,
        supplierId,
        supplierProductId: opts.supplierProductId,
        title: opts.title,
        images: [],
        variants: [],
        costPriceCents: opts.costPriceCents,
      },
      select: { id: true },
    });
    return dp.id;
  });
}

// Turn a dropship product into an IMPORTED one by creating the commerce product
// it links to plus the link row — the state the "imported" filter selects on.
async function importProduct(
  t: TestTenant,
  dropshipProductId: string,
  handle: string,
  productStatus = 'draft'
): Promise<string> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const product = await tx.product.create({
      data: { tenantId: t.tenantId, title: handle, handle, status: productStatus, inStock: true },
      select: { id: true },
    });
    await tx.dropshipProductLink.create({
      data: {
        tenantId: t.tenantId,
        productId: product.id,
        dropshipProductId,
        supplierSku: 'SKU',
        status: 'active',
      },
    });
    return product.id;
  });
}

describe('dropship products list + list sorting', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('aggregates products across suppliers with supplier id + name', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableDropship(t.tenantId);
      const token = signToken(app, t);
      const sA = await seedSupplier(t, 'Alpha Supply');
      const sB = await seedSupplier(t, 'Beta Wholesale');
      await seedProduct(t, sA, { supplierProductId: 'A1', title: 'Anvil', costPriceCents: 500 });
      await seedProduct(t, sB, { supplierProductId: 'B1', title: 'Bucket', costPriceCents: 300 });

      const res = await app.inject({
        method: 'GET',
        url: '/v1/dropship/products',
        headers: authHeader(token),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveLength(2);
      expect(body.meta.total).toBe(2);
      // Each row carries its owning supplier.
      const byTitle = new Map(
        (body.data as { title: string; supplierId: string; supplierName: string }[]).map((r) => [
          r.title,
          r,
        ])
      );
      expect(byTitle.get('Anvil')!.supplierId).toBe(sA);
      expect(byTitle.get('Anvil')!.supplierName).toBe('Alpha Supply');
      expect(byTitle.get('Bucket')!.supplierName).toBe('Beta Wholesale');
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('scopes to one supplier and filters imported vs available', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableDropship(t.tenantId);
      const token = signToken(app, t);
      const sA = await seedSupplier(t, 'Alpha Supply');
      const sB = await seedSupplier(t, 'Beta Wholesale');
      const importedDp = await seedProduct(t, sA, {
        supplierProductId: 'A1',
        title: 'Anvil',
        costPriceCents: 500,
      });
      await seedProduct(t, sA, { supplierProductId: 'A2', title: 'Awl', costPriceCents: 200 });
      await seedProduct(t, sB, { supplierProductId: 'B1', title: 'Bucket', costPriceCents: 300 });
      await importProduct(t, importedDp, 'anvil');

      // Scoped to supplier A → 2 of the 3 products.
      const scoped = await app.inject({
        method: 'GET',
        url: `/v1/dropship/products?supplierId=${sA}`,
        headers: authHeader(token),
      });
      expect(scoped.statusCode).toBe(200);
      expect(scoped.json().meta.total).toBe(2);

      // imported → only the linked one.
      const imported = await app.inject({
        method: 'GET',
        url: '/v1/dropship/products?status=imported',
        headers: authHeader(token),
      });
      expect(imported.json().data).toHaveLength(1);
      expect(imported.json().data[0].title).toBe('Anvil');
      expect(imported.json().data[0].isImported).toBe(true);

      // available → the two unlinked ones.
      const available = await app.inject({
        method: 'GET',
        url: '/v1/dropship/products?status=available',
        headers: authHeader(token),
      });
      expect(available.json().meta.total).toBe(2);
      expect((available.json().data as { isImported: boolean }[]).every((r) => !r.isImported)).toBe(
        true
      );
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('sorts products on the whitelist and rejects an off-list column', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableDropship(t.tenantId);
      const token = signToken(app, t);
      const s = await seedSupplier(t, 'Alpha Supply');
      await seedProduct(t, s, { supplierProductId: 'P1', title: 'Zebra', costPriceCents: 900 });
      await seedProduct(t, s, { supplierProductId: 'P2', title: 'Apple', costPriceCents: 100 });

      const byTitle = await app.inject({
        method: 'GET',
        url: '/v1/dropship/products?sort_by=title&order=asc',
        headers: authHeader(token),
      });
      expect(byTitle.statusCode).toBe(200);
      expect((byTitle.json().data as { title: string }[]).map((r) => r.title)).toEqual([
        'Apple',
        'Zebra',
      ]);

      const byCost = await app.inject({
        method: 'GET',
        url: '/v1/dropship/products?sort_by=costPriceCents&order=desc',
        headers: authHeader(token),
      });
      expect(
        (byCost.json().data as { costPriceCents: number }[]).map((r) => r.costPriceCents)
      ).toEqual([900, 100]);

      // An off-whitelist column is rejected, never interpolated into the orderBy.
      const bad = await app.inject({
        method: 'GET',
        url: '/v1/dropship/products?sort_by=costPriceCents;DROP',
        headers: authHeader(token),
      });
      expect(bad.statusCode).toBe(422);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('searches and sorts suppliers, and rejects an off-list sort column', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableDropship(t.tenantId);
      const token = signToken(app, t);
      await seedSupplier(t, 'Alpha Supply');
      await seedSupplier(t, 'Beta Wholesale');
      await seedSupplier(t, 'Alpine Goods');

      // Name search (case-insensitive contains).
      const search = await app.inject({
        method: 'GET',
        url: '/v1/dropship/suppliers?q=alp',
        headers: authHeader(token),
      });
      expect(search.statusCode).toBe(200);
      expect((search.json().data as { name: string }[]).map((r) => r.name).sort()).toEqual([
        'Alpha Supply',
        'Alpine Goods',
      ]);

      // Whitelisted sort.
      const sorted = await app.inject({
        method: 'GET',
        url: '/v1/dropship/suppliers?sort_by=name&order=asc',
        headers: authHeader(token),
      });
      expect((sorted.json().data as { name: string }[]).map((r) => r.name)).toEqual([
        'Alpha Supply',
        'Alpine Goods',
        'Beta Wholesale',
      ]);
      // The list read carries a per-supplier product count column.
      expect(sorted.json().data[0]).toHaveProperty('productCount');

      // Off-list sort column rejected.
      const bad = await app.inject({
        method: 'GET',
        url: '/v1/dropship/suppliers?sort_by=credentials',
        headers: authHeader(token),
      });
      expect(bad.statusCode).toBe(422);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });
});
