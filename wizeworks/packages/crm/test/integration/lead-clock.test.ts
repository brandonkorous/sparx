// The lead response clock against the real schema: which promise a new enquiry
// is held to.
//
// A lead with no site is shared by every site (docs/58 D2). The policy lookup
// used to ask, for such a lead, for a business-wide promise ONLY, so a promise
// set on the main site (where the console saves one) started no clock at all.
// The scoring model lookup had the identical blind spot (issue 910).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '@wizeworks/db';

import { customerService } from '../../src/services/index.js';
import { startLeadClock } from '../../src/services/lead-clock.js';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

const AT = new Date('2026-03-02T15:00:00.000Z');
const MINUTE = 60 * 1000;

async function policy(
  context: TestContext,
  name: string,
  propertyId: string | null,
  minutes: number
): Promise<void> {
  await withTenant(context.ctx, (tx) =>
    tx.ticketSlaPolicy.create({
      data: {
        tenantId: context.tenant.tenantId,
        propertyId,
        name,
        isDefault: true,
        // An empty week is 24/7, so the due time is plain arithmetic.
        businessHours: [],
        leadResponseMinutes: minutes,
      },
    })
  );
}

async function siteLessLead(context: TestContext): Promise<string> {
  const customer = await customerService.create(context.ctx, {
    email: `lead-${Math.random().toString(36).slice(2, 10)}@example.test`,
    firstName: 'Lead',
  });
  await withTenant(context.ctx, (tx) =>
    tx.customer.update({ where: { id: customer.id }, data: { propertyId: null } })
  );
  return customer.id;
}

async function dueAt(context: TestContext, customerId: string): Promise<Date | null> {
  const row = await withTenant(context.ctx, (tx) =>
    tx.customer.findUnique({ where: { id: customerId }, select: { leadResponseDueAt: true } })
  );
  return row?.leadResponseDueAt ?? null;
}

describe('lead clock, for a lead with no site', () => {
  let mainOnly: TestContext;
  let both: TestContext;

  beforeAll(async () => {
    mainOnly = await makeTestContext();
    both = await makeTestContext();
    await policy(mainOnly, 'Main site promise', mainOnly.propertyId, 60);
    await policy(both, 'Main site promise', both.propertyId, 60);
    await policy(both, 'Business-wide promise', null, 30);
  });

  afterAll(async () => {
    await disposeTestContext(mainOnly);
    await disposeTestContext(both);
  });

  it('is held to the main site’s promise when that is the only one', async () => {
    const customerId = await siteLessLead(mainOnly);
    await startLeadClock(mainOnly.ctx, { customerId, propertyId: null, at: AT });
    expect(await dueAt(mainOnly, customerId)).toEqual(new Date(AT.getTime() + 60 * MINUTE));
  });

  it('is held to the business-wide promise when there is one', async () => {
    const customerId = await siteLessLead(both);
    await startLeadClock(both.ctx, { customerId, propertyId: null, at: AT });
    expect(await dueAt(both, customerId)).toEqual(new Date(AT.getTime() + 30 * MINUTE));
  });

  it('still holds a lead WITH a site to that site’s own promise', async () => {
    const customerId = await siteLessLead(both);
    await startLeadClock(both.ctx, { customerId, propertyId: both.propertyId, at: AT });
    expect(await dueAt(both, customerId)).toEqual(new Date(AT.getTime() + 60 * MINUTE));
  });
});
