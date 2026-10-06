// Changing who is on a trade account tells search, and so does removing one.
//
// A customer's search document names every trade account they are an active
// contact on, so typing the account's name finds its people. A contact row is
// not the customer row, so nothing announced a membership change: on Gillett
// Diesel Service (2026-10-03) a viewer added on the account's screen, and a
// contact switched back on there, were never re-read, and typing "Wasatch" did
// not find them. Removing an account announced nothing either, so it went on
// being found by name, and so did its people.
//
// These hold each write to its signal, AFTER the transaction has run.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ACCOUNT = '8aa59a36-acc9-455f-b0ba-41c0b66292b9';
const CUSTOMER = '72c35937-9a06-45b2-8cc3-a5a4547920c3';
const CONTACT = '3f0b8f16-0f43-4d1a-9a2c-5f61f3b0a001';
const TENANT = '5944fe23-be83-4ce5-aafc-ef56b8594508';
const ctx = { tenantId: TENANT, userId: '7c1d2c55-0c3e-4a8b-9d55-2f0e6e1f0b11' };

const order: string[] = [];
const indexEntity = vi.fn((input: unknown) => {
  order.push(`index:${JSON.stringify(input)}`);
  return Promise.resolve();
});

const contactRow = {
  id: CONTACT,
  tenantId: TENANT,
  accountId: ACCOUNT,
  customerId: CUSTOMER,
  role: 'viewer',
  isActive: true,
};

const tx = {
  company: {
    findUnique: vi.fn(() => Promise.resolve({ id: ACCOUNT, deletedAt: null })),
    update: vi.fn(() => Promise.resolve({ id: ACCOUNT, deletedAt: new Date() })),
  },
  customer: {
    findUnique: vi.fn(() =>
      Promise.resolve({ id: CUSTOMER, deletedAt: null, companyId: ACCOUNT, type: 'b2b' })
    ),
    update: vi.fn(),
    updateMany: vi.fn(() => Promise.resolve({ count: 0 })),
  },
  b2bAccountContact: {
    findFirst: vi.fn(() => Promise.resolve(null)),
    findUnique: vi.fn(() => Promise.resolve({ ...contactRow, isActive: false })),
    create: vi.fn(() => Promise.resolve(contactRow)),
    update: vi.fn(() => Promise.resolve({ ...contactRow, customer: { id: CUSTOMER } })),
    findUniqueOrThrow: vi.fn(() => Promise.resolve({ ...contactRow, customer: { id: CUSTOMER } })),
  },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: async (_ctx: unknown, fn: (t: unknown) => unknown) => {
    order.push('transaction');
    const result = await fn(tx);
    order.push('committed');
    return result;
  },
}));
vi.mock('@wizeworks/events', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  indexEntity,
}));
vi.mock('../audit', () => ({ writeAuditLog: vi.fn(() => Promise.resolve()) }));
// Removing an account also closes its setup tasks, inside the same transaction.
// That is not what this file is about, and the fake transaction holds no tasks.
vi.mock('./task-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  closeWhenAccountSetUp: vi.fn(() => Promise.resolve()),
}));

const contacts = await import('./b2b-account-contact-service');
const companies = await import('./company-service');

const customerSignal = {
  tenantId: TENANT,
  actorId: ctx.userId,
  entityType: 'customer',
  recordId: CUSTOMER,
};

beforeEach(() => {
  order.length = 0;
  indexEntity.mockClear();
});

describe('a contact added to an account', () => {
  it('re-indexes that customer once the row is saved', async () => {
    await contacts.create(ctx, ACCOUNT, { customerId: CUSTOMER, role: 'viewer' });
    expect(indexEntity).toHaveBeenCalledWith(customerSignal);
    expect(order).toEqual(['transaction', 'committed', `index:${JSON.stringify(customerSignal)}`]);
  });
});

describe('a contact switched on or off', () => {
  it('re-indexes that customer once the row is saved', async () => {
    await contacts.update(ctx, ACCOUNT, CONTACT, { isActive: true });
    expect(indexEntity).toHaveBeenCalledWith(customerSignal);
    expect(order.at(-1)).toBe(`index:${JSON.stringify(customerSignal)}`);
    expect(order.indexOf('committed')).toBeLessThan(order.length - 1);
  });
});

describe('an account removed', () => {
  it('re-indexes the account, which takes its people with it', async () => {
    await companies.softDelete(ctx, ACCOUNT);
    const signal = {
      tenantId: TENANT,
      actorId: ctx.userId,
      entityType: 'b2b_account',
      recordId: ACCOUNT,
    };
    expect(indexEntity).toHaveBeenCalledWith(signal);
    expect(order).toEqual(['transaction', 'committed', `index:${JSON.stringify(signal)}`]);
  });
});
