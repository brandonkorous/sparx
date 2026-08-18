// Per-test fixtures: provision tenants + users + JWTs against the local
// Postgres so each integration test starts from a known small state.
//
// Convention: tenants are named `test_${random()}` and deleted at the end
// of the test. ON DELETE CASCADE on tenant_id reaches every CMS table, so
// dropping the tenant drops every row the test created — with the documented
// exception of the sparx.market global projections, which `dropTestTenant`
// removes by hand. See the note there before adding another FK-less table.

import crypto from 'node:crypto';
import { marketService } from '@wizeworks/commerce';
import { prisma } from '@wizeworks/db';
import type { FastifyInstance } from 'fastify';
import type { StaffRole } from '@wizeworks/api-core/auth';

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

/**
 * Tear down a fixture tenant.
 *
 * THE CASCADE DOES NOT REACH EVERYTHING, and this comment used to claim it did.
 * `market_listings` and `market_merchants` are the sparx.market GLOBAL projections
 * (docs/106 §4.7): cross-tenant readable, and therefore deliberately FK-LESS — the
 * `Tenant` model says so in as many words and does not relate to them. No FK means no
 * cascade, so deleting the tenant left both rows behind, permanently, keyed on a
 * tenant id that no longer exists.
 *
 * That is not a cosmetic leak. `market_merchants.slug` is GLOBALLY unique, so one
 * abandoned row permanently owns a handle: `market-merchant-handle.test.ts` claimed
 * `savory-donuts`, and every subsequent run of the whole api-rest suite — on any
 * branch, by anyone sharing that database — died on a unique violation inside
 * `refreshMerchantOnTx`, with a stack pointing at projection code that was working
 * correctly. Two orphans were sitting in the local database when this was found.
 *
 * So the projection is torn down EXPLICITLY, first, through the service that owns that
 * teardown — if a third global projection is ever added, this follows automatically.
 *
 * It has to run INSIDE a tenant session. "Global" describes the READ policy on these
 * tables (`SELECT … USING (true)`, so the marketplace can list every seller); writes are
 * still `tenant_id = current_tenant_id()` under FORCE ROW LEVEL SECURITY. A direct
 * `prisma.marketMerchant.deleteMany({ where: { tenantId } })` therefore deletes NOTHING
 * and reports no error — RLS filters the rows out and the delete succeeds against zero
 * of them. That silent no-op is exactly how this went unnoticed in the first place, so
 * it is worth stating: on these tables, a delete that appears to work may not have.
 */
export async function dropTestTenant(tenantId: string): Promise<void> {
  await marketService.removeAllMarketProjection({ tenantId });
  // Everything else IS reached by the cascade.
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
