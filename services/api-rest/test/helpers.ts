// Per-test fixtures: provision tenants + users + JWTs against the local
// Postgres so each integration test starts from a known small state.
//
// Convention: tenants are named `test_${random()}` and deleted at the end
// of the test. ON DELETE CASCADE on tenant_id reaches every CMS table, so
// dropping the tenant drops every row the test created.

import crypto from 'node:crypto';
import { prisma } from '@sparx/db';
import type { FastifyInstance } from 'fastify';
import type { StaffRole } from '@sparx/api-core/auth';

export interface TestTenant {
  tenantId: string;
  userId: string;
  email: string;
  /** The tenant's PRIMARY site, seeded exactly as real provisioning does. Use
   *  this rather than creating another — "exactly one primary per tenant" is a
   *  partial unique index, so a second one is a constraint violation, not a
   *  second primary. */
  propertyId: string;
}

export async function createTestTenant(role: StaffRole = 'owner'): Promise<TestTenant> {
  const slug = `test-${crypto.randomBytes(4).toString('hex')}`;
  const email = `${slug}@sparx.test`;
  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: `Test ${slug}`,
      email,
      plan: 'starter',
      status: 'active',
      settings: {},
    },
  });
  // users has FORCE RLS, so insert via a tenant-scoped raw exec.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenant.id}'`);
    await tx.user.create({
      data: {
        tenantId: tenant.id,
        email,
        name: `Test ${slug}`,
        role,
      },
    });
  });
  const user = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenant.id}'`);
    return tx.user.findFirstOrThrow({ where: { tenantId: tenant.id, email } });
  });
  const propertyId = await seedPrimaryProperty(tenant.id, `Test ${slug}`);
  return { tenantId: tenant.id, userId: user.id, email, propertyId };
}

/**
 * The tenant's PRIMARY site.
 *
 * Real provisioning creates one for every tenant (`provision-tenant.ts` — one
 * `is_primary` property, enforced by a partial unique index), so a fixture that
 * skips it builds a tenant that CANNOT EXIST in production. Everything that
 * resolves a site then 404s on `Property primary for tenant …`, and the failure
 * surfaces far from its cause — as a 404 on an unrelated list endpoint.
 *
 * Exported because several suites build their own tenant rather than going
 * through `createTestTenant`; they should all call this.
 */
export async function seedPrimaryProperty(tenantId: string, name: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    const row = await tx.property.create({
      data: { tenantId, slug: 'primary', name, isPrimary: true },
      select: { id: true },
    });
    return row.id;
  });
}

export async function dropTestTenant(tenantId: string): Promise<void> {
  // Cascade reaches every tenant-scoped table.
  await prisma.tenant.delete({ where: { id: tenantId } });
}

export function signToken(
  app: FastifyInstance,
  // Only the two claims it actually mints, not the whole fixture. Several suites
  // build their own tenant shape, and requiring `TestTenant` here would force
  // each of them to carry fields this function never reads.
  fixture: Pick<TestTenant, 'tenantId' | 'userId'>,
  role: StaffRole = 'owner',
  // Mirrors the dashboard mint: the `ev` (email-verified) claim drives
  // requireVerifiedEmail. Defaults to a verified staff user; pass false to
  // exercise the verify-email gate.
  opts: { emailVerified?: boolean } = {}
): string {
  return app.jwt.sign(
    { sub: fixture.userId, tid: fixture.tenantId, role, ev: opts.emailVerified ?? true },
    { expiresIn: '5m' }
  );
}

export function authHeader(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}
