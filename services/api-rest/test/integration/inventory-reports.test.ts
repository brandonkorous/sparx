// Contract tests for the inventory analytics reports (docs/100 P6b) over HTTP:
// the turnover JSON shape and the `?format=csv` export (content-type + header
// row). Seeds a costed receipt + a sale through the ledger so turnover has COGS.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { prisma, withTenant } from '@sparx/db';
import { invalidateModuleCache } from '@sparx/auth';
import { inventoryService } from '@sparx/inventory';
import { createApp } from '../../src/app.js';
import { authHeader, seedPrimaryProperty, signToken } from '../helpers.js';

interface RepTenant {
  tenantId: string;
  userId: string;
  email: string;
}

async function seedTenant(): Promise<RepTenant> {
  const slug = `aprep-${crypto.randomBytes(4).toString('hex')}`;
  const email = `${slug}@sparx.test`;
  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: `Reports ${slug}`,
      email,
      plan: 'starter',
      status: 'active',
      settings: { modules: { inventory: { enabled: true } } },
    },
  });
  const ctx = { tenantId: tenant.id };
  const { userId, warehouseId, variantId } = await withTenant(ctx, async (tx) => {
    const u = await tx.user.create({
      data: { tenantId: tenant.id, email, name: 'Rep', role: 'owner' },
    });
    const w = await tx.warehouse.create({
      data: {
        tenantId: tenant.id,
        name: 'Main',
        code: `WH-${crypto.randomBytes(3).toString('hex')}`,
      },
    });
    const p = await tx.product.create({
      data: { tenantId: tenant.id, title: 'Pump', handle: `pump-${slug}`, status: 'active' },
    });
    const v = await tx.productVariant.create({
      data: {
        tenantId: tenant.id,
        productId: p.id,
        sku: 'REP-1',
        priceCents: 1000,
        currency: 'USD',
      },
    });
    return { userId: u.id, warehouseId: w.id, variantId: v.id };
  });

  const sctx = { tenantId: tenant.id, userId };
  await inventoryService.adjust(sctx, {
    variantId,
    warehouseId,
    delta: 50,
    reason: 'receive',
    unitCostCents: 500,
  });
  await inventoryService.adjust(sctx, { variantId, warehouseId, delta: -5, reason: 'sale' });

  // Real provisioning gives every tenant a PRIMARY site, so a fixture without
  // one builds a tenant that cannot exist — and every site-resolving read 404s.
  await seedPrimaryProperty(tenant.id, `Test ${tenant.slug}`);
  return { tenantId: tenant.id, userId, email };
}

describe('inventory reports', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    invalidateModuleCache();
  });

  it('returns the turnover report as JSON', async () => {
    const t = await seedTenant();
    try {
      const token = signToken(app, t);
      const res = await app.inject({
        method: 'GET',
        url: '/v1/inventory/reports/turnover',
        headers: authHeader(token),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toMatchObject({ unitsSold: 5, cogsCents: 2500, periodDays: 30 });
      expect(body.data.turnover).toBeGreaterThan(0);
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });

  it('exports reorder-analysis as CSV', async () => {
    const t = await seedTenant();
    try {
      const token = signToken(app, t);
      const res = await app.inject({
        method: 'GET',
        url: '/v1/inventory/reports/reorder-analysis?format=csv',
        headers: authHeader(token),
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.body.split('\n')[0]).toBe(
        'sku,title,warehouse,on_hand,available,reorder_point,velocity_per_day,days_of_cover,projected_stockout_at,suggested_quantity,supplier,unit_cost_cents'
      );
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });
});
