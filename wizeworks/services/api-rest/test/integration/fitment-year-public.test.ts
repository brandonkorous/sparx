// Picking a year keeps the parts that fit every year.
//
// MEASURED 2026-10-06 on Gillett Diesel: 126 parts are fitted to engines with no
// year ranges (a 6.7L Cummins part fits the 6.7L Cummins). Choosing "2019" in
// "Fits your vehicle" returned nothing from both the catalog and the index, so a
// shopper with a 2019 truck was told no part fits it. The catalog query required a
// year window on the rule; collection-rules and fitment-service already read "no
// window" as "every year" (sparx persona issue 125).

import { describe, expect, it } from 'vitest';
import { prisma, withTenant } from '@wizeworks/db';
import { createApp } from '../../src/app.js';
import { createTestTenant, dropTestTenant } from '../helpers.js';

describe('GET /v1/public/commerce/products?fitmentYear=', () => {
  it('keeps parts with no years and parts whose years include it', async () => {
    const t = await createTestTenant('owner');
    const app = await createApp();
    try {
      const { slug } = await prisma.tenant.findUniqueOrThrow({
        where: { id: t.tenantId },
        select: { slug: true },
      });
      await withTenant({ tenantId: t.tenantId }, async (tx) => {
        const domain = await tx.fitmentDomain.create({
          data: { tenantId: t.tenantId, slug: 'vehicle', displayName: 'Vehicle' },
          select: { id: true },
        });
        const engine = await tx.fitmentNode.create({
          data: {
            tenantId: t.tenantId,
            domainId: domain.id,
            dimensionKey: 'engine',
            name: '6.7L Cummins',
            slug: '6-7l-cummins',
          },
          select: { id: true },
        });
        const part = async (handle: string, years: [number, number] | null) => {
          const product = await tx.product.create({
            data: { tenantId: t.tenantId, title: handle, handle, status: 'active' },
            select: { id: true },
          });
          await tx.productFitment.create({
            data: {
              tenantId: t.tenantId,
              productId: product.id,
              domainId: domain.id,
              nodeId: engine.id,
              ranges: years
                ? {
                    create: [
                      {
                        tenantId: t.tenantId,
                        dimensionKey: 'year',
                        min: years[0],
                        max: years[1],
                      },
                    ],
                  }
                : undefined,
            },
          });
        };
        await part('fits-every-year', null);
        await part('fits-2007-to-2018', [2007, 2018]);
        await part('fits-2019-to-2021', [2019, 2021]);
      });

      const response = await app.inject({
        method: 'GET',
        url: `/v1/public/commerce/products?tenant=${slug}&fitmentYear=2019`,
      });
      expect(response.statusCode, response.body).toBe(200);
      const handles = response
        .json<{ data: { handle: string }[] }>()
        .data.map((row) => row.handle)
        .sort();
      expect(handles).toEqual(['fits-2019-to-2021', 'fits-every-year']);
    } finally {
      await app.close();
      await dropTestTenant(t.tenantId);
    }
  });
});
