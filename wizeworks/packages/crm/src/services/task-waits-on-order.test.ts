// A TASK THAT WAITS ON AN ORDER CLOSES WHEN THE ORDER MOVES ON.
//
// When a wholesale order is held for sign-off, a system automation opens a task
// for the business: "Order O-000014 from Renee Castaneda is waiting for your
// sign-off: approve or reject it under Approvals". Measured on the development
// database: the account's own approver approved O-000014 on the site, the order
// was placed, and the task stayed `open`. Same when the business approved or
// rejected it from the console or over MCP. A task telling the owner to do
// something already done is false.
//
// What this pins, through the real service with a recording transaction:
//
//   1. Closing touches only OPEN tasks on THIS order that wait on the status it
//      left. A task on another order, a task waiting on another status, a plain
//      task about the order, and one already done are all left alone.
//   2. The task keeps its own words and gains the sentence saying who closed it.
//      Done means done by the person named; cancelled carries no "done by".
//   3. The customer's timeline and the audit log hear about it, and
//      `crm.task.completed` is announced for a done task (after the commit).
//   4. Opening one checks the order under a row lock, and opens NOTHING when
//      the order has already moved on: the automation runs after the event, and
//      a decision in between would otherwise leave a task nothing closes.

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface TaskRow {
  id: string;
  tenantId: string;
  orderId: string | null;
  closesWhenOrderLeaves: string | null;
  customerId: string | null;
  dealId: string | null;
  title: string;
  description: string | null;
  status: string;
  completedAt: Date | null;
  completedByUserId: string | null;
  assignedToUserId: string;
  createdByUserId: string;
  propertyId: string | null;
  dueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

let tasks: TaskRow[];
let activity: { type: string; description: string; actorType: string }[];
let audit: { action: string; actorType: string }[];
let published: { topic: string; payload: Record<string, unknown> }[];
let orderStatus: string | null;
let lockSql: string[];

const tx = {
  task: {
    findUnique: ({ where }: { where: { id: string } }) =>
      Promise.resolve(tasks.find((t) => t.id === where.id) ?? null),
    findMany: ({ where }: { where: Partial<TaskRow> }) =>
      Promise.resolve(
        tasks.filter((t) => Object.entries(where).every(([k, v]) => t[k as keyof TaskRow] === v))
      ),
    update: ({ where, data }: { where: { id: string }; data: Partial<TaskRow> }) => {
      tasks = tasks.map((t) => (t.id === where.id ? { ...t, ...data, updatedAt: new Date() } : t));
      return Promise.resolve(tasks.find((t) => t.id === where.id));
    },
    create: ({ data }: { data: Partial<TaskRow> }) => {
      const row = {
        id: `t-${tasks.length + 1}`,
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
  order: {
    findUnique: () => Promise.resolve(orderStatus ? { propertyId: 'site-gillett' } : null),
  },
  customer: { findUnique: () => Promise.resolve({ propertyId: 'site-gillett' }) },
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
    return Promise.resolve(orderStatus ? [{ status: orderStatus }] : []);
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

const { closeWhenOrderMovesOn, createWhileOrderIs, update } = await import('./task-service.js');

const TENANT = 'tenant-gillett';
const DOTY = 'u-doty';
const SIGN_OFF_TITLE =
  'Order O-000014 from Renée Castañeda is waiting for your sign-off: approve or reject it under Approvals';

function task(over: Partial<TaskRow>): TaskRow {
  return {
    id: 't-sign-off',
    tenantId: TENANT,
    orderId: 'o-14',
    closesWhenOrderLeaves: 'pending_approval',
    customerId: 'c-renee',
    dealId: null,
    title: SIGN_OFF_TITLE,
    description: null,
    status: 'open',
    completedAt: null,
    completedByUserId: null,
    assignedToUserId: DOTY,
    createdByUserId: DOTY,
    propertyId: 'site-gillett',
    dueAt: null,
    createdAt: new Date('2026-10-03T15:00:00Z'),
    updatedAt: new Date('2026-10-03T15:00:00Z'),
    ...over,
  };
}

beforeEach(() => {
  tasks = [
    task({}),
    // On another order.
    task({ id: 't-other-order', orderId: 'o-15' }),
    // About this order, but waiting for something else.
    task({ id: 't-other-status', closesWhenOrderLeaves: 'placed' }),
    // About this order, and only a person closes it.
    task({ id: 't-plain', closesWhenOrderLeaves: null, title: 'Call Renée about delivery' }),
    // Already done by hand.
    task({ id: 't-done', status: 'completed' }),
  ];
  activity = [];
  audit = [];
  published = [];
  orderStatus = 'pending_approval';
  lockSql = [];
});

const APPROVED =
  "Teodora Vukić-Hale, who approves orders for the customer's account, approved it on your site, and the order was placed.";

describe('closing the tasks an order was waiting on', () => {
  it('closes only the open task on this order that waits on the status it left', async () => {
    const closed = await closeWhenOrderMovesOn(
      tx as never,
      { tenantId: TENANT },
      {
        orderId: 'o-14',
        left: 'pending_approval',
        as: 'completed',
        because: APPROVED,
      }
    );
    expect(closed.map((t) => t.id)).toEqual(['t-sign-off']);
    const byId = Object.fromEntries(tasks.map((t) => [t.id, t.status]));
    expect(byId).toEqual({
      't-sign-off': 'completed',
      't-other-order': 'open',
      't-other-status': 'open',
      't-plain': 'open',
      't-done': 'completed',
    });
  });

  it('keeps the task’s own words and adds who closed it', async () => {
    tasks[0] = task({ description: 'Over the $1,000.00 limit.' });
    await closeWhenOrderMovesOn(
      tx as never,
      { tenantId: TENANT },
      {
        orderId: 'o-14',
        left: 'pending_approval',
        as: 'completed',
        because: APPROVED,
      }
    );
    const closed = tasks.find((t) => t.id === 't-sign-off')!;
    expect(closed.title).toBe(SIGN_OFF_TITLE);
    expect(closed.description).toBe(`Over the $1,000.00 limit.\n\n${APPROVED}`);
    expect(closed.completedAt).toBeInstanceOf(Date);
    // A customer at the account signed, not anyone on the team.
    expect(closed.completedByUserId).toBeNull();
  });

  it('records the teammate who did it', async () => {
    await closeWhenOrderMovesOn(
      tx as never,
      { tenantId: TENANT },
      {
        orderId: 'o-14',
        left: 'pending_approval',
        as: 'completed',
        because: 'Doty Brown signed it off, and the order was placed.',
        byUserId: DOTY,
      }
    );
    expect(tasks.find((t) => t.id === 't-sign-off')).toMatchObject({
      status: 'completed',
      completedByUserId: DOTY,
      description: 'Doty Brown signed it off, and the order was placed.',
    });
    expect(activity).toEqual([
      expect.objectContaining({
        type: 'task.completed',
        actorType: 'staff',
        description: `Task done: ${SIGN_OFF_TITLE}. Doty Brown signed it off, and the order was placed.`,
      }),
    ]);
    expect(audit).toEqual([
      expect.objectContaining({ action: 'crm.task.completed', actorType: 'user' }),
    ]);
    expect(published).toEqual([
      expect.objectContaining({
        topic: 'crm.task.completed',
        payload: { taskId: 't-sign-off', completedByUserId: DOTY },
      }),
    ]);
  });

  it('cancels, rather than completes, a task whose order went away', async () => {
    await closeWhenOrderMovesOn(
      tx as never,
      { tenantId: TENANT },
      {
        orderId: 'o-14',
        left: 'pending_approval',
        as: 'cancelled',
        because: 'Order O-000014 was canceled by Doty Brown, so there is nothing left to do here.',
        byUserId: DOTY,
      }
    );
    expect(tasks.find((t) => t.id === 't-sign-off')).toMatchObject({
      status: 'cancelled',
      completedAt: null,
      completedByUserId: null,
    });
    expect(activity[0]).toMatchObject({ type: 'task.cancelled' });
    // Not done, so no `crm.task.completed`; but no longer open either. The
    // search box listed this very task as open after O-000013 was turned down.
    expect(published.map((e) => [e.topic, e.payload])).toEqual([
      ['crm.task.updated', { taskId: 't-sign-off', reason: 'closed', status: 'cancelled' }],
    ]);
  });

  it('does nothing when nothing waits', async () => {
    const closed = await closeWhenOrderMovesOn(
      tx as never,
      { tenantId: TENANT },
      {
        orderId: 'o-99',
        left: 'pending_approval',
        as: 'completed',
        because: 'x',
      }
    );
    expect(closed).toEqual([]);
    expect(activity).toEqual([]);
    expect(audit).toEqual([]);
  });
});

describe('opening a task that waits on an order', () => {
  // Real ids: the input is validated as it is for every caller.
  const ORDER = '6f1c2a90-3b4d-4e5f-8a6b-7c8d9e0f1a2b';
  const RENEE = '1a2b3c4d-5e6f-4a1b-9c2d-3e4f5a6b7c8d';
  const DOTY_ID = '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a';
  const input = {
    title: SIGN_OFF_TITLE,
    assignedToUserId: DOTY_ID,
    customerId: RENEE,
    orderId: ORDER,
  };

  it('opens it, marked, while the order still waits', async () => {
    tasks = [];
    const opened = await createWhileOrderIs(
      { tenantId: TENANT, userId: DOTY_ID },
      input,
      'pending_approval'
    );
    expect(opened).toMatchObject({
      orderId: ORDER,
      closesWhenOrderLeaves: 'pending_approval',
      propertyId: 'site-gillett',
    });
    // The order is read under a lock, so a decision cannot slip in between.
    expect(lockSql.join('')).toMatch(/FOR SHARE/);
  });

  it('opens nothing once the order has been decided', async () => {
    tasks = [];
    orderStatus = 'placed';
    const opened = await createWhileOrderIs(
      { tenantId: TENANT, userId: DOTY_ID },
      input,
      'pending_approval'
    );
    expect(opened).toBeNull();
    expect(tasks).toEqual([]);
  });

  it('refuses without an order to wait on', async () => {
    await expect(
      createWhileOrderIs(
        { tenantId: TENANT, userId: DOTY_ID },
        { ...input, orderId: undefined },
        'pending_approval'
      )
    ).rejects.toThrow('needs the order');
  });
});

describe('a task edited by hand', () => {
  it('says it changed, so the search box shows the new words', async () => {
    tasks = [task({})];
    await update({ tenantId: TENANT, userId: DOTY }, 't-sign-off', {
      title: 'Call Renée about O-000014 before signing it',
    });
    expect(tasks[0]?.title).toBe('Call Renée about O-000014 before signing it');
    expect(published.map((e) => [e.topic, e.payload])).toEqual([
      ['crm.task.updated', { taskId: 't-sign-off', reason: 'edited', status: 'open' }],
    ]);
  });
});
