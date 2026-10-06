// A person on a trade account is found by the account's name.
//
// MEASURED 2026-10-03 on Gillett Diesel Service. Wasatch Front Utility
// Contractors, LLC has three people on it: Renée (its main buyer, every order on
// the account), Marcus (a viewer) and Teodora (an approver, added that day).
// Typing "Wasatch" into the console's search box found Teodora alone, and
// "Wasatch Marcus" could not find Marcus. The customer document's `company` was
// the free-text employer column, which only Teodora's creator had filled in; the
// other two were on the account through the pointer and the contact list, and
// their documents carried neither.
//
// These run against real Postgres: they write the same rows the account screen
// writes and build the document the indexer would send.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { prisma, withTenant } from '@wizeworks/db';
import { listCustomerIdsForAccount, projectCustomer } from '@wizeworks/commerce';

const WASATCH = 'Wasatch Front Utility Contractors, LLC';
const RED_ROCK = 'Red Rock Hotshot Trucking';

let tenantId = '';
const ids = {
  wasatch: '',
  redRock: '',
  closed: '',
  renee: '',
  marcus: '',
  teodora: '',
  lapsed: '',
  stranger: '',
};

async function company(customerId: string): Promise<string | undefined> {
  const { document } = await projectCustomer({ tenantId }, customerId);
  return document?.company;
}

beforeAll(async () => {
  const slug = `acct-${crypto.randomBytes(4).toString('hex')}`;
  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: `Accounts ${slug}`,
      email: `${slug}@sparx.test`,
      plan: 'starter',
      status: 'active',
      settings: {},
    },
  });
  tenantId = tenant.id;

  await withTenant({ tenantId }, async (tx) => {
    const account = (companyName: string, deletedAt: Date | null = null) =>
      tx.company.create({ data: { tenantId, companyName, deletedAt }, select: { id: true } });
    ids.wasatch = (await account(WASATCH)).id;
    ids.redRock = (await account(RED_ROCK)).id;
    ids.closed = (await account('Closed Down Haulage', new Date())).id;

    const person = (
      firstName: string,
      lastName: string,
      extra: { companyId?: string; companyName?: string } = {}
    ) =>
      tx.customer.create({
        data: { tenantId, firstName, lastName, email: `${firstName}@example.test`, ...extra },
        select: { id: true },
      });
    // The main buyer: filed under the account, on its list, nothing typed.
    ids.renee = (await person('Renee', 'Castaneda', { companyId: ids.wasatch })).id;
    // A viewer on Wasatch who also buys for Red Rock, which prices him.
    ids.marcus = (await person('Marcus', 'Oyelaran-Pike', { companyId: ids.redRock })).id;
    // Typed the employer the same as the account, in a different case.
    ids.teodora = (
      await person('Teodora', 'Vukic-Hale', {
        companyId: ids.wasatch,
        companyName: 'wasatch front utility contractors, llc',
      })
    ).id;
    // Switched off Wasatch, and on the list of an account that was removed.
    ids.lapsed = (await person('Lapsed', 'Buyer')).id;
    // On no account at all, with an employer typed by hand.
    ids.stranger = (await person('Walk', 'In', { companyName: 'Sole Trader' })).id;

    const contact = (accountId: string, customerId: string, role: string, isActive = true) =>
      tx.b2bAccountContact.create({ data: { tenantId, accountId, customerId, role, isActive } });
    await contact(ids.wasatch, ids.renee, 'buyer');
    await contact(ids.redRock, ids.marcus, 'buyer');
    await contact(ids.wasatch, ids.marcus, 'viewer');
    await contact(ids.wasatch, ids.teodora, 'approver');
    await contact(ids.wasatch, ids.lapsed, 'buyer', false);
    await contact(ids.closed, ids.lapsed, 'buyer');
  });
});

afterAll(async () => {
  if (tenantId) await prisma.tenant.delete({ where: { id: tenantId } });
  await prisma.$disconnect();
});

describe('the business a customer is found by', () => {
  it('is the account that prices them, with nothing typed', async () => {
    expect(await company(ids.renee)).toBe(WASATCH);
  });

  it('includes every account they are an active contact on', async () => {
    // Red Rock prices him, so it comes first; Wasatch is where he is a viewer.
    expect(await company(ids.marcus)).toBe(`${RED_ROCK} · ${WASATCH}`);
  });

  it('does not repeat a typed employer that is the account', async () => {
    expect(await company(ids.teodora)).toBe(WASATCH);
  });

  it('leaves out an account they were switched off and one that was removed', async () => {
    expect(await company(ids.lapsed)).toBeUndefined();
  });

  it('still carries a typed employer for someone on no account', async () => {
    expect(await company(ids.stranger)).toBe('Sole Trader');
  });
});

describe('the people an account change has to re-read', () => {
  it('is everyone filed under it or on its list, switched off included', async () => {
    const found = await listCustomerIdsForAccount({ tenantId }, ids.wasatch);
    expect([...found].sort()).toEqual([ids.renee, ids.marcus, ids.teodora, ids.lapsed].sort());
  });
});
