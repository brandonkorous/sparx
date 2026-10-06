// The account's own approver signs off its held orders (sparx persona issue 087).
//
// Wasatch Front had three people on its account at Gillett Diesel Service:
// Renée, who places orders, Teodora, whose role read "Can approve orders", and
// Marcus, who can only look. Renée's $1,208.00 order went over a $1,000.00
// limit and was held, and it went to Gillett's own team: Teodora was never
// asked and had nothing to press. What this pins, through the real service:
//
//   1. A limit the account signs is Teodora's to approve, and approving it
//      places the order. Gillett's Approve is refused with who it waits on.
//   2. When the business has to sign too (over the credit limit), Teodora's
//      yes keeps the order waiting for the business, and the business's yes
//      then places it.
//   3. Only an approver signs for the account, never on their own order, and
//      only when the rule asks the account.
//   4. Turning it down cancels it and carries who said no and why.
//   5. The card that paid for it: held at checkout, it is charged when the
//      last yes places the order, and let go when it is turned down. One that
//      was charged at checkout (a gateway that cannot hold) is refunded in full.
//      It used to be charged at checkout and kept when the order was turned
//      down.
//   6. An order already paid while it waited (a gateway that charges on its
//      own page cannot hold the card) is announced as paid by the yes that
//      places it, once. The payment webhook kept quiet while it waited.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('@wizeworks/auth', () => ({ isModuleEnabled: () => Promise.resolve(false) }));
// The stock a held order kept while it waited, let go when it is turned down.
const releaseOrderHolds = vi.hoisted(() => vi.fn((..._args: unknown[]) => Promise.resolve(0)));
vi.mock('@wizeworks/inventory', () => ({
  inventoryService: { releaseOrderHoldsOnTx: releaseOrderHolds },
}));

const { approveOrder, approveOrderForAccount, rejectOrder, rejectOrderForAccount } =
  await import('./approval.js');

const TENANT = 'tenant-gillett';
const ACCOUNT = 'acct-wasatch';
const RENEE = 'c-renee';
const TEODORA = 'c-teodora';
const MARCUS = 'c-marcus';
const DOTY = 'u-doty';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  customerId: string;
  propertyId: string;
  total: number;
  currency: string;
  metadata: Record<string, unknown>;
  customer: { companyId: string; firstName: string; lastName: string; email: string };
  convertedFromDocument: null;
}

let order: Order;
let rules: { signOffBy: string }[];
let activity: { description: string; actorType: string }[];

/** A payment on the order, and the gateway intent behind it (none for money
 *  recorded by hand). */
interface CardPayment {
  id: string;
  processor: string;
  processorRef: string;
  status: string;
  amount: number;
  currency: string;
  metadata: Record<string, unknown>;
  refunds: { amount: number }[];
  intent: { metadata: Record<string, unknown> } | null;
}
let payments: CardPayment[];

const HELD = { sparx_capture: 'manual' };
function card(over: Partial<CardPayment> = {}): CardPayment {
  return {
    id: 'pay-1',
    processor: 'sparx_pay',
    processorRef: 'pi_wasatch',
    status: 'pending',
    amount: 1208,
    currency: 'USD',
    metadata: {},
    refunds: [],
    intent: { metadata: { ...HELD } },
    ...over,
  };
}

const people: Record<string, { firstName: string; lastName: string; email: string }> = {
  [RENEE]: {
    firstName: 'Renée',
    lastName: 'Castañeda',
    email: 'renee.castaneda@wasatchutility.test',
  },
  [TEODORA]: {
    firstName: 'Teodora',
    lastName: 'Vukić-Hale',
    email: 'teodora.vukic-hale@wasatchutility.test',
  },
  [MARCUS]: {
    firstName: 'Marcus',
    lastName: 'Oyelaran-Pike',
    email: 'marcus.oyelaran-pike@wasatchutility.test',
  },
};
let roles: Record<string, string>;

const tx = {
  order: {
    findFirst: ({ where }: { where: { id: string; status: string; customer?: unknown } }) =>
      Promise.resolve(order.id === where.id && order.status === where.status ? order : null),
    update: ({ data }: { data: Partial<Order> }) => {
      order = { ...order, ...data };
      return Promise.resolve({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
      });
    },
  },
  purchaseApprovalRule: {
    findMany: () =>
      Promise.resolve(
        rules.map((rule, i) => ({
          id: `rule-${i}`,
          accountId: ACCOUNT,
          propertyId: null,
          minAmountCents: 100_000,
          createdAt: new Date('2026-10-01T00:00:00Z'),
          requiredApproverUserId: null,
          requiredApprover: null,
          ...rule,
        }))
      ),
  },
  b2bAccountContact: {
    findMany: ({ where }: { where: { role: string; customerId?: { not: string } } }) =>
      Promise.resolve(
        Object.entries(roles)
          .filter(([id, role]) => role === where.role && id !== where.customerId?.not)
          .map(([id]) => ({ customerId: id, customer: people[id] }))
      ),
    findFirst: ({ where }: { where: { customerId: string } }) =>
      Promise.resolve(
        roles[where.customerId]
          ? { role: roles[where.customerId], customer: people[where.customerId] }
          : null
      ),
  },
  company: {
    findUnique: () => Promise.resolve({ companyName: 'Wasatch Front Utility Contractors, LLC' }),
  },
  user: {
    findUnique: () => Promise.resolve({ name: 'Doty Brown', email: 'doty@gillettdiesel.test' }),
  },
  crmActivity: {
    create: ({ data }: { data: { description: string; actorType: string } }) => {
      activity.push(data);
      return Promise.resolve(data);
    },
  },
  orderPayment: {
    findMany: ({ where }: { where: { orderId: string; status: { in: string[] } } }) =>
      Promise.resolve(
        payments.filter((p) => where.orderId === order.id && where.status.in.includes(p.status))
      ),
    update: ({ where, data }: { where: { id: string }; data: Partial<CardPayment> }) => {
      payments = payments.map((p) => (p.id === where.id ? { ...p, ...data } : p));
      return Promise.resolve(payments.find((p) => p.id === where.id));
    },
  },
  paymentIntent: {
    findFirst: ({ where }: { where: { externalId: string } }) =>
      Promise.resolve(payments.find((p) => p.processorRef === where.externalId)?.intent ?? null),
  },
  // The business's "waiting for your sign-off" task, which the hold opened.
  task: {
    findMany: ({ where }: { where: Partial<SignOffTask> }) =>
      Promise.resolve(
        tasks.filter((t) =>
          Object.entries(where).every(([k, v]) => t[k as keyof SignOffTask] === v)
        )
      ),
    update: ({ where, data }: { where: { id: string }; data: Partial<SignOffTask> }) => {
      tasks = tasks.map((t) => (t.id === where.id ? { ...t, ...data } : t));
      return Promise.resolve(tasks.find((t) => t.id === where.id));
    },
  },
  auditLog: { create: () => Promise.resolve({}) },
};

interface SignOffTask {
  id: string;
  tenantId: string;
  orderId: string;
  closesWhenOrderLeaves: string;
  customerId: string | null;
  dealId: string | null;
  title: string;
  description: string | null;
  status: string;
  completedByUserId: string | null;
}
let tasks: SignOffTask[];

const OVER_LIMIT = { kind: 'approval_rule', ruleId: 'rule-0' };
const OVER_CREDIT = {
  kind: 'over_credit_limit',
  orderTotal: 1208,
  creditLeft: 900,
  currency: 'USD',
};

function held(reasons: unknown[], customerId = RENEE): Order {
  return {
    id: 'o-14',
    orderNumber: 'O-000014',
    status: 'pending_approval',
    paymentStatus: 'unpaid',
    customerId,
    propertyId: 'site-gillett',
    total: 1208,
    currency: 'USD',
    metadata: { poNumber: 'WFU-PO-24-0917', approvalHold: { reasons } },
    customer: { companyId: ACCOUNT, ...people[customerId]! },
    convertedFromDocument: null,
  };
}

const as = (customerId: string) => ({ tenantId: TENANT, customerId, accountId: ACCOUNT });
const doty = { tenantId: TENANT, userId: DOTY };

beforeEach(() => {
  order = held([OVER_LIMIT]);
  rules = [{ signOffBy: 'account' }];
  roles = { [RENEE]: 'buyer', [TEODORA]: 'approver', [MARCUS]: 'viewer' };
  activity = [];
  payments = [];
  tasks = [
    {
      id: 't-sign-off',
      tenantId: TENANT,
      orderId: 'o-14',
      closesWhenOrderLeaves: 'pending_approval',
      customerId: RENEE,
      dealId: null,
      title:
        'Order O-000014 from Renée Castañeda is waiting for your sign-off: approve or reject it under Approvals',
      description: null,
      status: 'open',
      completedByUserId: null,
    },
  ];
});

// The task the hold opened for the business stayed open after the order was
// answered: measured on O-000014, approved by Teodora on the site and placed,
// task still `open`. Every way of answering it closes the task now, in words.
describe('the business’s sign-off task', () => {
  const signOff = () => tasks.find((t) => t.id === 't-sign-off')!;

  it('closes when Teodora approves it on the site, naming her', async () => {
    await approveOrderForAccount(as(TEODORA), 'o-14', {});
    expect(signOff()).toMatchObject({ status: 'completed', completedByUserId: null });
    expect(signOff().description).toBe(
      "Teodora Vukić-Hale, who approves orders for the customer's account, approved it on your site, and the order was placed."
    );
  });

  it('closes when the business signs it off, naming the teammate', async () => {
    rules = [{ signOffBy: 'business' }];
    await approveOrder(doty, 'o-14', {});
    expect(signOff()).toMatchObject({
      status: 'completed',
      completedByUserId: DOTY,
      description: 'Doty Brown signed it off, and the order was placed.',
    });
  });

  it('closes when the business turns it down', async () => {
    rules = [{ signOffBy: 'business' }];
    await rejectOrder(doty, 'o-14', { reason: 'Credit is on hold.' });
    expect(signOff()).toMatchObject({
      status: 'completed',
      completedByUserId: DOTY,
      description: 'Doty Brown turned it down ("Credit is on hold."), so the order was canceled.',
    });
  });

  it('closes when Teodora turns it down', async () => {
    await rejectOrderForAccount(as(TEODORA), 'o-14', {});
    expect(signOff()).toMatchObject({ status: 'completed', completedByUserId: null });
    expect(signOff().description).toBe(
      "Teodora Vukić-Hale, who approves orders for the customer's account, turned it down, so the order was canceled."
    );
  });

  describe('when both sides sign', () => {
    beforeEach(() => {
      order = held([OVER_LIMIT, OVER_CREDIT]);
    });

    it('stays open after Teodora’s yes: the business has still to sign', async () => {
      await approveOrderForAccount(as(TEODORA), 'o-14', {});
      expect(signOff().status).toBe('open');
    });

    it('closes on the business’s yes even while Teodora has still to approve', async () => {
      await approveOrder(doty, 'o-14', {});
      expect(order.status).toBe('pending_approval');
      expect(signOff()).toMatchObject({
        status: 'completed',
        completedByUserId: DOTY,
        description:
          'Doty Brown signed it off. Still waiting for Teodora Vukić-Hale at the account to approve it.',
      });
    });
  });
});

describe('a limit the account signs', () => {
  it('Teodora approves it, and it goes ahead', async () => {
    const result = await approveOrderForAccount(as(TEODORA), 'o-14', {});
    expect(result.order).toMatchObject({ status: 'placed', waitingOn: [] });
    expect(result.events.map((e) => e.type)).toEqual(['b2b.order.approved', 'order.placed']);
    expect(result.events[0]!.payload).toMatchObject({ decidedBy: 'Teodora Vukić-Hale' });
    expect(activity[0]).toMatchObject({ actorType: 'customer' });
    expect(activity[0]!.description).toContain('approved by Teodora Vukić-Hale');
  });

  it('is not the business’s to approve, and says who it waits on', async () => {
    await expect(approveOrder(doty, 'o-14', {})).rejects.toThrow(
      'This order is waiting for Teodora Vukić-Hale at Wasatch Front Utility Contractors, LLC to approve it.'
    );
    expect(order.status).toBe('pending_approval');
  });

  it('falls back to the business when nobody at the account can approve', async () => {
    roles = { [RENEE]: 'buyer', [MARCUS]: 'viewer' };
    const result = await approveOrder(doty, 'o-14', {});
    expect(result.order.status).toBe('placed');
  });
});

describe('when the business has to sign too', () => {
  beforeEach(() => {
    order = held([OVER_LIMIT, OVER_CREDIT]);
  });

  it('Teodora’s yes keeps it waiting for the business', async () => {
    const result = await approveOrderForAccount(as(TEODORA), 'o-14', {});
    expect(result.order).toMatchObject({ status: 'pending_approval', waitingOn: ['business'] });
    expect(result.events).toEqual([]);
    expect(order.status).toBe('pending_approval');
  });

  it('then the business’s yes places it', async () => {
    await approveOrderForAccount(as(TEODORA), 'o-14', {});
    const result = await approveOrder(doty, 'o-14', {});
    expect(result.order.status).toBe('placed');
    expect(order.metadata).toMatchObject({
      approvalHold: {
        signed: {
          account: { name: 'Teodora Vukić-Hale', customerId: TEODORA },
          business: { name: 'Doty Brown', userId: DOTY },
        },
      },
    });
  });

  it('the business may sign first, and Teodora’s yes then places it', async () => {
    const first = await approveOrder(doty, 'o-14', {});
    expect(first.order).toMatchObject({ status: 'pending_approval', waitingOn: ['account'] });
    const second = await approveOrderForAccount(as(TEODORA), 'o-14', {});
    expect(second.order.status).toBe('placed');
  });

  it('nobody signs the same side twice', async () => {
    await approveOrderForAccount(as(TEODORA), 'o-14', {});
    await expect(approveOrderForAccount(as(TEODORA), 'o-14', {})).rejects.toThrow(
      'Teodora Vukić-Hale has already approved this order.'
    );
  });
});

describe('who may sign for the account', () => {
  it('not the buyer who placed it', async () => {
    await expect(approveOrderForAccount(as(RENEE), 'o-14', {})).rejects.toThrow(
      'Only someone who can approve orders on this account can do that.'
    );
  });

  it('not someone who can only view', async () => {
    await expect(approveOrderForAccount(as(MARCUS), 'o-14', {})).rejects.toThrow(
      'Only someone who can approve orders on this account can do that.'
    );
  });

  it('not an approver on their own order', async () => {
    order = held([OVER_LIMIT], TEODORA);
    await expect(approveOrderForAccount(as(TEODORA), 'o-14', {})).rejects.toThrow(
      'You placed this order, so someone else on the account has to approve it.'
    );
  });

  it('not when the limit is the business’s to sign', async () => {
    rules = [{ signOffBy: 'business' }];
    await expect(approveOrderForAccount(as(TEODORA), 'o-14', {})).rejects.toThrow(
      'This order is not waiting for your approval.'
    );
  });
});

describe('turning it down', () => {
  it('cancels it and says who and why', async () => {
    const result = await rejectOrderForAccount(as(TEODORA), 'o-14', {
      reason: 'Over this month’s budget. Split it across two POs.',
    });
    expect(result.order.status).toBe('cancelled');
    expect(result.events[0]).toMatchObject({
      type: 'b2b.order.rejected',
      payload: {
        reason: 'Over this month’s budget. Split it across two POs.',
        decidedBy: 'Teodora Vukić-Hale',
        side: 'account',
      },
    });
  });

  // The stock it held while it waited goes back on sale with it, whichever
  // side said no, in the same transaction as the cancel.
  it('lets go of the stock it was holding, whoever turns it down', async () => {
    releaseOrderHolds.mockClear();
    await rejectOrderForAccount(as(TEODORA), 'o-14', {});
    expect(releaseOrderHolds).toHaveBeenCalledTimes(1);
    expect(releaseOrderHolds.mock.calls[0]?.[0]).toBe(tx);
    expect(releaseOrderHolds.mock.calls[0]?.[2]).toEqual({ orderId: 'o-14' });

    releaseOrderHolds.mockClear();
    order.status = 'pending_approval';
    await rejectOrder(doty, 'o-14', {});
    expect(releaseOrderHolds).toHaveBeenCalledTimes(1);
    expect(releaseOrderHolds.mock.calls[0]?.[2]).toEqual({ orderId: 'o-14' });
  });
});

describe('the card that paid for it', () => {
  const wasatchCard = {
    paymentId: 'pay-1',
    orderId: 'o-14',
    orderNumber: 'O-000014',
    customerId: RENEE,
    processor: 'sparx_pay',
    paymentRef: 'pi_wasatch',
    currency: 'USD',
  };

  it('a card held at checkout is charged when the last yes places the order', async () => {
    payments = [card()];
    const result = await approveOrderForAccount(as(TEODORA), 'o-14', {});
    expect(result.order.status).toBe('placed');
    expect(result.money).toEqual([{ action: 'capture', ...wasatchCard, amountCents: 120_800 }]);
  });

  it('nothing is charged while the order still waits for somebody', async () => {
    order = held([OVER_LIMIT, OVER_CREDIT]);
    payments = [card()];
    const first = await approveOrderForAccount(as(TEODORA), 'o-14', {});
    expect(first.money).toEqual([]);
    const second = await approveOrder(doty, 'o-14', {});
    expect(second.money).toEqual([{ action: 'capture', ...wasatchCard, amountCents: 120_800 }]);
  });

  it('a held card is let go when the account turns the order down', async () => {
    payments = [card({ status: 'authorized' })];
    const result = await rejectOrderForAccount(as(TEODORA), 'o-14', {});
    expect(result.money).toEqual([{ action: 'release', ...wasatchCard, amountCents: 120_800 }]);
  });

  it('a card already charged is refunded in full when the business turns it down', async () => {
    rules = [{ signOffBy: 'business' }];
    payments = [card({ status: 'captured', intent: { metadata: {} } })];
    const result = await rejectOrder(doty, 'o-14', {});
    expect(result.order.status).toBe('cancelled');
    expect(result.money).toEqual([{ action: 'refund', ...wasatchCard, amountCents: 120_800 }]);
  });

  it('refunds only what is left on a charge already partly refunded', async () => {
    payments = [card({ status: 'captured', intent: { metadata: {} }, refunds: [{ amount: 208 }] })];
    const result = await rejectOrderForAccount(as(TEODORA), 'o-14', {});
    expect(result.money).toEqual([{ action: 'refund', ...wasatchCard, amountCents: 100_000 }]);
  });

  it('a charge still on its way is marked to go straight back when it lands', async () => {
    payments = [card({ intent: { metadata: {} } })];
    const result = await rejectOrderForAccount(as(TEODORA), 'o-14', {});
    expect(result.money).toEqual([]);
    expect(payments[0]!.metadata).toEqual({ refundWhenPaid: true });
  });

  it('a charge still on its way is left to land when the order is approved', async () => {
    payments = [card({ intent: { metadata: {} } })];
    const result = await approveOrderForAccount(as(TEODORA), 'o-14', {});
    expect(result.money).toEqual([]);
    expect(payments[0]!.metadata).toEqual({});
  });

  it('leaves money recorded by hand to the business', async () => {
    payments = [card({ status: 'captured', processor: 'check', intent: null })];
    const result = await rejectOrderForAccount(as(TEODORA), 'o-14', {});
    expect(result.money).toEqual([]);
  });
});

describe('an order already paid while it waited', () => {
  it('is announced as paid by the yes that places it', async () => {
    order = { ...held([OVER_LIMIT]), paymentStatus: 'paid' };
    const result = await approveOrderForAccount(as(TEODORA), 'o-14', {});
    expect(result.events.map((e) => e.type)).toEqual([
      'b2b.order.approved',
      'order.placed',
      'order.paid',
    ]);
    expect(result.events[2]!.payload).toEqual({
      orderId: 'o-14',
      orderNumber: 'O-000014',
      customerId: RENEE,
    });
  });

  it('once, by the last yes, when two sides sign', async () => {
    order = { ...held([OVER_LIMIT, OVER_CREDIT]), paymentStatus: 'paid' };
    const first = await approveOrderForAccount(as(TEODORA), 'o-14', {});
    expect(first.events).toEqual([]);
    const second = await approveOrder(doty, 'o-14', {});
    expect(second.events.filter((e) => e.type === 'order.paid')).toHaveLength(1);
  });

  it('a card held at checkout is not paid yet, so charging it announces it instead', async () => {
    payments = [card({ status: 'authorized' })];
    const result = await approveOrderForAccount(as(TEODORA), 'o-14', {});
    expect(result.events.map((e) => e.type)).not.toContain('order.paid');
  });
});
