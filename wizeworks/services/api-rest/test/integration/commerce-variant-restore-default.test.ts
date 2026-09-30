// BRINGING BACK THE VERSION SHOWN FIRST SHOWS IT FIRST AGAIN.
//
// Retiring a version clears `isDefault`, which is right: a stopped version cannot
// be the one a shopper sees preselected. But restoring never set it back, so a
// product whose only version was stopped and then brought back came out with NO
// version shown first. Driven on the sparx workbench 2026-09-29: "Parity Mug",
// stop selling, Sell it again, and its "Shown first" badge was gone for good.
//
// The rule: a restore takes the flag only when no live version holds it, so a
// product that already shows another version first keeps that choice.

import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { invalidateModuleCache } from '@wizeworks/auth';
import { prisma, withTenant } from '@wizeworks/db';
import { createApp } from '../../src/app.js';
import {
  authHeader,
  createTestTenant,
  dropTestTenant,
  signToken,
  type TestTenant,
} from '../helpers.js';

async function enableCommerce(tenantId: string): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: { modules: { commerce: { enabled: true } } } },
  });
  invalidateModuleCache();
}

/** A product with the given versions; the first is the one shown first. */
async function seedProduct(t: TestTenant, skus: string[]): Promise<string[]> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const product = await tx.product.create({
      data: {
        tenantId: t.tenantId,
        title: 'Parity Mug',
        handle: `parity-mug-${crypto.randomBytes(3).toString('hex')}`,
        status: 'active',
      },
      select: { id: true },
    });
    const ids: string[] = [];
    for (const [index, sku] of skus.entries()) {
      const row = await tx.productVariant.create({
        data: {
          tenantId: t.tenantId,
          productId: product.id,
          sku: `${sku}-${crypto.randomBytes(3).toString('hex')}`,
          priceCents: 1800,
          currency: 'USD',
          isDefault: index === 0,
          position: index,
        },
        select: { id: true },
      });
      ids.push(row.id);
    }
    return ids;
  });
}

async function shownFirst(t: TestTenant, ids: string[]): Promise<string[]> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const rows = await tx.productVariant.findMany({
      where: { id: { in: ids }, isDefault: true },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  });
}

describe('restoring a version', () => {
  it('shows the only version first again once it is brought back', async () => {
    const t = await createTestTenant('owner');
    const app = await createApp();
    try {
      await enableCommerce(t.tenantId);
      const [mug] = await seedProduct(t, ['MUG']);
      const headers = authHeader(signToken(app, t));

      const stop = await app.inject({
        method: 'POST',
        url: `/v1/commerce/variants/${mug!}/archive`,
        headers,
      });
      expect(stop.statusCode).toBe(200);
      expect(await shownFirst(t, [mug!])).toEqual([]);

      const back = await app.inject({
        method: 'POST',
        url: `/v1/commerce/variants/${mug!}/restore`,
        headers,
      });
      expect(back.statusCode).toBe(200);
      // Before the fix this was [] for good: nothing shown first at all.
      expect(await shownFirst(t, [mug!])).toEqual([mug]);
    } finally {
      await app.close();
      await dropTestTenant(t.tenantId);
    }
  });

  it('leaves another version shown first when one already is', async () => {
    const t = await createTestTenant('owner');
    const app = await createApp();
    try {
      await enableCommerce(t.tenantId);
      const [first, second] = await seedProduct(t, ['TEE-S', 'TEE-M']);
      const headers = authHeader(signToken(app, t));

      await app.inject({
        method: 'POST',
        url: `/v1/commerce/variants/${second!}/archive`,
        headers,
      });
      await app.inject({
        method: 'POST',
        url: `/v1/commerce/variants/${second!}/restore`,
        headers,
      });

      expect(await shownFirst(t, [first!, second!])).toEqual([first]);
    } finally {
      await app.close();
      await dropTestTenant(t.tenantId);
    }
  });
});
