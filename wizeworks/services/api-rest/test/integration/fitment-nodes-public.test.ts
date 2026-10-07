// A shopper can drill a shop's fitment: make, then model.
//
// MEASURED 2026-10-06 on Gillett Diesel: the shop filter showed "Fits your vehicle"
// with a Year box and nothing else. Gillett had 5 makes, 18 models and 51 engines
// stored, but GET /v1/public/commerce/fitment/domains/:id/nodes read them with the
// bare client, and `commerce_fitment_nodes` forces row-level security: with no
// tenant set it matched nothing and answered 200 with an empty list. Every shop's
// truck finder was empty (sparx persona issue 125).

import { describe, expect, it } from 'vitest';
import { prisma, withTenant } from '@wizeworks/db';
import { createApp } from '../../src/app.js';
import { createTestTenant, dropTestTenant } from '../helpers.js';

describe('GET /v1/public/commerce/fitment/domains/:domainId/nodes', () => {
  it('lists the makes, then the models under one', async () => {
    const t = await createTestTenant('owner');
    const app = await createApp();
    try {
      const { slug } = await prisma.tenant.findUniqueOrThrow({
        where: { id: t.tenantId },
        select: { slug: true },
      });
      const { domainId, ramId } = await withTenant({ tenantId: t.tenantId }, async (tx) => {
        const domain = await tx.fitmentDomain.create({
          data: { tenantId: t.tenantId, slug: 'vehicle', displayName: 'Vehicle' },
          select: { id: true },
        });
        const ram = await tx.fitmentNode.create({
          data: {
            tenantId: t.tenantId,
            domainId: domain.id,
            dimensionKey: 'make',
            name: 'RAM',
            slug: 'ram',
            depth: 0,
            position: 1,
          },
          select: { id: true },
        });
        await tx.fitmentNode.create({
          data: {
            tenantId: t.tenantId,
            domainId: domain.id,
            dimensionKey: 'make',
            name: 'Ford',
            slug: 'ford',
            depth: 0,
            position: 0,
          },
        });
        await tx.fitmentNode.create({
          data: {
            tenantId: t.tenantId,
            domainId: domain.id,
            parentId: ram.id,
            dimensionKey: 'model',
            name: '2500',
            slug: '2500',
            depth: 1,
            path: [ram.id],
            pathNames: ['RAM'],
          },
        });
        return { domainId: domain.id, ramId: ram.id };
      });

      const makes = await app.inject({
        method: 'GET',
        url: `/v1/public/commerce/fitment/domains/${domainId}/nodes?tenant=${slug}`,
      });
      expect(makes.statusCode, makes.body).toBe(200);
      const makeRows = makes.json<{ data: { name: string; childCount: number }[] }>().data;
      expect(makeRows.map((row) => row.name)).toEqual(['Ford', 'RAM']);
      expect(makeRows.find((row) => row.name === 'RAM')?.childCount).toBe(1);

      const models = await app.inject({
        method: 'GET',
        url: `/v1/public/commerce/fitment/domains/${domainId}/nodes?tenant=${slug}&parentId=${ramId}`,
      });
      expect(models.json<{ data: { name: string }[] }>().data.map((row) => row.name)).toEqual([
        '2500',
      ]);
    } finally {
      await app.close();
      await dropTestTenant(t.tenantId);
    }
  });
});
