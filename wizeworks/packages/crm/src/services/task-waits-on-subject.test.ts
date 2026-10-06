// A TASK THE PLATFORM OPENS CLOSES ITSELF WHEN ITS REASON IS GONE.
//
// Measured on Gillett: "Set up prices and terms for Wasatch Front Utility
// Contractors, LLC" stayed open while Wasatch had the Fleet price tier, a
// $25,000 credit limit and Net 30. A task telling the owner to do something
// already done is false. The same shape on a deal ("Follow up" on a deal already
// won) and on an approved document ("take it to the next step" after it was).
//
// What this pins, through the real service with a recording transaction:
//
//   1. An account's set-up task closes, DONE, only once the account is set up by
//      the very rule the set-up automation opens it on, and the closing line
//      says what was set and by whom. Short of the rule, it stays open.
//   2. Only open tasks on THAT account that wait on its set-up close.
//   3. A deal task closes, as no longer needed, when the deal leaves the stage
//      type it was opened for, and not before.
//   4. A document task is done when the document is taken on (moved, turned into
//      an order) and no longer needed when it is voided or removed.
//   5. Opening one checks the subject under a row lock and opens NOTHING when
//      the reason has already gone.
//   6. The daily check closes, through the same closers, every task whose reason
//      went before anything called them, including a task waiting on an order:
//      three sign-off tasks on Gillett stayed open after their orders were
//      signed off or turned down, because the check knew every subject but that.

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface TaskRow {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  status: string;
  completedAt: Date | null;
  completedByUserId: string | null;
  assignedToUserId: string;
  createdByUserId: string;
  customerId: string | null;
  dealId: string | null;
  orderId: string | null;
  closesWhenOrderLeaves: string | null;
  companyId: string | null;
  closesWhenAccountSetUp: boolean;
  closesWhenDealLeaves: string | null;
  billingDocumentId: string | null;
  closesWhenDocumentLeaves: string | null;
  propertyId: string | null;
  dueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Account {
  companyName: string;
  paymentTerms: string | null;
  creditLimit: number;
  deletedAt: Date | null;
  pricingTierFk: { name: string; deletedAt: Date | null } | null;
}

interface DealRow {
  id: string;
  title: string;
  deletedAt: Date | null;
  stage: { name: string; stageType: string };
}

interface DocRow {
  number: string | null;
  stageId: string;
  voidedAt: Date | null;
  deletedAt: Date | null;
  convertedAt: Date | null;
  stage: { name: string; stageType: string };
  convertedOrder: { orderNumber: string } | null;
}

let tasks: TaskRow[];
let account: Account | null;
let deals: DealRow[];
let doc: DocRow | null;
let orders: { id: string; orderNumber: string; status: string }[];
let lockRows: Record<string, unknown>[];
let lockSql: string[];
let activity: { type: string; description: string; actorType: string }[];
let audit: { action: string; actorType: string }[];
let published: { topic: string; payload: Record<string, unknown> }[];

/** Just enough of Prisma's `where` for these reads: equality, `in`, `not: null`, `OR`. */
function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, want]) => {
    if (key === 'OR') {
      return (want as Record<string, unknown>[]).some((w) => matches(row, w));
    }
    const have = row[key];
    if (want && typeof want === 'object' && !Array.isArray(want)) {
      const op = want as { in?: unknown[]; not?: unknown };
      if (op.in) return op.in.includes(have);
      if ('not' in op) return have !== op.not;
    }
    return have === want;
  });
}

const tx = {
  task: {
    findMany: ({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(tasks.filter((t) => matches(t as never, where))),
    update: ({ where, data }: { where: { id: string }; data: Partial<TaskRow> }) => {
      tasks = tasks.map((t) => (t.id === where.id ? { ...t, ...data, updatedAt: new Date() } : t));
      return Promise.resolve(tasks.find((t) => t.id === where.id));
    },
    create: ({ data }: { data: Partial<TaskRow> }) => {
      const row = {
        id: `t-${String(tasks.length + 1)}`,
        status: 'open',
        completedAt: null,
        completedByUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      } as TaskRow;
      tasks.push(row);
      return Promise.resolve(row);
    },
  },
  company: {
    findUnique: () => Promise.resolve(account),
  },
  order: {
    findMany: ({ where }: { where: { id: { in: string[] } } }) =>
      Promise.resolve(orders.filter((o) => where.id.in.includes(o.id))),
  },
  deal: {
    findMany: ({ where }: { where: { id: { in: string[] } } }) =>
      Promise.resolve(deals.filter((d) => where.id.in.includes(d.id))),
    findUnique: () => Promise.resolve({ propertyId: 'site-gillett' }),
  },
  billingDocument: {
    findUnique: ({ select }: { select: Record<string, unknown> }) =>
      Promise.resolve(select.propertyId ? (doc ? { propertyId: 'site-gillett' } : null) : doc),
  },
  customer: { findUnique: () => Promise.resolve({ propertyId: 'site-gillett' }) },
  user: {
    findUnique: ({ where }: { where: { id: string } }) =>
      Promise.resolve(where.id === KIM ? { name: 'Kim Lee', email: 'kim@gillett.test' } : null),
  },
  tenantBusiness: { findFirst: () => Promise.resolve({ defaultCurrency: 'USD' }) },
  crmActivity: {
    create: ({ data }: { data: { type: string; description: string; actorType: string } }) => {
      activity.push(data);
      return Promise.resolve(data);
    },
  },
  auditLog: {
    create: ({ data }: { data: { action: string; actorType: string } }) => {
      audit.push(data);
      return Promise.resolve(data);
    },
  },
  $queryRaw: (strings: TemplateStringsArray) => {
    lockSql.push(strings.join('?'));
    return Promise.resolve(lockRows);
  },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('../events', () => ({
  publishCrmEvent: (event: { topic: string; payload: Record<string, unknown> }) => {
    published.push(event);
    return Promise.resolve();
  },
}));

const {
  closeTasksWhoseReasonIsGone,
  closeWhenAccountSetUp,
  closeWhenDealMovesOn,
  closeWhenDocumentMovesOn,
  createWhileAccountNeedsSetUp,
  createWhileDealIs,
  createWhileDocumentIsAt,
} = await import('./task-service.js');

const TENANT = 'tenant-gillett';
const KIM = 'u-kim';
const WASATCH = 'co-wasatch';
const SET_UP = 'Set up prices and terms for Wasatch Front Utility Contractors, LLC';
const APPROVED_STAGE = 'stage-approved';

function task(over: Partial<TaskRow>): TaskRow {
  return {
    id: 't-set-up',
    tenantId: TENANT,
    title: SET_UP,
    description: null,
    status: 'open',
    completedAt: null,
    completedByUserId: null,
    assignedToUserId: KIM,
    createdByUserId: KIM,
    customerId: 'c-dana',
    dealId: null,
    orderId: null,
    closesWhenOrderLeaves: null,
    companyId: WASATCH,
    closesWhenAccountSetUp: true,
    closesWhenDealLeaves: null,
    billingDocumentId: null,
    closesWhenDocumentLeaves: null,
    propertyId: null,
    dueAt: null,
    createdAt: new Date('2026-10-02T16:50:41Z'),
    updatedAt: new Date('2026-10-02T16:50:41Z'),
    ...over,
  };
}

const SET_UP_ACCOUNT: Account = {
  companyName: 'Wasatch Front Utility Contractors, LLC',
  paymentTerms: 'net30',
  creditLimit: 25000,
  deletedAt: null,
  pricingTierFk: { name: 'Fleet', deletedAt: null },
};

beforeEach(() => {
  tasks = [];
  account = { ...SET_UP_ACCOUNT };
  deals = [];
  doc = null;
  orders = [];
  lockRows = [];
  lockSql = [];
  activity = [];
  audit = [];
  published = [];
});

const status = (): Record<string, string> => Object.fromEntries(tasks.map((t) => [t.id, t.status]));

describe('an account set-up task', () => {
  beforeEach(() => {
    tasks = [
      task({}),
      // Another account's.
      task({ id: 't-other-account', companyId: 'co-red-rock' }),
      // About this account, but only a person closes it.
      task({ id: 't-plain', closesWhenAccountSetUp: false, title: 'Call Dana about the fleet' }),
      // Already done by hand.
      task({ id: 't-done', status: 'completed' }),
    ];
  });

  it('closes, done, once the account is set up, saying what was set and by whom', async () => {
    const closed = await closeWhenAccountSetUp(
      tx as never,
      { tenantId: TENANT },
      { companyId: WASATCH, byUserId: KIM }
    );
    expect(closed.map((t) => t.id)).toEqual(['t-set-up']);
    expect(status()).toEqual({
      't-set-up': 'completed',
      't-other-account': 'open',
      't-plain': 'open',
      't-done': 'completed',
    });
    const done = tasks.find((t) => t.id === 't-set-up')!;
    expect(done.title).toBe(SET_UP);
    expect(done.completedByUserId).toBe(KIM);
    expect(done.description).toBe(
      'Kim Lee set up Wasatch Front Utility Contractors, LLC: the Fleet price tier, pay within 30 days, and a $25,000.00 credit limit.'
    );
    expect(activity).toEqual([
      expect.objectContaining({ type: 'task.completed', actorType: 'staff' }),
    ]);
    expect(audit).toEqual([
      expect.objectContaining({ action: 'crm.task.completed', actorType: 'user' }),
    ]);
    expect(published).toEqual([
      expect.objectContaining({
        topic: 'crm.task.completed',
        payload: { taskId: 't-set-up', completedByUserId: KIM },
      }),
    ]);
  });

  it('stays open while the account is on terms with nothing to order against', async () => {
    account = { ...SET_UP_ACCOUNT, creditLimit: 0 };
    expect(
      await closeWhenAccountSetUp(tx as never, { tenantId: TENANT }, { companyId: WASATCH })
    ).toEqual([]);
    expect(status()['t-set-up']).toBe('open');
  });

  it('stays open while no terms have been chosen, whatever the limit', async () => {
    account = { ...SET_UP_ACCOUNT, paymentTerms: null };
    expect(
      await closeWhenAccountSetUp(tx as never, { tenantId: TENANT }, { companyId: WASATCH })
    ).toEqual([]);
    expect(status()['t-set-up']).toBe('open');
  });

  it('closes for an account that pays before it ships, with no limit to mention', async () => {
    account = { ...SET_UP_ACCOUNT, paymentTerms: 'prepay', creditLimit: 0 };
    await closeWhenAccountSetUp(
      tx as never,
      { tenantId: TENANT },
      { companyId: WASATCH, byUserId: KIM }
    );
    expect(tasks.find((t) => t.id === 't-set-up')?.description).toBe(
      'Kim Lee set up Wasatch Front Utility Contractors, LLC: the Fleet price tier and pay before it ships.'
    );
  });

  it('names normal prices when the tier it points at was removed', async () => {
    account = { ...SET_UP_ACCOUNT, pricingTierFk: { name: 'Fleet', deletedAt: new Date() } };
    await closeWhenAccountSetUp(
      tx as never,
      { tenantId: TENANT },
      { companyId: WASATCH, byUserId: KIM }
    );
    expect(tasks.find((t) => t.id === 't-set-up')?.description).toBe(
      'Kim Lee set up Wasatch Front Utility Contractors, LLC: normal prices, pay within 30 days, and a $25,000.00 credit limit.'
    );
  });

  it('says what was set without a name when nobody on the team is behind it', async () => {
    await closeWhenAccountSetUp(tx as never, { tenantId: TENANT }, { companyId: WASATCH });
    const done = tasks.find((t) => t.id === 't-set-up')!;
    expect(done.description).toBe(
      'Wasatch Front Utility Contractors, LLC is set up: the Fleet price tier, pay within 30 days, and a $25,000.00 credit limit.'
    );
    expect(done.completedByUserId).toBeNull();
    expect(activity[0]).toMatchObject({ actorType: 'system' });
  });

  it('closes as no longer needed when the account is removed', async () => {
    account = { ...SET_UP_ACCOUNT, paymentTerms: null, deletedAt: new Date() };
    await closeWhenAccountSetUp(
      tx as never,
      { tenantId: TENANT },
      { companyId: WASATCH, byUserId: KIM }
    );
    expect(tasks.find((t) => t.id === 't-set-up')).toMatchObject({
      status: 'cancelled',
      completedByUserId: null,
      description:
        'Kim Lee removed Wasatch Front Utility Contractors, LLC, so there is nothing left to set up.',
    });
    // Not done, so no `crm.task.completed`; but closed, so the search box and
    // anything else mirroring the task has to hear that it is no longer open.
    expect(published.map((e) => [e.topic, e.payload])).toEqual([
      ['crm.task.updated', { taskId: 't-set-up', reason: 'closed', status: 'cancelled' }],
    ]);
  });
});

describe('opening an account set-up task', () => {
  const COMPANY = '8aa59a36-acc9-455f-b0ba-41c0b66292b9';
  const KIM_ID = '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a';
  const input = { title: SET_UP, assignedToUserId: KIM_ID, companyId: COMPANY };

  it('opens it, marked and linked, while the account still needs setting up', async () => {
    lockRows = [{ payment_terms: null, credit_limit: 0 }];
    const opened = await createWhileAccountNeedsSetUp({ tenantId: TENANT, userId: KIM_ID }, input);
    expect(opened).toMatchObject({ companyId: COMPANY, closesWhenAccountSetUp: true });
    // Read under a lock, so a save cannot slip in between the check and the task.
    expect(lockSql.join('')).toMatch(/FOR SHARE/);
  });

  it('opens nothing once the account is already set up', async () => {
    lockRows = [{ payment_terms: 'net30', credit_limit: 25000 }];
    expect(
      await createWhileAccountNeedsSetUp({ tenantId: TENANT, userId: KIM_ID }, input)
    ).toBeNull();
    expect(tasks).toEqual([]);
  });

  it('refuses without an account to wait on', async () => {
    await expect(
      createWhileAccountNeedsSetUp(
        { tenantId: TENANT, userId: KIM_ID },
        { ...input, companyId: undefined }
      )
    ).rejects.toThrow('needs the account');
  });
});

describe('a task about a deal', () => {
  beforeEach(() => {
    tasks = [
      task({
        id: 't-follow-up',
        title: 'Follow up: Harbor fit-out',
        companyId: null,
        closesWhenAccountSetUp: false,
        dealId: 'd-harbor',
        closesWhenDealLeaves: 'open',
      }),
      task({
        id: 't-invoice',
        title: 'Create invoice: Harbor fit-out',
        companyId: null,
        closesWhenAccountSetUp: false,
        dealId: 'd-harbor',
        closesWhenDealLeaves: 'won',
      }),
    ];
  });

  it('closes the follow-up, as no longer needed, when the deal is won', async () => {
    deals = [
      {
        id: 'd-harbor',
        title: 'Harbor fit-out',
        deletedAt: null,
        stage: { name: 'Closed won', stageType: 'won' },
      },
    ];
    await closeWhenDealMovesOn(
      tx as never,
      { tenantId: TENANT },
      { dealIds: ['d-harbor'], byUserId: KIM }
    );
    expect(status()).toEqual({ 't-follow-up': 'cancelled', 't-invoice': 'open' });
    expect(tasks[0]?.description).toBe(
      'Kim Lee moved the deal “Harbor fit-out” to Closed won, so this no longer needs doing.'
    );
  });

  it('leaves both alone while the deal moves between open stages', async () => {
    deals = [
      {
        id: 'd-harbor',
        title: 'Harbor fit-out',
        deletedAt: null,
        stage: { name: 'Proposal', stageType: 'open' },
      },
    ];
    await closeWhenDealMovesOn(tx as never, { tenantId: TENANT }, { dealIds: ['d-harbor'] });
    // The invoice task waits on `won`, and the deal is open: closed. The
    // follow-up waits on `open`: still open.
    expect(status()).toEqual({ 't-follow-up': 'open', 't-invoice': 'cancelled' });
    expect(tasks[1]?.description).toBe(
      'The deal “Harbor fit-out” is now in Proposal, so this no longer needs doing.'
    );
  });

  it('closes both when the deal is removed', async () => {
    deals = [
      {
        id: 'd-harbor',
        title: 'Harbor fit-out',
        deletedAt: new Date(),
        stage: { name: 'Proposal', stageType: 'open' },
      },
    ];
    await closeWhenDealMovesOn(
      tx as never,
      { tenantId: TENANT },
      { dealIds: ['d-harbor'], byUserId: KIM }
    );
    expect(status()).toEqual({ 't-follow-up': 'cancelled', 't-invoice': 'cancelled' });
  });

  it('opens only while the deal is in the stage type it is for', async () => {
    tasks = [];
    const DEAL = '6f1c2a90-3b4d-4e5f-8a6b-7c8d9e0f1a2b';
    const KIM_ID = '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a';
    const input = { title: 'Follow up: Harbor fit-out', assignedToUserId: KIM_ID, dealId: DEAL };
    lockRows = [{ stage_type: 'open' }];
    expect(
      await createWhileDealIs({ tenantId: TENANT, userId: KIM_ID }, input, 'open')
    ).toMatchObject({ dealId: DEAL, closesWhenDealLeaves: 'open' });
    expect(lockSql.join('')).toMatch(/FOR SHARE/);
    lockRows = [{ stage_type: 'won' }];
    expect(await createWhileDealIs({ tenantId: TENANT, userId: KIM_ID }, input, 'open')).toBeNull();
    expect(tasks).toHaveLength(1);
  });
});

describe('a task about an approved document', () => {
  beforeEach(() => {
    tasks = [
      task({
        id: 't-next-step',
        title: 'EST-000123 was approved: take it to the next step',
        companyId: null,
        closesWhenAccountSetUp: false,
        billingDocumentId: 'doc-123',
        closesWhenDocumentLeaves: APPROVED_STAGE,
      }),
    ];
  });
  const at = (over: Partial<DocRow>): DocRow => ({
    number: 'EST-000123',
    stageId: APPROVED_STAGE,
    voidedAt: null,
    deletedAt: null,
    convertedAt: null,
    stage: { name: 'Approved', stageType: 'committed' },
    convertedOrder: null,
    ...over,
  });
  const close = (byUserId: string | null = KIM) =>
    closeWhenDocumentMovesOn(
      tx as never,
      { tenantId: TENANT },
      { documentId: 'doc-123', byUserId }
    );

  it('stays open while the document sits where it was approved', async () => {
    doc = at({});
    expect(await close()).toEqual([]);
  });

  it('is done once the document is taken to the next stage', async () => {
    doc = at({ stageId: 'stage-invoiced', stage: { name: 'Invoiced', stageType: 'final' } });
    await close();
    expect(tasks[0]).toMatchObject({
      status: 'completed',
      completedByUserId: KIM,
      description: 'Kim Lee moved EST-000123 to Invoiced.',
    });
  });

  it('is done once the document is turned into an order', async () => {
    doc = at({ convertedAt: new Date(), convertedOrder: { orderNumber: 'O-000031' } });
    await close();
    expect(tasks[0]).toMatchObject({
      status: 'completed',
      description: 'Kim Lee turned EST-000123 into order O-000031.',
    });
  });

  it('is no longer needed once the document is voided', async () => {
    doc = at({ voidedAt: new Date() });
    await close(null);
    expect(tasks[0]).toMatchObject({
      status: 'cancelled',
      description: 'EST-000123 was voided, so this no longer needs doing.',
    });
  });

  it('opens only while the document is still at that stage', async () => {
    tasks = [];
    const DOC = '1a2b3c4d-5e6f-4a1b-9c2d-3e4f5a6b7c8d';
    const STAGE = '2b3c4d5e-6f7a-4b2c-8d3e-4f5a6b7c8d9e';
    const KIM_ID = '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a';
    doc = at({});
    const input = { title: 'x', assignedToUserId: KIM_ID, billingDocumentId: DOC };
    lockRows = [{ stage_id: STAGE, settled: false }];
    expect(
      await createWhileDocumentIsAt({ tenantId: TENANT, userId: KIM_ID }, input, STAGE)
    ).toMatchObject({ billingDocumentId: DOC, closesWhenDocumentLeaves: STAGE });
    lockRows = [{ stage_id: STAGE, settled: true }];
    expect(
      await createWhileDocumentIsAt({ tenantId: TENANT, userId: KIM_ID }, input, STAGE)
    ).toBeNull();
    lockRows = [{ stage_id: 'stage-elsewhere', settled: false }];
    expect(
      await createWhileDocumentIsAt({ tenantId: TENANT, userId: KIM_ID }, input, STAGE)
    ).toBeNull();
    expect(tasks).toHaveLength(1);
  });
});

describe('the daily check', () => {
  it('closes every task whose reason has gone, through the same closers', async () => {
    tasks = [
      task({}),
      task({
        id: 't-follow-up',
        companyId: null,
        closesWhenAccountSetUp: false,
        dealId: 'd-harbor',
        closesWhenDealLeaves: 'open',
      }),
      // Its account was deleted outright and the link went with it.
      task({ id: 't-orphan', companyId: null }),
      // Only a person closes this one.
      task({ id: 't-plain', closesWhenAccountSetUp: false }),
    ];
    deals = [
      {
        id: 'd-harbor',
        title: 'Harbor fit-out',
        deletedAt: null,
        stage: { name: 'Lost', stageType: 'lost' },
      },
    ];
    expect(await closeTasksWhoseReasonIsGone({ tenantId: TENANT })).toBe(3);
    expect(status()).toEqual({
      't-set-up': 'completed',
      't-follow-up': 'cancelled',
      't-orphan': 'cancelled',
      't-plain': 'open',
    });
  });

  it('leaves alone an account that is still waiting to be set up', async () => {
    tasks = [task({})];
    account = { ...SET_UP_ACCOUNT, creditLimit: 0 };
    expect(await closeTasksWhoseReasonIsGone({ tenantId: TENANT })).toBe(0);
    expect(status()).toEqual({ 't-set-up': 'open' });
  });

  it('closes a sign-off task whose order was answered before anything called it', async () => {
    const signOff = (id: string, orderId: string | null) =>
      task({
        id,
        title: `Order ${id} is waiting for your sign-off`,
        companyId: null,
        closesWhenAccountSetUp: false,
        orderId,
        closesWhenOrderLeaves: 'pending_approval',
      });
    tasks = [
      signOff('t-signed', 'o-12'),
      signOff('t-turned-down', 'o-13'),
      signOff('t-still-waiting', 'o-15'),
      // Its order was deleted outright and the link went with it.
      signOff('t-order-gone', null),
    ];
    orders = [
      { id: 'o-12', orderNumber: 'O-000012', status: 'placed' },
      { id: 'o-13', orderNumber: 'O-000013', status: 'cancelled' },
      { id: 'o-15', orderNumber: 'O-000015', status: 'pending_approval' },
    ];
    expect(await closeTasksWhoseReasonIsGone({ tenantId: TENANT })).toBe(3);
    expect(status()).toEqual({
      't-signed': 'completed',
      't-turned-down': 'cancelled',
      't-still-waiting': 'open',
      't-order-gone': 'cancelled',
    });
    const said = (id: string) => tasks.find((t) => t.id === id)?.description;
    expect(said('t-signed')).toBe('Order O-000012 was signed off and placed.');
    expect(said('t-turned-down')).toBe(
      'Order O-000013 was canceled, so there is nothing left to do here.'
    );
  });
});
