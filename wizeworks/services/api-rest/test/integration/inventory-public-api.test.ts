// Contract tests for the documented public inventory API (docs/06 §7, docs/100
// P6a) over real HTTP via app.inject. Covers the bits the service-level tests
// can't: the per-API-key SCOPE gate (`read:inventory` / `write:inventory`), the
// JWT-actor scope bypass, the inventory MODULE gate, and the canonical envelope
// shapes for list / patch / bulk.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { prisma, withTenant } from '@wizeworks/db';
import { invalidateModuleCache, issueApiKey } from '@wizeworks/auth';
import { createApp } from '../../src/app.js';
import { authHeader, seedPrimaryProperty, signToken } from '../helpers.js';

interface InvTenant {
  tenantId: string;
  userId: string;
  email: string;
  warehouseId: string;
  variantId: string;
  sku: string;
}

async function createInventoryTenant(inventoryEnabled: boolean): Promise<InvTenant> {
  const slug = `apiinv-${crypto.randomBytes(4).toString('hex')}`;
  const email = `${slug}@sparx.test`;
  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: `Inventory API ${slug}`,
      email,
      plan: 'starter',
      status: 'active',
      settings: inventoryEnabled ? { modules: { inventory: { enabled: true } } } : {},
    },
  });
  const ctx = { tenantId: tenant.id };
  const userId = await withTenant(ctx, async (tx) => {
    const u = await tx.user.create({
      data: { tenantId: tenant.id, email, name: `API ${slug}`, role: 'owner' },
    });
    return u.id;
  });
  const sku = `API-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const { warehouseId, variantId } = await withTenant(ctx, async (tx) => {
    const w = await tx.warehouse.create({
      data: {
        tenantId: tenant.id,
        name: 'Main',
        code: `WH-${crypto.randomBytes(3).toString('hex')}`,
      },
    });
    const p = await tx.product.create({
      data: { tenantId: tenant.id, title: 'Test Pump', handle: `pump-${slug}`, status: 'active' },
    });
    const v = await tx.productVariant.create({
      data: { tenantId: tenant.id, productId: p.id, sku, priceCents: 1000, currency: 'USD' },
    });
    await tx.inventoryLevel.create({
      data: { tenantId: tenant.id, variantId: v.id, warehouseId: w.id, onHand: 12, allocated: 0 },
    });
    return { warehouseId: w.id, variantId: v.id };
  });
  // Real provisioning gives every tenant a PRIMARY site, so a fixture without
  // one builds a tenant that cannot exist — and every site-resolving read 404s.
  await seedPrimaryProperty(tenant.id, `Test ${tenant.slug}`);
  return { tenantId: tenant.id, userId, email, warehouseId, variantId, sku };
}

async function mintKey(tenantId: string, userId: string, scopes: string[]): Promise<string> {
  const key = await issueApiKey({ tenantId, name: 'test', scopes, createdByUserId: userId });
  return key.plaintext;
}

describe('documented inventory API', () => {
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

  it('rejects an API key without read:inventory (FORBIDDEN)', async () => {
    const t = await createInventoryTenant(true);
    try {
      const token = await mintKey(t.tenantId, t.userId, ['read:commerce']);
      const res = await app.inject({
        method: 'GET',
        url: '/v1/inventory',
        headers: authHeader(token),
      });
      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });

  it('lists levels for an API key WITH read:inventory', async () => {
    const t = await createInventoryTenant(true);
    try {
      const token = await mintKey(t.tenantId, t.userId, ['read:inventory']);
      const res = await app.inject({
        method: 'GET',
        url: '/v1/inventory',
        headers: authHeader(token),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.meta.total).toBe(1);
      expect(body.data[0]).toMatchObject({ sku: t.sku, onHand: 12, available: 12 });
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });

  it('updates a count via PATCH with write:inventory', async () => {
    const t = await createInventoryTenant(true);
    try {
      const token = await mintKey(t.tenantId, t.userId, ['write:inventory']);
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/inventory/${t.variantId}`,
        headers: authHeader(token),
        payload: { warehouseId: t.warehouseId, onHand: 30 },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toMatchObject({ onHand: 30, available: 30, appliedDelta: 18 });
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });

  it('bulk-adjusts via POST /adjustments (JSON)', async () => {
    const t = await createInventoryTenant(true);
    try {
      const token = await mintKey(t.tenantId, t.userId, ['write:inventory']);
      const res = await app.inject({
        method: 'POST',
        url: '/v1/inventory/adjustments',
        headers: authHeader(token),
        payload: {
          adjustments: [
            { sku: t.sku, warehouseId: t.warehouseId, delta: 5, reason: 'receive' },
            { sku: 'MISSING', warehouseId: t.warehouseId, delta: 1, reason: 'receive' },
          ],
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toMatchObject({ applied: 1, failed: 1 });
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });

  it('lets a JWT (dashboard) actor through without scopes', async () => {
    const t = await createInventoryTenant(true);
    try {
      const token = signToken(app, { tenantId: t.tenantId, userId: t.userId });
      const res = await app.inject({
        method: 'GET',
        url: '/v1/inventory/alerts',
        headers: authHeader(token),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });

  it('returns MODULE_DISABLED when inventory is off', async () => {
    const t = await createInventoryTenant(false);
    try {
      const token = await mintKey(t.tenantId, t.userId, ['read:inventory']);
      const res = await app.inject({
        method: 'GET',
        url: '/v1/inventory',
        headers: authHeader(token),
      });
      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.error.code).toBe('MODULE_DISABLED');
      expect(body.error.details).toMatchObject({ module: 'inventory' });
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });
});
