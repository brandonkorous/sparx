// Commerce bundles + configurator-template list sorting.
//
// The workbench "Bundles" and "Builds" tables sort SERVER-SIDE — a client-side
// sort of one loaded page would sort that page and present it as the whole
// answer. This covers both list endpoints against real Postgres + RLS through
// the real HTTP routes:
//   • GET /v1/commerce/bundles — a bundle has no name of its own, so `sort_by=name`
//     orders on the wrapper product's title;
//   • GET /v1/commerce/configurator-templates — `sort_by=name` orders on the
//     template name;
//   • BOTH whitelists REJECT an off-list column rather than interpolating it.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { invalidateModuleCache } from '@wizeworks/auth';
import { prisma, withTenant } from '@wizeworks/db';
import { createApp } from '../../src/app.js';
import {
  authHeader,
  signToken,
  createTestTenant,
  dropTestTenant,
  type TestTenant,
} from '../helpers.js';

async function enableCommerce(tenantId: string): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: { modules: { commerce: { enabled: true } } } },
  });
  invalidateModuleCache();
}

async function seedProduct(t: TestTenant, title: string, handle: string): Promise<string> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const p = await tx.product.create({
      data: { tenantId: t.tenantId, title, handle, status: 'active' },
      select: { id: true },
    });
    return p.id;
  });
}

// A bundle is SOLD AS a wrapper product; its display name is that product's
// title, which is what `sort_by=name` orders on.
async function seedBundle(
  t: TestTenant,
  bundleProductId: string,
  pricingMode: string
): Promise<string> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const b = await tx.bundle.create({
      data: {
        tenantId: t.tenantId,
        bundleProductId,
        pricingMode,
        inventoryMode: 'decrement_components',
      },
      select: { id: true },
    });
    return b.id;
  });
}

async function seedTemplate(t: TestTenant, productId: string, name: string): Promise<string> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const tpl = await tx.configurationTemplate.create({
      data: {
        tenantId: t.tenantId,
        productId,
        name,
        description: null,
        layout: {},
        status: 'draft',
      },
      select: { id: true },
    });
    return tpl.id;
  });
}

describe('commerce bundle + configurator-template list sorting', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('sorts bundles on the whitelist (by wrapper name) and rejects an off-list column', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const token = signToken(app, t);
      const zephyr = await seedProduct(t, 'Zephyr Kit', 'zephyr-kit');
      const apex = await seedProduct(t, 'Apex Kit', 'apex-kit');
      await seedBundle(t, zephyr, 'sum_of_components');
      await seedBundle(t, apex, 'fixed');

      const byName = await app.inject({
        method: 'GET',
        url: '/v1/commerce/bundles?sort_by=name&order=asc',
        headers: authHeader(token),
      });
      expect(byName.statusCode).toBe(200);
      expect(
        (byName.json().data as { bundleProductTitle: string }[]).map((r) => r.bundleProductTitle)
      ).toEqual(['Apex Kit', 'Zephyr Kit']);

      const byNameDesc = await app.inject({
        method: 'GET',
        url: '/v1/commerce/bundles?sort_by=name&order=desc',
        headers: authHeader(token),
      });
      expect(
        (byNameDesc.json().data as { bundleProductTitle: string }[]).map(
          (r) => r.bundleProductTitle
        )
      ).toEqual(['Zephyr Kit', 'Apex Kit']);

      // An off-whitelist column is rejected, never interpolated into the orderBy.
      const bad = await app.inject({
        method: 'GET',
        url: '/v1/commerce/bundles?sort_by=bundleProductId;DROP',
        headers: authHeader(token),
      });
      expect(bad.statusCode).toBe(422);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('sorts configurator templates on the whitelist and rejects an off-list column', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const token = signToken(app, t);
      const p1 = await seedProduct(t, 'Configurable One', 'configurable-one');
      const p2 = await seedProduct(t, 'Configurable Two', 'configurable-two');
      await seedTemplate(t, p1, 'Zeta Build');
      await seedTemplate(t, p2, 'Alpha Build');

      const byName = await app.inject({
        method: 'GET',
        url: '/v1/commerce/configurator-templates?sort_by=name&order=asc',
        headers: authHeader(token),
      });
      expect(byName.statusCode).toBe(200);
      expect((byName.json().data as { name: string }[]).map((r) => r.name)).toEqual([
        'Alpha Build',
        'Zeta Build',
      ]);

      // Off-list sort column rejected.
      const bad = await app.inject({
        method: 'GET',
        url: '/v1/commerce/configurator-templates?sort_by=tenantId',
        headers: authHeader(token),
      });
      expect(bad.statusCode).toBe(422);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });
});
