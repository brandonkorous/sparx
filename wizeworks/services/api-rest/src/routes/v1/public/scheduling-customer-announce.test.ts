// Somebody who books a slot through the website, and is new to the business, is
// announced, and only once the row exists for everybody else.
//
// The booking path wrote a lightweight customer record and stopped, so search,
// groups and scores never heard of the person: the appointment was on the
// calendar and the person who made it could not be found by name (sparx persona
// issue 086). The announcement is registered INSIDE the write and must wait for
// the commit, or the search worker looks for a row nobody can see yet.

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Row {
  id: string;
  email: string;
  propertyId: string | null;
}

let rows: Row[] = [];
let queue: (() => Promise<void>)[] | null = null;
const published: { topic: string; customerId: string; whileOpen: boolean }[] = [];

const tx = {
  customer: {
    findFirst: ({ where }: { where: { propertyId: string | null; email: { equals: string } } }) =>
      Promise.resolve(
        rows.find((r) => r.propertyId === where.propertyId && r.email === where.email.equals) ??
          null
      ),
    create: ({ data }: { data: Omit<Row, 'id'> }) => {
      const row = { ...data, id: `c-${String(rows.length + 1)}` };
      rows.push(row);
      return Promise.resolve({ id: row.id, type: 'retail', email: row.email });
    },
    update: ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
      const row = rows.find((r) => r.id === where.id);
      if (!row) throw new Error('no row');
      Object.assign(row, data);
      return Promise.resolve({ id: row.id, updatedAt: new Date() });
    },
  },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: async (_ctx: unknown, fn: (t: unknown) => Promise<unknown>) => {
    queue = [];
    const result = await fn(tx);
    const committed = queue;
    queue = null;
    for (const task of committed) await task();
    return result;
  },
}));
vi.mock('@wizeworks/crm', () => ({
  customerService: {
    // The real one hands this to `afterCommit`; this stand-in does the same
    // against the queue above, so "sent while the write was open" is visible.
    announceCustomer: (_tenantId: string, topic: string, customer: { id: string }) => {
      const send = () => {
        published.push({ topic, customerId: customer.id, whileOpen: queue !== null });
        return Promise.resolve();
      };
      if (queue) queue.push(send);
      else return send();
      return Promise.resolve();
    },
  },
}));

const { findOrCreateCustomer } = await import('./scheduling.js');

const TENANT = '5944fe23-be83-4ce5-aafc-ef56b8594508';
const SITE = '8af579c5-b6d1-4a46-a3a0-0d3d109b37b6';
const info = { name: 'Marcus Oyelaran-Pike', email: 'marcus@example.test' };

beforeEach(() => {
  rows = [];
  published.length = 0;
});

describe('a booking from the website', () => {
  it('announces a new person as captured, after the write commits', async () => {
    const id = await findOrCreateCustomer(TENANT, info, SITE);
    expect(published).toEqual([
      { topic: 'crm.customer.captured', customerId: id, whileOpen: false },
    ]);
  });

  it('announces a person who belonged to no site, now moved onto this one, as updated', async () => {
    rows = [{ id: 'known', email: info.email, propertyId: null }];
    await findOrCreateCustomer(TENANT, info, SITE);
    expect(published).toEqual([
      { topic: 'crm.customer.updated', customerId: 'known', whileOpen: false },
    ]);
  });

  it('says nothing about somebody already on this site', async () => {
    rows = [{ id: 'known', email: info.email, propertyId: SITE }];
    await findOrCreateCustomer(TENANT, info, SITE);
    expect(published).toEqual([]);
  });
});
