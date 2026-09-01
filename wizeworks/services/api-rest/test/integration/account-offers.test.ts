// What a shop offers a shopper, read from EVIDENCE (issue 335).
//
// Juniper Row sews clothes. Her customer's account listed Bookings, with a
// "Book an appointment" button leading to "No services are bookable yet", and a
// B2B Account panel telling that customer to "contact your sales representative
// to set up wholesale purchasing" — at a one-woman studio with no sales
// representatives and no B2B accounts.
//
// The gate deliberately is NOT the module flag. A module being enabled says the
// tenant COULD take bookings; it says nothing about whether they do, and one of
// the two brands ships every module on, so a flag would hide nothing there.
// These pin the evidence instead: a bookable service exists; this customer
// belongs to a company.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '@wizeworks/db';
import { loadOffers } from '../../src/routes/v1/public/account.js';
import { createTestTenant, dropTestTenant, type TestTenant } from '../helpers.js';

describe('what a shop offers a shopper', () => {
  let fixture: TestTenant;
  let ctx: { tenantId: string };
  let shopper: string;

  async function asTenant<T>(fn: (tx: typeof prisma) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${fixture.tenantId}'`);
      return fn(tx as unknown as typeof prisma);
    });
  }

  beforeAll(async () => {
    fixture = await createTestTenant('owner');
    ctx = { tenantId: fixture.tenantId };
    const customer = await asTenant((tx) =>
      tx.customer.create({
        data: {
          tenantId: fixture.tenantId,
          propertyId: fixture.propertyId,
          email: 'shopper@offers.test',
          firstName: 'Marguerite',
        },
        select: { id: true },
      })
    );
    shopper = customer.id;
  });

  afterAll(async () => {
    await dropTestTenant(fixture.tenantId);
  });

  it('offers neither at a shop that takes no bookings and has no B2B', async () => {
    // Juniper Row exactly. Both panels vanish from the account nav.
    expect(await loadOffers(ctx, shopper)).toEqual({ bookings: false, b2b: false });
  });

  it('offers bookings once ONE service is bookable online', async () => {
    const service = await asTenant((tx) =>
      tx.schedulingService.create({
        data: {
          tenantId: fixture.tenantId,
          propertyId: fixture.propertyId,
          name: 'Fitting',
          durationMinutes: 30,
          bookableOnline: true,
          isActive: true,
        },
        select: { id: true },
      })
    );
    expect((await loadOffers(ctx, shopper)).bookings).toBe(true);

    // Taken offline for online booking — the shop still HAS the service, and a
    // shopper still cannot book it, so the panel goes again. This is the case a
    // module flag gets wrong: `scheduling` is enabled throughout.
    await asTenant((tx) =>
      tx.schedulingService.update({ where: { id: service.id }, data: { bookableOnline: false } })
    );
    expect((await loadOffers(ctx, shopper)).bookings).toBe(false);

    await asTenant((tx) =>
      tx.schedulingService.update({
        where: { id: service.id },
        data: { bookableOnline: true, isActive: false },
      })
    );
    expect((await loadOffers(ctx, shopper)).bookings).toBe(false);

    await asTenant((tx) => tx.schedulingService.delete({ where: { id: service.id } }));
  });

  it('offers B2B only to a shopper who actually has an account', async () => {
    const company = await asTenant((tx) =>
      tx.company.create({
        data: { tenantId: fixture.tenantId, companyName: 'Ridgeline Outfitters' },
        select: { id: true },
      })
    );
    // The company existing is NOT enough — B2B access is per shopper, and telling
    // everybody to call their rep because SOMEBODY is a wholesale account is the
    // defect in its other direction.
    expect((await loadOffers(ctx, shopper)).b2b).toBe(false);

    await asTenant((tx) =>
      tx.customer.update({ where: { id: shopper }, data: { companyId: company.id } })
    );
    expect((await loadOffers(ctx, shopper)).b2b).toBe(true);
  });
});
