// SAMPLE SUPPORT REQUESTS MUST NOT SHOW A CLOCK WITH NO RULE BEHIND IT.
//
// The sample-data support slice writes its reply deadlines by hand, on purpose:
// a demo has to show a breached request NOW rather than nine working hours from
// whenever somebody pressed Load. That decision is about the DATES, and it is a
// good one.
//
// It was silently also a decision about the POLICY, which the slice never
// created. So a business that loaded sample data saw five requests with live
// clocks — one breached, one amber — and a Response times screen that said "No
// response times set up yet" and promised "one is created for you the first time
// a support request comes in", with five requests already in the queue. Measured
// before the fix: 10 of the 11 requests on the platform belonged to a tenant
// with no policy at all.
//
// The dates stay hand-placed. What this proves is that the rule they are
// measured against exists and is named on every row, so the owner can find it,
// read it and change it.

import crypto from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadSampleData, prisma, resolveSamplePack, withTenant } from '@wizeworks/db';

import { seedPrimaryProperty } from '../helpers.js';

describe('sample support requests', () => {
  let tenantId: string;

  beforeAll(async () => {
    const slug = `sample-sla-${crypto.randomBytes(4).toString('hex')}`;
    const tenant = await prisma.tenant.create({
      data: {
        slug,
        name: slug,
        email: `${slug}@sparx.test`,
        plan: 'starter',
        status: 'active',
        settings: { modules: { crm: { enabled: true } } },
      },
    });
    tenantId = tenant.id;
    await seedPrimaryProperty(tenantId, `Test ${slug}`);
    // Crm only: the support slice is all this exercises, and loading commerce
    // and inventory alongside it would spend a minute proving nothing.
    await withTenant({ tenantId }, async (tx) => {
      await tx.user.create({
        data: { tenantId, email: `owner-${slug}@sparx.test`, name: 'Owner', role: 'owner' },
      });
    });
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
  });

  it('leave a promise on file that every one of them names', async () => {
    const pack = resolveSamplePack('florist');
    expect(pack).toBeDefined();
    await loadSampleData({ tenantId }, pack!, ['crm']);

    const { policies, tickets } = await withTenant({ tenantId }, async (tx) => ({
      policies: await tx.ticketSlaPolicy.findMany({
        include: { targets: true },
      }),
      tickets: await tx.ticket.findMany({
        select: { id: true, slaPolicyId: true, firstResponseDueAt: true },
      }),
    }));

    // The sample queue is the whole point of the slice, so an empty one means
    // the fixture broke rather than that the guard passed.
    expect(tickets.length).toBeGreaterThan(0);

    // One promise, with the priority targets on it, so the Response times screen
    // has something to draw and edit.
    expect(policies).toHaveLength(1);
    expect(policies[0]!.isDefault).toBe(true);
    expect(policies[0]!.targets.length).toBeGreaterThanOrEqual(4);

    // The property: a request showing a deadline must name the rule that set it.
    for (const ticket of tickets) {
      if (ticket.firstResponseDueAt === null) continue;
      expect(ticket.slaPolicyId, `ticket ${ticket.id} shows a clock`).toBe(policies[0]!.id);
    }
  });
});
