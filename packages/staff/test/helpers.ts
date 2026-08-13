// Per-test fixtures for @sparx/staff integration tests.
//
// Every test gets a fresh tenant with a primary site and the finance categories
// seeded — the labour deriver files into the `wages` category, so a fixture
// without them builds a tenant the deriver legitimately refuses to work with.
//
// Teardown is a single tenant delete, which is also a live check that the nine
// staff tables cascade from `tenant_id` the way the schema claims.

import crypto from 'node:crypto';

import { prisma } from '@sparx/db';
import { seedCategories } from '@sparx/finance';

export interface TestTenant {
  tenantId: string;
  slug: string;
  /** The tenant's PRIMARY site. Staff is site-scoped, so a fixture without one
   *  builds a tenant that cannot exist in production. */
  propertyId: string;
  /** A second business under the same owner — the case that catches a deriver
   *  keying its expense on the person and period alone. */
  secondPropertyId: string;
}

export async function createTestTenant(): Promise<TestTenant> {
  const slug = `staff-test-${crypto.randomBytes(4).toString('hex')}`;
  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: `Staff Test ${slug}`,
      email: `${slug}@sparx.test`,
      plan: 'starter',
      status: 'active',
      settings: { modules: { staff: { enabled: true }, finance: { enabled: true } } },
    },
  });

  const [propertyId, secondPropertyId] = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenant.id}'`);
    const first = await tx.property.create({
      data: { tenantId: tenant.id, slug: 'primary', name: `Staff Test ${slug}`, isPrimary: true },
      select: { id: true },
    });
    const second = await tx.property.create({
      data: { tenantId: tenant.id, slug: 'second', name: `Second ${slug}`, isPrimary: false },
      select: { id: true },
    });
    return [first.id, second.id];
  });

  // The wages category the labour deriver targets by slug.
  await seedCategories(tenant.id);

  return { tenantId: tenant.id, slug, propertyId, secondPropertyId };
}

export async function dropTestTenant(tenantId: string): Promise<void> {
  await prisma.tenant.delete({ where: { id: tenantId } });
}

/** Midnight-UTC for a plain `YYYY-MM-DD`, matching how a DATE column round-trips. */
export function day(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}
