// An order is found by the name of the trade account it belongs to.
//
// MEASURED 2026-10-04 on Gillett Diesel Service: typing "Wasatch" in the console
// search box found Wasatch Front Utility Contractors, LLC, its invoices, quotes
// and contacts, and none of Renée Castañeda's five orders on the account
// (O-000007, O-000008, O-000011, O-000014, O-000015). An order's search document
// carried the buyer's name and email and no account name at all.
//
// Which account: the one the order was quoted to, then the one it was invoiced
// to, both settled while the order was being made, then the buyer's pricing
// account today. A removed account is not named, and nothing stands in for it.

import { describe, expect, it, vi } from 'vitest';

let row: Record<string, unknown> | null = null;
let customerRow: Record<string, unknown> | null = null;
const accounts = new Map<string, object>();
const findUnique = vi.fn((_args: { include?: Record<string, unknown> }) => Promise.resolve(row));
const findAccount = vi.fn((args: { where: { id: string } }) =>
  Promise.resolve(accounts.get(args.where.id) ?? null)
);
const findCustomer = vi.fn((_args: { include?: Record<string, unknown> }) =>
  Promise.resolve(customerRow)
);
const tx = {
  order: { findUnique },
  company: { findUnique: findAccount },
  customer: { findFirst: findCustomer },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));

const { orderAccount, projectCustomer, projectOrder } = await import('./search-projection');

const T = '5944fe23-be83-4ce5-aafc-ef56b8594508';
interface Account {
  id: string;
  companyName: string;
  deletedAt: Date | null;
}

const WASATCH: Account = {
  id: '8aa59a36-acc9-455f-b0ba-41c0b66292b9',
  companyName: 'Wasatch Front Utility Contractors, LLC',
  deletedAt: null,
};
const RED_ROCK: Account = {
  id: 'fcf02f53-c400-4487-a8ef-5c25224a7e8d',
  companyName: 'Red Rock Hotshot Trucking',
  deletedAt: null,
};
const CLOSED: Account = {
  id: '40dbcd6e-8bf8-4876-bcc1-7aa04e921488',
  companyName: 'Closed Down Haulage',
  deletedAt: new Date('2026-09-01T00:00:00Z'),
};
for (const a of [WASATCH, RED_ROCK, CLOSED]) accounts.set(a.id, a);

function order(parts: {
  pricing?: Account | null;
  quotedTo?: Account | null;
  invoicedTo?: Account | null;
  typed?: string | null;
}) {
  return {
    id: 'order-14',
    propertyId: null,
    orderNumber: 'O-000014',
    customerId: 'renee',
    channel: 'b2b_portal',
    status: 'placed',
    paymentStatus: 'unpaid',
    total: '1240.00',
    currency: 'USD',
    placedAt: new Date('2026-10-02T15:00:00Z'),
    items: [{ name: 'Injector', sku: 'INJ-1' }],
    customer: {
      firstName: 'Renée',
      lastName: 'Castañeda',
      email: 'renee@wasatchfront.example',
      companyName: parts.typed ?? null,
      companyId: parts.pricing?.id ?? null,
      // What the Prisma client really hands back for `customer.company`: the
      // TYPED employer, computed, shadowing the relation (packages/db/src/client.ts).
      company: parts.typed ?? null,
    },
    convertedFromDocument: parts.quotedTo === undefined ? null : { company: parts.quotedTo },
    billingDocuments: parts.invoicedTo ? [{ company: parts.invoicedTo }] : [],
  };
}

async function project(parts: Parameters<typeof order>[0]) {
  row = order(parts);
  const { document } = await projectOrder({ tenantId: T }, 'order-14');
  return document;
}

describe('the account an order is found by', () => {
  it('is the buyer’s pricing account when nothing else is on record', async () => {
    const doc = await project({ pricing: WASATCH });
    expect(doc?.company).toBe(WASATCH.companyName);
    expect(doc?.b2b_account_id).toBe(WASATCH.id);
  });

  it('is the account it was quoted to, even after the buyer moved on', async () => {
    const doc = await project({ pricing: WASATCH, quotedTo: RED_ROCK, invoicedTo: WASATCH });
    expect(doc?.company).toBe(RED_ROCK.companyName);
    expect(doc?.b2b_account_id).toBe(RED_ROCK.id);
  });

  it('is the account it was invoiced to when it was never quoted', async () => {
    const doc = await project({ pricing: WASATCH, invoicedTo: RED_ROCK });
    expect(doc?.company).toBe(RED_ROCK.companyName);
  });

  it('names nothing when that account was removed, and borrows no other name', async () => {
    const doc = await project({ pricing: WASATCH, quotedTo: CLOSED, typed: 'Sole Trader' });
    expect(doc?.company).toBeUndefined();
    expect(doc?.b2b_account_id).toBe(CLOSED.id);
  });

  it('falls back to the employer the buyer typed when there is no account', async () => {
    const doc = await project({ typed: '  Sole Trader ' });
    expect(doc?.company).toBe('Sole Trader');
    expect(doc?.b2b_account_id).toBeUndefined();
  });

  it('is absent for a retail buyer with nothing typed', async () => {
    const doc = await project({});
    expect(doc?.company).toBeUndefined();
  });

  it('reads the pricing account by its id, never through the shadowed join', async () => {
    await project({ pricing: WASATCH });
    const include = findUnique.mock.calls.at(-1)?.[0].include ?? {};
    expect(include.customer).not.toHaveProperty('select.company');
    expect(findAccount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: WASATCH.id } })
    );
  });

  it('reads the quote and the first live invoice from the database', async () => {
    await project({ pricing: WASATCH });
    const include = findUnique.mock.calls.at(-1)?.[0].include ?? {};
    expect(include).toHaveProperty('convertedFromDocument');
    expect(include.billingDocuments).toMatchObject({
      where: { deletedAt: null, companyId: { not: null } },
      orderBy: { createdAt: 'asc' },
      take: 1,
    });
  });
});

describe('orderAccount', () => {
  it('takes the first candidate on record', () => {
    expect(orderAccount([null, undefined, RED_ROCK, WASATCH])).toEqual({
      id: RED_ROCK.id,
      name: RED_ROCK.companyName,
    });
  });

  it('is undefined with no candidates', () => {
    expect(orderAccount([null, undefined])).toBeUndefined();
  });

  it('keeps a removed winner’s id and drops its name', () => {
    expect(orderAccount([CLOSED, WASATCH])).toEqual({ id: CLOSED.id, name: undefined });
  });
});

describe('the account a customer is found by', () => {
  it('includes the account that prices them when they are on none of its lists', async () => {
    // The case the shadowed join hid: priced by Wasatch, not a contact on it.
    customerRow = {
      id: 'renee',
      firstName: 'Renée',
      lastName: 'Castañeda',
      email: 'renee@wasatchfront.example',
      phone: null,
      companyName: null,
      companyId: WASATCH.id,
      company: null,
      b2bContactRoles: [],
      propertyId: null,
      type: 'b2b',
      lifecycleStage: 'customer',
      leadStatus: null,
      tags: [],
      totalSpent: '0',
      orderCount: 0,
      lastOrderAt: null,
      createdAt: new Date('2026-09-01T00:00:00Z'),
    };
    const { document } = await projectCustomer({ tenantId: T }, 'renee');
    expect(document?.company).toBe(WASATCH.companyName);
    const include = findCustomer.mock.calls.at(-1)?.[0].include ?? {};
    expect(include).not.toHaveProperty('company');
  });
});
