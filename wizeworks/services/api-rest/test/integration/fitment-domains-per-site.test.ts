// Per-site fitment domain index (docs/131) — the storefront narrowing filter must
// only offer domains THIS site's catalog uses. `ProductFitment` and `FitmentDomain`
// take no property_id (a fitment is an attribute of the product; a domain is a
// shared vocabulary), but the READ still has to be site-correct: a donut site under
// the same tenant as a machine shop must not render a "Vehicles" filter.
//
// The Korous test again: one tenant, two sites. A vehicle-fitment product pinned to
// the parts site; the donut site carries none. The parts site sees the Vehicles
// domain; the donut site sees nothing. Asserts the ABSENCE as hard as the presence —
// with the scoping removed, the domain leaks onto both sites and the donut
// assertion fails (disable-verified).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { invalidateModuleCache } from '@wizeworks/auth';
import { prisma, withTenant } from '@wizeworks/db';
import { createApp } from '../../src/app.js';
import { createTestTenant, dropTestTenant, type TestTenant } from '../helpers.js';

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

async function createSite(t: TestTenant, name: string): Promise<{ id: string; slug: string }> {
  return withTenant({ tenantId: t.tenantId }, (tx) => {
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${crypto.randomBytes(3).toString('hex')}`;
    return tx.property.create({
      data: { tenantId: t.tenantId, slug, name, isPrimary: false },
      select: { id: true, slug: true },
    });
  });
}

async function propertySlug(t: TestTenant, propertyId: string): Promise<string> {
  const row = await withTenant({ tenantId: t.tenantId }, (tx) =>
    tx.property.findUniqueOrThrow({ where: { id: propertyId }, select: { slug: true } })
  );
  return row.slug;
}

async function createFitmentDomain(
  t: TestTenant,
  slug: string,
  displayName: string
): Promise<string> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const d = await tx.fitmentDomain.create({
      data: { tenantId: t.tenantId, slug, displayName },
      select: { id: true },
    });
    return d.id;
  });
}

// An active product PINNED to one site (a ProductProperty row → visible ONLY there,
// not everywhere), carrying a fitment in `domainId`. The pin is what makes the test
// meaningful: an unpinned product is visible on every site, so its domain would show
// everywhere and prove nothing.
async function createFitmentProduct(
  t: TestTenant,
  propertyId: string,
  domainId: string,
  handle: string
): Promise<void> {
  await withTenant({ tenantId: t.tenantId }, async (tx) => {
    const product = await tx.product.create({
      data: { tenantId: t.tenantId, title: 'Fitment Widget', handle, status: 'active' },
      select: { id: true },
    });
    await tx.productProperty.create({ data: { propertyId, productId: product.id } });
    await tx.productFitment.create({
      data: { tenantId: t.tenantId, productId: product.id, domainId },
    });
  });
}

async function domainSlugs(
  app: FastifyInstance,
  tenant: string,
  property: string
): Promise<string[]> {
  const res = await app.inject({
    method: 'GET',
    url: `/v1/public/commerce/fitment/domains?tenant=${tenant}&property=${property}`,
  });
  expect(res.statusCode).toBe(200);
  return (res.json().data as { slug: string }[]).map((d) => d.slug);
}

describe('fitment domains — per-site index (docs/131)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('offers a domain only on the site whose catalog uses it', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const tSlug = await tenantSlug(t.tenantId);

      const parts = t.propertyId; // primary — Bob's Parts
      const partsSlug = await propertySlug(t, parts);
      const donuts = await createSite(t, 'Savory Donuts');

      // A "Vehicles" domain used ONLY by a product pinned to the parts site.
      const vehicles = await createFitmentDomain(t, 'vehicles', 'Vehicles');
      await createFitmentProduct(t, parts, vehicles, `brake-pad-${Date.now()}`);

      // Parts offers the Vehicles filter; the donut site does not (no product of
      // its own uses that domain) — the cross-business exposure this closes.
      expect(await domainSlugs(app, tSlug, partsSlug)).toContain('vehicles');
      expect(await domainSlugs(app, tSlug, donuts.slug)).not.toContain('vehicles');
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });
});
