// Builder record-display pins (docs/98 Pillar 7). The public own-record fetch a node
// PINNED to a collection / category resolves at render — its OWN fields (name,
// description, hero), distinct from listing its products. Pinned by id with order
// preserved (mirrors products/full), RLS-scoped; bogus / foreign ids drop out.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { invalidateModuleCache } from '@sparx/auth';
import { prisma, withTenant } from '@sparx/db';
import { createApp } from '../../src/app.js';
import { createTestTenant, dropTestTenant } from '../helpers.js';

async function enableCommerce(tenantId: string): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: { modules: { commerce: { enabled: true } } } },
  });
  invalidateModuleCache();
}

async function tenantSlug(tenantId: string): Promise<string> {
  const row = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { slug: true },
  });
  return row.slug;
}

describe('builder record pins — collections/full + categories/full', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns own-records by id (order preserved) and drops bogus ids', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const slug = await tenantSlug(t.tenantId);
      const stamp = Date.now();

      const { c1, c2, k1 } = await withTenant({ tenantId: t.tenantId }, async (tx) => {
        const a = await tx.productCollection.create({
          data: {
            tenantId: t.tenantId,
            name: 'Summer',
            handle: `summer-${stamp}`,
            description: 'Warm-weather picks',
          },
          select: { id: true },
        });
        const b = await tx.productCollection.create({
          data: { tenantId: t.tenantId, name: 'Winter', handle: `winter-${stamp}` },
          select: { id: true },
        });
        const cat = await tx.productCategory.create({
          data: {
            tenantId: t.tenantId,
            name: 'Outerwear',
            handle: `outerwear-${stamp}`,
            path: 'outerwear',
            description: 'Coats & jackets',
          },
          select: { id: true },
        });
        return { c1: a.id, c2: b.id, k1: cat.id };
      });

      // Collections: requested order [c2, c1] preserved; a bogus uuid drops out.
      const bogus = '00000000-0000-0000-0000-000000000000';
      const colRes = await app.inject({
        method: 'GET',
        url: `/v1/public/commerce/collections/full?tenant=${slug}&ids=${c2},${bogus},${c1}`,
      });
      expect(colRes.statusCode).toBe(200);
      const cols = colRes.json().data as { id: string; name: string; description: string | null }[];
      expect(cols.map((c) => c.id)).toEqual([c2, c1]);
      expect(cols[1]).toMatchObject({ name: 'Summer', description: 'Warm-weather picks' });

      // Categories: own-record fields by id.
      const catRes = await app.inject({
        method: 'GET',
        url: `/v1/public/commerce/categories/full?tenant=${slug}&ids=${k1}`,
      });
      expect(catRes.statusCode).toBe(200);
      const cats = catRes.json().data as { id: string; name: string }[];
      expect(cats).toHaveLength(1);
      expect(cats[0]).toMatchObject({ id: k1, name: 'Outerwear' });

      // No ids → empty array (no fetch).
      const emptyRes = await app.inject({
        method: 'GET',
        url: `/v1/public/commerce/collections/full?tenant=${slug}`,
      });
      expect(emptyRes.json().data).toEqual([]);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });
});
