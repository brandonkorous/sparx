// A shop that delivers can still let customers collect (sparx persona issue 129).
//
// MEASURED 2026-10-06 on Gillett Diesel: checkout offered "Collect in person"
// only while the shop had no delivery set up. Adding a US region for shipping
// took it away, though the counter was open and the setup story said customers
// "pick up locally". The Shipping screen now carries the choice, per site.

import { describe, expect, it } from 'vitest';
import { invalidateModuleCache } from '@wizeworks/auth';
import { prisma } from '@wizeworks/db';
import { shippingService } from '@wizeworks/commerce';
import { createApp } from '../../src/app.js';
import { authHeader, createTestTenant, dropTestTenant, signToken } from '../helpers.js';

describe('collecting in person beside delivery', () => {
  it('is offered with delivery only once the site turns it on', async () => {
    const t = await createTestTenant('owner');
    const app = await createApp();
    try {
      await prisma.tenant.update({
        where: { id: t.tenantId },
        data: { settings: { modules: { commerce: { enabled: true } } } },
      });
      invalidateModuleCache();
      const headers = {
        ...authHeader(signToken(app, { tenantId: t.tenantId, userId: t.userId }, 'owner')),
        'x-sparx-property-id': t.propertyId,
      };

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
      const zoneId = zone.json<{ data: { id: string } }>().data.id;
      await app.inject({
        method: 'POST',
        url: '/v1/commerce/shipping/rates',
        headers,
        payload: { zoneId, name: 'UPS Ground', type: 'flat', amountCents: 1500, currency: 'USD' },
      });

      const services = async () =>
        (
          await shippingService.rateShipment(
            { tenantId: t.tenantId },
            {
              propertyId: t.propertyId,
              fromAddress: { line1: '14812 Heritagecrest Way', city: 'Bluffdale', country: 'US' },
              toAddress: { line1: '2417 E Red Cliffs Dr', city: 'St. George', country: 'US' },
              packages: [
                {
                  weight: 2000,
                  dimensions: { lengthMm: 300, widthMm: 200, heightMm: 150 },
                  containsHazmat: false,
                  hazmatClass: 'none',
                },
              ],
              currency: 'USD',
              signatureRequired: false,
              saturdayDelivery: false,
            }
          )
        )
          .map((rate) => rate.service)
          .sort();

      const before = await app.inject({
        method: 'GET',
        url: '/v1/commerce/shipping/collection',
        headers,
      });
      expect(before.json<{ data: { offersCollection: boolean } }>().data.offersCollection).toBe(
        false
      );
      expect(await services()).toEqual(['UPS Ground']);

      const on = await app.inject({
        method: 'PUT',
        url: '/v1/commerce/shipping/collection',
        headers,
        payload: { offersCollection: true },
      });
      expect(on.statusCode, on.body).toBe(200);
      expect(await services()).toEqual(['Collect in person', 'UPS Ground']);
    } finally {
      await app.close();
      await dropTestTenant(t.tenantId);
    }
  });
});
