// Contract tests for the B2B inventory routes (docs/100 P6d) over HTTP — the
// deploy gate "a B2B account sees account-scoped availability" plus the hold
// lifecycle wiring and the b2b module gate. Seeds an account + stock through the
// real services, then drives the routes with a staff JWT.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { prisma, withTenant } from '@sparx/db';
import { invalidateModuleCache } from '@sparx/auth';
import { inventoryService } from '@sparx/inventory';
import { createApp } from '../../src/app.js';
import { authHeader, signToken } from '../helpers.js';

interface B2bInvTenant {
  tenantId: string;
  userId: string;
  email: string;
  accountId: string;
  variantId: string;
}

async function seedTenant(b2bEnabled: boolean): Promise<B2bInvTenant> {
  const slug = `b2binv-${crypto.randomBytes(4).toString('hex')}`;
  const email = `${slug}@sparx.test`;
  const modules: Record<string, { enabled: boolean }> = { inventory: { enabled: true } };
  if (b2bEnabled) modules.b2b = { enabled: true };
  const tenant = await prisma.tenant.create({
    data: { slug, name: `B2B Inv ${slug}`, email, status: 'active', settings: { modules } },
  });
  const ctx = { tenantId: tenant.id };
  const { userId, accountId, variantId, warehouseId } = await withTenant(ctx, async (tx) => {
    const u = await tx.user.create({
      data: { tenantId: tenant.id, email, name: 'Rep', role: 'owner' },
    });
    const account = await tx.b2BAccount.create({
      data: { tenantId: tenant.id, companyName: 'Fleet Co' },
    });
    const w = await tx.warehouse.create({
      data: {
        tenantId: tenant.id,
        name: 'Main',
        code: `WH-${crypto.randomBytes(3).toString('hex')}`,
      },
    });
    const p = await tx.product.create({
      data: { tenantId: tenant.id, title: 'Injector', handle: `inj-${slug}`, status: 'active' },
    });
    const v = await tx.productVariant.create({
      data: {
        tenantId: tenant.id,
        productId: p.id,
        sku: 'B2B-1',
        priceCents: 1000,
        currency: 'USD',
      },
    });
    return { userId: u.id, accountId: account.id, variantId: v.id, warehouseId: w.id };
  });
  await inventoryService.adjust(
    { tenantId: tenant.id, userId },
    { variantId, warehouseId, delta: 30, reason: 'receive' }
  );
  return { tenantId: tenant.id, userId, email, accountId, variantId };
}

describe('b2b inventory routes', () => {
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

  it('returns account-scoped availability + reflects a placed hold', async () => {
    const t = await seedTenant(true);
    try {
      const token = signToken(app, t);
      const avail = await app.inject({
        method: 'POST',
        url: `/v1/b2b/accounts/${t.accountId}/availability`,
        headers: authHeader(token),
        payload: { variantIds: [t.variantId] },
      });
      expect(avail.statusCode).toBe(200);
      expect(avail.json().data[0]).toMatchObject({ available: 30, heldForAccount: 0 });

      const hold = await app.inject({
        method: 'POST',
        url: `/v1/b2b/accounts/${t.accountId}/holds`,
        headers: authHeader(token),
        payload: { variantId: t.variantId, quantity: 6, workOrderRef: 'WO-77' },
      });
      expect(hold.statusCode).toBe(201);
      expect(hold.json().data).toMatchObject({ status: 'active', quantity: 6 });

      const after = await app.inject({
        method: 'POST',
        url: `/v1/b2b/accounts/${t.accountId}/availability`,
        headers: authHeader(token),
        payload: { variantIds: [t.variantId] },
      });
      expect(after.json().data[0]).toMatchObject({ available: 24, heldForAccount: 6 });
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });

  it('returns MODULE_DISABLED when b2b is off', async () => {
    const t = await seedTenant(false);
    try {
      const token = signToken(app, t);
      const res = await app.inject({
        method: 'POST',
        url: `/v1/b2b/accounts/${t.accountId}/availability`,
        headers: authHeader(token),
        payload: { variantIds: [t.variantId] },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('MODULE_DISABLED');
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });
});
