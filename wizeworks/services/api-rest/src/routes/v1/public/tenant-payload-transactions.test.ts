import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type * as Db from '@wizeworks/db';
import type * as Commerce from '@wizeworks/commerce';

// WW-10: one storefront page view called /v1/public/tenants/:slug and each call
// opened three transactions (the payload batch, payment config, languages).

const h = vi.hoisted(() => {
  const row = () => Promise.resolve(null);
  const tx = {
    commerceSiteTheme: { findUnique: row },
    tenantBrand: { findUnique: row },
    property: { findUnique: row },
    tenantBusiness: { findUnique: row },
    tenantPaymentConfig: {
      findUnique: () => Promise.resolve({ gatewayId: 'manual', isActive: true }),
    },
    productTranslation: { findMany: () => Promise.resolve([{ locale: 'fr' }]) },
  };
  return { tx, withTenant: vi.fn((_ctx: unknown, fn: (t: typeof tx) => unknown) => fn(tx)) };
});

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<typeof Db>()),
  withTenant: h.withTenant,
  prisma: {
    tenant: {
      findUnique: () =>
        Promise.resolve({
          id: '11111111-1111-1111-1111-111111111111',
          slug: 'acme',
          name: 'Acme',
          settings: {},
          socials: null,
          subscriptionStatus: 'active',
          trialEndsAt: null,
          currentPeriodEnd: null,
          platformBrand: 'sparx',
        }),
    },
  },
}));
vi.mock('@wizeworks/commerce', async (importOriginal) => {
  const real = await importOriginal<typeof Commerce>();
  return {
    checkoutService: { paymentModeOf: real.checkoutService.paymentModeOf },
    commerceSiteService: { resolveSettingsRow: () => Promise.resolve(null) },
  };
});
vi.mock('../../../lib/property.js', () => ({
  resolvePublicPropertyId: () => Promise.resolve('22222222-2222-2222-2222-222222222222'),
  contentSiteVisibilityWhere: () => ({}),
}));
vi.mock('../../../lib/consent.js', () => ({
  readPublicConsentConfig: () => Promise.resolve(null),
}));
vi.mock('../../../lib/site-origin.js', () => ({
  canonicalSiteHost: () => Promise.resolve('acme.example'),
}));

import publicContentRoutes from './content.js';

describe('GET /v1/public/tenants/:slug', () => {
  it('reads the whole payload in one transaction', async () => {
    const app = Fastify();
    await app.register(publicContentRoutes);
    const res = await app.inject({ method: 'GET', url: '/v1/public/tenants/acme' });
    await app.close();

    expect(res.statusCode).toBe(200);
    expect(h.withTenant).toHaveBeenCalledTimes(1);
    expect(res.json().data).toMatchObject({
      commerce: { paymentMode: 'in_person' },
      languages: ['fr'],
    });
  });
});
