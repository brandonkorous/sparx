// A person who hands their details over through the site is ANNOUNCED, and only
// once the row they were written into exists for everybody else.
//
// `captureLead` (a form on the site, a bootcamp RSVP, sparx's own CRM mirror)
// wrote the row and an audit line and published nothing. So the search worker,
// the groups and the scores never heard of the person, and the console's search
// box answered "Nothing in your records matches" about somebody sitting in the
// customer list (sparx persona issue 086).
//
// The second half is the timing. `captureLead` is composed INTO a caller's open
// transaction by the automation engine and by the bootcamp RSVP, and an event
// sent before that transaction commits reaches a worker that opens its own and
// finds no such customer, so it indexes nothing. `afterCommit` is the house rule.

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Row {
  id: string;
  tenantId: string;
  propertyId: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  companyName: string | null;
  tags: string[];
  metadata: unknown;
  deletedAt: Date | null;
  type: string;
}

let rows: Row[] = [];

const tx = {
  customer: {
    findFirst: ({ where }: { where: { email: string } }) =>
      Promise.resolve(rows.find((r) => r.email === where.email) ?? null),
    create: ({ data }: { data: Omit<Row, 'id' | 'deletedAt'> }) => {
      // The two money columns are Decimals in the real row; the audit diff
      // stringifies them.
      const row = {
        ...data,
        id: `c-${String(rows.length + 1)}`,
        deletedAt: null,
        totalSpent: 0,
        totalOrdered: 0,
      } as unknown as Row;
      rows.push(row);
      return Promise.resolve(row);
    },
    update: ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
      const row = rows.find((r) => r.id === where.id);
      if (!row) throw new Error('no row');
      Object.assign(row, data);
      return Promise.resolve(row);
    },
  },
};

// A stand-in for the commit queue in `@wizeworks/db`, with the same contract:
// work registered while a transaction is open waits for the one that OPENED it,
// and runs at once when none is open. Kept here because the package does not
// export its own queue, only `afterCommit`.
let queue: (() => Promise<void>)[] | null = null;

async function openTransaction<T>(run: () => Promise<T>): Promise<T> {
  queue = [];
  try {
    const result = await run();
    const committed = queue;
    queue = null;
    for (const task of committed) await task();
    return result;
  } finally {
    queue = null;
  }
}

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  afterCommit: async (_label: string, run: () => Promise<void>) => {
    if (queue) queue.push(run);
    else await run();
  },
  // A composed call runs on the caller's transaction and opens nothing.
  withTenant: (ctx: { tx?: unknown }, fn: (t: unknown) => Promise<unknown>) =>
    ctx.tx ? fn(ctx.tx) : openTransaction(() => fn(tx)),
}));
vi.mock('../audit', () => ({ writeAuditLog: () => Promise.resolve() }));

const { RecordingPublisher, setPublisher } = await import('../events');
const { captureLead } = await import('./customer-service');

const TENANT = '5944fe23-be83-4ce5-aafc-ef56b8594508';
const recorder = new RecordingPublisher();
setPublisher(recorder);

beforeEach(() => {
  rows = [];
  recorder.clear();
});

describe('a person handed over through the site', () => {
  it('is announced as captured, carrying who they are', async () => {
    const { customer, created } = await captureLead(
      { tenantId: TENANT },
      { email: 'marcus@example.test', name: 'Marcus Oyelaran-Pike', source: 'form' }
    );
    expect(created).toBe(true);
    expect(recorder.events.map((e) => e.topic)).toEqual(['crm.customer.captured']);
    expect(recorder.events[0]?.payload).toMatchObject({ customerId: customer.id });
  });

  it('is not announced until the transaction it was written in has committed', async () => {
    let seenInside = -1;
    await openTransaction(async () => {
      await captureLead(
        { tenantId: TENANT, tx: tx as never },
        { email: 'marcus@example.test', name: 'Marcus Oyelaran-Pike' }
      );
      seenInside = recorder.events.length;
    });
    expect(seenInside).toBe(0);
    expect(recorder.events.map((e) => e.topic)).toEqual(['crm.customer.captured']);
  });

  it('who was already known, and gave a detail we lacked, is announced as updated', async () => {
    await captureLead({ tenantId: TENANT }, { email: 'marcus@example.test' });
    recorder.clear();
    await captureLead(
      { tenantId: TENANT },
      { email: 'marcus@example.test', name: 'Marcus Oyelaran-Pike', phone: '555-0100' }
    );
    expect(recorder.events.map((e) => e.topic)).toEqual(['crm.customer.updated']);
  });

  it('who was already known, and told us nothing new, is not announced again', async () => {
    await captureLead({ tenantId: TENANT }, { email: 'marcus@example.test', name: 'Marcus' });
    recorder.clear();
    await captureLead({ tenantId: TENANT }, { email: 'marcus@example.test', name: 'Marcus' });
    expect(recorder.events).toEqual([]);
  });
});
