// Per-test fixtures for @sparx/finance integration tests.
//
// Every test gets a fresh tenant with a primary site. Teardown is a single
// tenant delete — every finance table cascades from `tenant_id`, which is also a
// live check that the cascades are wired the way the schema claims.
//
// Mirrors packages/crm/test/helpers.ts so the two test surfaces behave the same.

import crypto from 'node:crypto';

import { prisma } from '@sparx/db';

export interface TestTenant {
  tenantId: string;
  slug: string;
  /** The tenant's PRIMARY site. Finance is site-scoped (docs/131 §4), so a
   *  fixture without one builds a tenant that cannot exist in production. */
  propertyId: string;
}

/** Create a tenant with Finance enabled. `properties` is FORCE RLS, so the site
 *  insert goes through a tenant-scoped transaction rather than a bare create. */
export async function createTestTenant(): Promise<TestTenant> {
  const slug = `fin-test-${crypto.randomBytes(4).toString('hex')}`;
  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: `Finance Test ${slug}`,
      email: `${slug}@sparx.test`,
      plan: 'starter',
      status: 'active',
      settings: { modules: { finance: { enabled: true } } },
    },
  });

  const propertyId = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenant.id}'`);
    const row = await tx.property.create({
      data: { tenantId: tenant.id, slug: 'primary', name: `Finance Test ${slug}`, isPrimary: true },
      select: { id: true },
    });
    return row.id;
  });

  return { tenantId: tenant.id, slug, propertyId };
}

export async function dropTestTenant(tenantId: string): Promise<void> {
  await prisma.tenant.delete({ where: { id: tenantId } });
}

/** Midnight-UTC for a plain `YYYY-MM-DD`, matching how a DATE column round-trips. */
export function day(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}
