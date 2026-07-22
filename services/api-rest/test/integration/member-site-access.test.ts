// Per-member SITE access (docs/131 §3.3) — end to end, through real routes.
//
// The case: one tenant, "Korous Family Inc.", running two unrelated businesses —
// Bob's Parts (machined parts) and Savory Donuts. A donut-shop employee must not
// read the machine shop's customers, and before `member_property_access` there
// was no way to express that: every staff member reached every site.
//
// These assert the REFUSAL as hard as the allow. The defect was never "the wrong
// person sees nothing" — it was "the wrong person sees everything", so a test
// that only proves the happy path proves nothing.
//
// Note the three doors this closes, which is why there are three tests rather
// than one. A restricted member could otherwise reach the other business by:
//   1. sending the other site's id in `x-sparx-property-id`
//   2. sending NO header at all and landing on the tenant's primary site
//   3. asking for `?property=all`, the documented cross-site read
// The third needed no forged id and no guessing — one query parameter.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@sparx/db';
import { createApp } from '../../src/app.js';
import {
  authHeader,
  createTestTenant,
  dropTestTenant,
  signToken,
  type TestTenant,
} from '../helpers.js';

let app: FastifyInstance;
let tenant: TestTenant;
let parts: string;
let donuts: string;

/** The routes under test are module-gated, and `createTestTenant` provisions a
 *  tenant with no modules — which 404s before any site check runs, hiding
 *  exactly what these tests exist to prove. */
async function enableModules(tenantId: string): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      settings: {
        modules: {
          crm: { enabled: true },
          builder: { enabled: true },
          commerce: { enabled: true },
        },
      },
    },
  });
}

/** A customer belonging to one site, so the assertions can name a RECORD rather
 *  than an id. The first version of these tests asserted the response did not
 *  contain the forbidden site's UUID — which passed with enforcement switched
 *  OFF, because the list was empty and the id never appeared either way. An
 *  assertion that cannot fail is worse than no assertion: it reports success. */
async function seedCustomer(tenantId: string, propertyId: string, email: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    const c = await tx.customer.create({
      data: { tenantId, propertyId, type: 'retail', email },
      select: { id: true },
    });
    return c.id;
  });
}

/** An order on one site (docs/131 §3.3 read-scoping). The order NUMBER is the
 *  assertable record — like the customer email, "which of the two came back" is a
 *  question with a wrong answer, and the wrong answer is the leak this proves is
 *  closed. */
async function seedOrder(
  tenantId: string,
  propertyId: string | null,
  customerId: string,
  orderNumber: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    await tx.order.create({
      data: { tenantId, propertyId, customerId, orderNumber, placedAt: new Date() },
    });
  });
}

/** An automation on one site, or tenant-wide when propertyId is null. Automation
 *  is the SHARED-null model (docs/131 §3.3): a null site means "applies to every
 *  business", so a restricted member SEES it — the opposite of an orphaned order.
 *  The name is the assertable record. */
async function seedAutomation(
  tenantId: string,
  propertyId: string | null,
  name: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    await tx.automation.create({
      data: { tenantId, propertyId, name, triggerType: 'order.placed' },
    });
  });
}

/** Rename an existing site — used for the primary, which already exists. */
async function renameSite(tenantId: string, id: string, name: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    await tx.property.update({ where: { id }, data: { name } });
  });
}

/** A site under the tenant. `properties` is FORCE RLS, so this goes through a
 *  tenant-scoped exec like the other fixtures. */
async function createSite(tenantId: string, name: string, isPrimary: boolean): Promise<string> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    const row = await tx.property.create({
      data: {
        tenantId,
        slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${crypto.randomBytes(3).toString('hex')}`,
        name,
        isPrimary,
      },
      select: { id: true },
    });
    return row.id;
  });
}

/** Restrict the tenant's member to exactly `propertyIds`. Written directly
 *  rather than through the API so the test exercises ENFORCEMENT, not the
 *  team-edit route — those are separate concerns and separate failures. */
async function restrictMemberTo(
  tenantId: string,
  userId: string,
  propertyIds: string[]
): Promise<void> {
  // `members` carries an RLS policy keyed on current_tenant_id(), and the test
  // client is the NOBYPASSRLS app role — so the insert needs the GUC set, same
  // as the `users` fixture in helpers.ts. (It blocked this on the first run,
  // which is the policy doing its job.)
  const member = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    return tx.member.create({
      data: {
        organizationId: tenantId,
        userId,
        // NOT owner/admin — those roles ignore the restriction by design, since
        // they can lift it in one click (roleIgnoresPropertyAccess).
        role: 'editor',
        propertyAccessMode: 'selected',
        propertyAccess: { create: propertyIds.map((propertyId) => ({ propertyId })) },
      },
      select: { id: true },
    });
  });
  expect(member.id).toBeTruthy();
}

beforeAll(async () => {
  app = await createApp();
  await app.ready();
  tenant = await createTestTenant('editor');
  await enableModules(tenant.tenantId);
  // The machine shop is the PRIMARY site — deliberately, because the no-header
  // fallback lands on the primary, so making the FORBIDDEN site the primary is
  // what turns those assertions into real ones rather than coincidences.
  //
  // It reuses the primary `createTestTenant` already seeded rather than minting
  // another: "exactly one primary per tenant" is a partial unique index, so a
  // second one is a constraint violation.
  parts = tenant.propertyId;
  await renameSite(tenant.tenantId, parts, 'Bobs Parts');
  donuts = await createSite(tenant.tenantId, 'Savory Donuts', false);
  await restrictMemberTo(tenant.tenantId, tenant.userId, [donuts]);
  // One customer per business. Every assertion below is "which of these two
  // came back", which is a question that has a wrong answer.
  const partsCustomer = await seedCustomer(tenant.tenantId, parts, 'buyer@bobsparts.test');
  const donutsCustomer = await seedCustomer(tenant.tenantId, donuts, 'buyer@savorydonuts.test');
  // One order per business — the read-scoping regression guard: the /v1/orders
  // list had NO member-access bound before docs/131 §3.3's read-scoping pass, so
  // a donut-restricted member could list the machine shop's orders.
  await seedOrder(tenant.tenantId, parts, partsCustomer, 'BOBS-0001');
  await seedOrder(tenant.tenantId, donuts, donutsCustomer, 'DONUTS-0001');
  // An ORPHANED order — propertyId null, as if its origin site was deleted
  // (Order.propertyId is SetNull). The restricted member must NOT see it: null
  // here means "a now-gone business", not "shared". This guards the orphaned-null
  // branch (docs/131 §3.3), which the two site-stamped orders above cannot.
  await seedOrder(tenant.tenantId, null, donutsCustomer, 'ORPHAN-0001');
  // Automations exercise the SHARED-null branch: one per site plus a tenant-wide
  // one. The restricted member must see their own site's AND the shared one, but
  // not the machine shop's.
  await seedAutomation(tenant.tenantId, parts, 'AUTO-BOBS');
  await seedAutomation(tenant.tenantId, donuts, 'AUTO-DONUTS');
  await seedAutomation(tenant.tenantId, null, 'AUTO-SHARED');
});

afterAll(async () => {
  await dropTestTenant(tenant.tenantId);
  await app.close();
});

describe('per-member site access', () => {
  it('serves the granted site when its header is sent', async () => {
    const token = signToken(app, tenant, 'editor');
    const res = await app.inject({
      method: 'GET',
      url: '/v1/crm/customers',
      headers: { ...authHeader(token), 'x-sparx-property-id': donuts },
    });
    expect(res.statusCode).toBeLessThan(400);
    expect(res.body).toContain('savorydonuts');
    expect(res.body).not.toContain('bobsparts');
  });

  it('does not serve another site named in the header', async () => {
    const token = signToken(app, tenant, 'editor');
    const res = await app.inject({
      method: 'GET',
      url: '/v1/crm/customers',
      headers: { ...authHeader(token), 'x-sparx-property-id': parts },
    });
    // The header is a switcher value, so a site the member cannot reach falls
    // back to one they can rather than 403-ing the whole screen — but it must
    // never resolve to `parts`. Proven below by the body being the donut site's.
    expect(res.statusCode).toBeLessThan(400);
    expect(res.body).toContain('savorydonuts');
    expect(res.body).not.toContain('bobsparts');
  });

  it('falls back to the granted site, NOT the tenant primary, when no header is sent', async () => {
    const token = signToken(app, tenant, 'editor');
    const res = await app.inject({
      method: 'GET',
      url: '/v1/crm/customers',
      headers: authHeader(token),
    });
    expect(res.statusCode).toBeLessThan(400);
    // `parts` is the PRIMARY site. Before this fix, sending no header at all
    // landed every restricted member on it — the machine shop's customer list,
    // reached by doing nothing.
    expect(res.body).toContain('savorydonuts');
    expect(res.body).not.toContain('bobsparts');
  });

  it('narrows ?property=all to the granted site instead of the whole tenant', async () => {
    const token = signToken(app, tenant, 'editor');
    const res = await app.inject({
      method: 'GET',
      url: '/v1/crm/customers?property=all',
      headers: authHeader(token),
    });
    // The widest door: `all` is the documented cross-site read, needing no
    // forged id. A restricted member gets their own site, never the tenant.
    expect(res.statusCode).toBeLessThan(400);
    expect(res.body).toContain('savorydonuts');
    expect(res.body).not.toContain('bobsparts');
  });

  it('404s an explicit target the member may not reach', async () => {
    const token = signToken(app, tenant, 'editor');
    const res = await app.inject({
      method: 'GET',
      url: `/v1/builder/emails/site/${parts}`,
      headers: authHeader(token),
    });
    // Not-found rather than forbidden, deliberately: indistinguishable from an
    // id that does not exist, so the error cannot be used to enumerate which
    // businesses the account runs.
    expect(res.statusCode).toBe(404);
  });

  it('bounds a dashboard LIST (orders) to the member reachable sites', async () => {
    // The read-scoping regression guard (docs/131 §3.3). The order list takes no
    // ?property — a restricted member must still see only their business's
    // orders, because the list is bounded by member access, not by a switcher.
    const token = signToken(app, tenant, 'editor');
    const res = await app.inject({
      method: 'GET',
      url: '/v1/orders',
      headers: authHeader(token),
    });
    expect(res.statusCode).toBeLessThan(400);
    // The donut member sees the donut order and NOT the machine shop's — the
    // exact leak that existed before the reads were bounded.
    expect(res.body).toContain('DONUTS-0001');
    expect(res.body).not.toContain('BOBS-0001');
    // ...and NOT the orphaned (null-property) order: for an order, null means a
    // deleted business, so a restricted member has no claim to it (docs/131
    // §3.3 orphaned-null). This is the branch a shared-null model would get
    // wrong by admitting null — proving the distinction is real, not cosmetic.
    expect(res.body).not.toContain('ORPHAN-0001');
  });

  it('includes tenant-wide (shared-null) records for a restricted member', async () => {
    // The complement of the orphaned-order case (docs/131 §3.3). An automation's
    // null site means "every business" (shared), so the donut-restricted member
    // must see their own site's automation AND the tenant-wide one — but never
    // the machine shop's. Getting THIS wrong (excluding null) would hide shared
    // records; getting the ORDER case wrong (including null) would leak orphaned
    // ones. The two tests together pin the distinction from both sides.
    const token = signToken(app, tenant, 'editor');
    const res = await app.inject({
      method: 'GET',
      url: '/v1/automations',
      headers: authHeader(token),
    });
    expect(res.statusCode).toBeLessThan(400);
    expect(res.body).toContain('AUTO-DONUTS');
    expect(res.body).toContain('AUTO-SHARED');
    expect(res.body).not.toContain('AUTO-BOBS');
  });

  it('leaves an unrestricted member reaching every site', async () => {
    const other = await createTestTenant('owner');
    try {
      await enableModules(other.tenantId);
      const a = other.propertyId;
      const b = await createSite(other.tenantId, 'Site B', false);
      await seedCustomer(other.tenantId, a, 'a@sitea.test');
      await seedCustomer(other.tenantId, b, 'b@siteb.test');
      const token = signToken(app, other, 'owner');
      const res = await app.inject({
        method: 'GET',
        url: '/v1/crm/customers?property=all',
        headers: authHeader(token),
      });
      expect(res.statusCode).toBeLessThan(400);
      // BOTH sites — an unrestricted member still reads across the tenant, so
      // the narrowing above is a restriction rather than a global regression.
      expect(res.body).toContain('sitea');
      expect(res.body).toContain('siteb');
    } finally {
      await dropTestTenant(other.tenantId);
    }
  });
});
