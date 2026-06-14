// Per-test fixtures for @sparx/sitebuilder integration tests. Mirrors
// packages/crm/test/helpers.ts: every test gets a fresh tenant + staff user,
// torn down via a single ON DELETE CASCADE tenant delete.

import crypto from 'node:crypto';

import { prisma } from '@sparx/db';
import { RecordingPublisher, setPublisher } from '../src/events.js';

export interface TestTenant {
  tenantId: string;
  userId: string;
  // The tenant's seeded PRIMARY property (docs/49) — the site the per-property
  // sitebuilder services scope to by default.
  propertyId: string;
  email: string;
  slug: string;
}

export interface TestContext {
  tenant: TestTenant;
  ctx: { tenantId: string; userId: string; propertyId: string };
  publisher: RecordingPublisher;
}

export async function createTestTenant(role = 'owner'): Promise<TestTenant> {
  const slug = `sb-test-${crypto.randomBytes(4).toString('hex')}`;
  const email = `${slug}@sparx.test`;
  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: `Site Builder Test ${slug}`,
      email,
      plan: 'starter',
      status: 'active',
      settings: { modules: { builder: { enabled: true } } },
    },
  });

  // users + properties have FORCE RLS — write via a tenant-scoped raw exec. Every
  // real tenant is born with a primary property (packages/auth sign-up); the
  // harness seeds the same so the per-property services resolve a site.
  const { userId, propertyId } = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenant.id}'`);
    const user = await tx.user.create({
      data: { tenantId: tenant.id, email, name: `Test ${slug}`, role },
    });
    const property = await tx.property.create({
      data: {
        tenantId: tenant.id,
        slug: 'primary',
        name: `Site Builder Test ${slug}`,
        isPrimary: true,
      },
    });
    return { userId: user.id, propertyId: property.id };
  });

  return { tenantId: tenant.id, userId, propertyId, email, slug };
}

export async function dropTestTenant(tenantId: string): Promise<void> {
  await prisma.tenant.delete({ where: { id: tenantId } });
}

export async function makeTestContext(role = 'owner'): Promise<TestContext> {
  const tenant = await createTestTenant(role);
  const publisher = new RecordingPublisher();
  setPublisher(publisher);
  return {
    tenant,
    ctx: { tenantId: tenant.tenantId, userId: tenant.userId, propertyId: tenant.propertyId },
    publisher,
  };
}

export async function disposeTestContext(test: TestContext): Promise<void> {
  await dropTestTenant(test.tenant.tenantId);
  test.publisher.clear();
}

/** Reads the commerce CommerceSiteTheme row written through on publish — now keyed
 *  per (tenant, property) (docs/49 Phase 6). */
export function readCommerceSiteTheme(tenantId: string, propertyId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    return tx.commerceSiteTheme.findUnique({
      where: { tenantId_propertyId: { tenantId, propertyId } },
    });
  });
}
