// A shop with no product group can add its first delivery option.
//
// MEASURED 2026-10-06 on Gillett Diesel: the Shipping screen said "Every product
// ships the same way until you add a group", and the region's "Add a delivery
// option" answered "Add a product group first". Every option had to name a
// group, so a shop that took the screen at its word could not ship anything
// (sparx persona issue 128).

import { describe, expect, it } from 'vitest';
import { invalidateModuleCache } from '@wizeworks/auth';
import { prisma, withTenant } from '@wizeworks/db';
import { createApp } from '../../src/app.js';
import { authHeader, createTestTenant, dropTestTenant, signToken } from '../helpers.js';

describe('POST /v1/commerce/shipping/rates with no product group', () => {
  it('files the option under "All products", made once', async () => {
    const t = await createTestTenant('owner');
    const app = await createApp();
    try {
      await prisma.tenant.update({
        where: { id: t.tenantId },
        data: { settings: { modules: { commerce: { enabled: true } } } },
      });
      invalidateModuleCache();
      const headers = authHeader(
        signToken(app, { tenantId: t.tenantId, userId: t.userId }, 'owner')
      );

      const zone = await app.inject({
        method: 'POST',
        url: '/v1/commerce/shipping/zones',
        headers,
        payload: {
          name: 'United States',
          targeting: { countries: ['US'], regions: [], postalCodeRanges: [] },
          priority: 0,
        },
      });
      expect(zone.statusCode, zone.body).toBe(201);
      const zoneId = zone.json<{ data: { id: string } }>().data.id;

      const rate = (name: string) =>
        app.inject({
          method: 'POST',
          url: '/v1/commerce/shipping/rates',
          headers,
          payload: { zoneId, name, type: 'flat', amountCents: 1500, currency: 'USD' },
        });
      const first = await rate('Ground');
      expect(first.statusCode, first.body).toBe(201);
      const second = await rate('Two-day');
      expect(second.statusCode, second.body).toBe(201);

      const groups = await withTenant({ tenantId: t.tenantId }, (tx) =>
        tx.shippingProfile.findMany({ select: { id: true, name: true } })
      );
      expect(groups.map((g) => g.name)).toEqual(['All products']);
      const rates = await withTenant({ tenantId: t.tenantId }, (tx) =>
        tx.shippingRate.findMany({ select: { profileId: true } })
      );
      expect(rates.map((r) => r.profileId)).toEqual([groups[0]?.id, groups[0]?.id]);
    } finally {
      await app.close();
      await dropTestTenant(t.tenantId);
    }
  });
});
