import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Money recorded on a wholesale order that is still waiting for sign-off is not
 * announced as `order.paid` (sparx persona issue 087).
 *
 * `order.paid` sets every listener to work: the high-value alert, staff
 * commission, the search index, funnels, the business's own webhooks. A held
 * order is not placed, and may yet be turned down, so the sign-off that places
 * it announces it instead (`placedEvents` in @wizeworks/b2b). Two ways money
 * lands on a held order through here:
 *
 *   1. Somebody records a payment while it waits.
 *   2. A gift card covers it at checkout. Checkout redeems the card inside its
 *      own transaction BEFORE it holds the order, so the order this reads is not
 *      held yet, and only asking again after the commit catches it.
 */

const ORDER = '8f1c2a44-6b0e-4a1e-9c33-2d6f0a7b5e10';
const TENANT = '2e78fb6c-a823-4698-bcb9-58a4f17710a0';

let order: {
  id: string;
  orderNumber: string;
  customerId: string;
  status: string;
  total: number;
  paidAt: Date | null;
};
/** What runs once the write commits, in order. */
let afterCommitQueue: (() => Promise<void>)[];
const announced: string[] = [];

const tx = {
  order: {
    findUnique: () => Promise.resolve({ ...order }),
    update: ({ data }: { data: Partial<typeof order> }) => {
      order = { ...order, ...data };
      return Promise.resolve(order);
    },
  },
  orderPayment: {
    create: ({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'pay-1', capturedAt: new Date(), ...data }),
    findMany: () => Promise.resolve([{ amount: 1208 }]),
  },
  orderRefund: { findMany: () => Promise.resolve([]) },
};

vi.mock('@wizeworks/db', () => ({
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
  afterCommit: (_label: string, run: () => Promise<void>) => {
    afterCommitQueue.push(run);
    return Promise.resolve();
  },
}));
vi.mock('./customer-rollup', () => ({ recomputeCustomerCommerce: () => Promise.resolve() }));
vi.mock('../audit', () => ({ writeAuditLog: () => Promise.resolve() }));
vi.mock('../consumers/platform-bus', () => ({
  publishPlatformEvent: (event: { topic: string }) => {
    announced.push(event.topic);
    return Promise.resolve();
  },
}));

const { recordPayment } = await import('./order-payments-service');

async function commit(): Promise<void> {
  for (const run of afterCommitQueue) await run();
  afterCommitQueue = [];
}

const giftCard = {
  orderId: ORDER,
  processor: 'gift_card',
  processorRef: 'GIFT-7Q4M',
  amount: 1208,
  currency: 'USD',
  status: 'captured',
};

beforeEach(() => {
  order = {
    id: ORDER,
    orderNumber: 'O-000014',
    customerId: 'c-renee',
    status: 'placed',
    total: 1208,
    paidAt: null,
  };
  afterCommitQueue = [];
  announced.length = 0;
});

describe('money on an order waiting for sign-off', () => {
  it('a payment recorded while it waits is not announced as paid', async () => {
    order.status = 'pending_approval';
    await recordPayment({ tenantId: TENANT }, giftCard);
    await commit();
    expect(order.paidAt).not.toBeNull();
    expect(announced).toEqual(['order.payment.recorded']);
  });

  it('a gift card at checkout, before the order is held in the same write, is not either', async () => {
    await recordPayment({ tenantId: TENANT }, giftCard);
    // Later in the same checkout transaction: over the limit, so it is held.
    order.status = 'pending_approval';
    await commit();
    expect(announced).toEqual(['order.payment.recorded']);
  });

  it('a sign-off placing it just after this payment announces it, so this does not', async () => {
    order.status = 'pending_approval';
    await recordPayment({ tenantId: TENANT }, giftCard);
    // The approval was waiting on this write's hold on the order row. It saw
    // the order paid, placed it, and announced `order.paid` itself.
    order.status = 'placed';
    await commit();
    expect(announced).toEqual(['order.payment.recorded']);
  });

  it('an order that is not waiting is announced once', async () => {
    await recordPayment({ tenantId: TENANT }, giftCard);
    await commit();
    expect(announced).toEqual(['order.payment.recorded', 'order.paid']);
  });
});
