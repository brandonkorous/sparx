// Public tenant payload — proves the storefront's customer-facing NAME source is
// `Property.name`, never the tenant's legal/org name (docs/49 §3·B). The storefront
// (apps/site/lib/tenant.ts) collapses `propertyName` into the single name every
// surface (title/header/footer/OG/JSON-LD) renders, so this is the chokepoint that
// keeps the tenant's legal name off every page.
//
//   GET /v1/public/tenants/:slug              → primary site's name
//   GET /v1/public/tenants/:slug?property=<s>  → that site's name
//
// Unauthenticated route; resolution is by tenant slug then RLS-scoped property reads.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@sparx/db';
import { createApp } from '../../src/app.js';
import { createTestTenant, dropTestTenant, type TestTenant } from '../helpers.js';

interface TenantPayload {
  success: boolean;
  data: { name: string; propertyName: string | null; slug: string };
}

describe('GET /v1/public/tenants/:slug — customer-facing name is Property.name', () => {
  let app: FastifyInstance;
  let fixture: TestTenant;
  let slug: string;

  beforeAll(async () => {
    app = await createApp();
    fixture = await createTestTenant('owner');
    const t = await prisma.tenant.findUniqueOrThrow({
      where: { id: fixture.tenantId },
      select: { slug: true },
    });
    slug = t.slug;
    // Primary 'Acme Store' + a secondary 'Acme Wholesale' (slug 'wholesale'). The
    // tenant's legal name (createTestTenant: "Test <slug>") is intentionally distinct
    // from every site name so a leak would be unmistakable.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${fixture.tenantId}'`);
      await tx.property.create({
        data: { tenantId: fixture.tenantId, slug: 'primary', name: 'Acme Store', isPrimary: true },
      });
      await tx.property.create({
        data: {
          tenantId: fixture.tenantId,
          slug: 'wholesale',
          name: 'Acme Wholesale',
          isPrimary: false,
        },
      });
    });
  });

  afterAll(async () => {
    await dropTestTenant(fixture.tenantId);
    await app.close();
  });

  it('returns the PRIMARY site name with no ?property=', async () => {
    const res = await app.inject({ method: 'GET', url: `/v1/public/tenants/${slug}` });
    expect(res.statusCode).toBe(200);
    const body: TenantPayload = res.json();
    expect(body.data.propertyName).toBe('Acme Store');
    // The legal/org name is still carried for rollout back-compat but is distinct —
    // a storefront reading `propertyName` never shows it.
    expect(body.data.name).toContain('Test test-');
    expect(body.data.propertyName).not.toBe(body.data.name);
  });

  it('returns the ACTIVE site name for ?property=<slug>', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/public/tenants/${slug}?property=wholesale`,
    });
    expect(res.statusCode).toBe(200);
    const body: TenantPayload = res.json();
    expect(body.data.propertyName).toBe('Acme Wholesale');
  });
});
