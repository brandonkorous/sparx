import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The money on a held wholesale order once it is decided (sparx persona issue
 * 087), and the refund that gives it back.
 *
 *   1. The rule, in one place: approved charges a held card; turned down lets a
 *      held card go, refunds a charged one, and marks a charge still on its way.
 *   2. A canceled order can be refunded. A card order turned down at sign-off is
 *      canceled with the money taken, and "Cannot refund a canceled order" meant
 *      the money could only be kept. It stays canceled: that is what happened.
 *   3. The buyer is asked to pay only for an order that went ahead after its
 *      held card could not be charged.
 */

interface Row {
  id: string;
  status: string;
  total: number;
  refundTotal: number;
  surchargeTotal: number;
  customerId: string;
  orderNumber: string;
  items: unknown[];
}

let order: Row;
let failedPayments: { metadata: Record<string, unknown> }[];
const orderWrites: Record<string, unknown>[] = [];

const tx = {
  order: {
    findUnique: vi.fn(() => Promise.resolve(order)),
    update: vi.fn(({ data }: { data: Record<string, unknown> }) => {
      orderWrites.push(data);
      return Promise.resolve({ ...order, ...data });
    }),
  },
  orderPayment: {
    findUnique: vi.fn(() => Promise.resolve({ orderId: order.id })),
    findMany: vi.fn(() => Promise.resolve(failedPayments)),
  },
  orderRefund: {
    create: vi.fn(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'refund-1', ...data })
    ),
  },
  // A full refund closes any task waiting on the order; none waits here.
  task: { findMany: vi.fn(() => Promise.resolve([])) },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
  afterCommit: () => Promise.resolve(),
}));
vi.mock('../audit', () => ({ writeAuditLog: () => Promise.resolve() }));
vi.mock('./order-payments-service', () => ({
  recomputeOrderPaymentRollup: () => Promise.resolve(false),
}));

const { moneyFor, approvedButNotCharged } = await import('./held-order-money');
const { recordRefund } = await import('./order-refunds-service');

const ORDER = '11111111-1111-4111-8111-111111111111';
const PAYMENT = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  order = {
    id: ORDER,
    status: 'cancelled',
    total: 1208,
    refundTotal: 0,
    surchargeTotal: 0,
    customerId: 'c-renee',
    orderNumber: 'O-000014',
    items: [],
  };
  failedPayments = [];
  orderWrites.length = 0;
});

describe('what the card needs', () => {
  const held = (status: string) => ({ status, held: true, refundableCents: 120_800 });
  const charged = (status: string, refundableCents = 120_800) => ({
    status,
    held: false,
    refundableCents,
  });

  it('approved: a held card is charged, and nothing else is touched', () => {
    expect(moneyFor('placed', held('pending'))).toBe('capture');
    expect(moneyFor('placed', held('authorized'))).toBe('capture');
    expect(moneyFor('placed', charged('pending'))).toBeNull();
    expect(moneyFor('placed', charged('captured'))).toBeNull();
  });

  it('turned down: a held card is let go and a charged one refunded', () => {
    expect(moneyFor('turned_down', held('authorized'))).toBe('release');
    expect(moneyFor('turned_down', charged('captured'))).toBe('refund');
    expect(moneyFor('turned_down', charged('pending'))).toBe('refund_when_paid');
  });

  it('turned down: nothing left to give back is nothing to do', () => {
    expect(moneyFor('turned_down', charged('captured', 0))).toBeNull();
    expect(moneyFor('turned_down', held('voided'))).toBeNull();
  });
});

describe('refunding a canceled order', () => {
  it('is allowed, and the order stays canceled', async () => {
    const refund = await recordRefund(
      { tenantId: 't-gillett' },
      {
        orderId: ORDER,
        paymentId: PAYMENT,
        amount: 1208,
        currency: 'USD',
        reason: 'The order was turned down before it was placed.',
        processorRef: 're_wasatch',
      }
    );
    expect(refund).toMatchObject({ processorRef: 're_wasatch', status: 'completed' });
    expect(orderWrites).toEqual([]);
  });

  it('still marks an order that was going ahead as refunded when all of it goes back', async () => {
    order = { ...order, status: 'placed' };
    await recordRefund({ tenantId: 't-gillett' }, { orderId: ORDER, amount: 1208 });
    expect(orderWrites[0]).toMatchObject({ status: 'refunded' });
  });
});

describe('asking the buyer to pay', () => {
  const placedUnpaid = { id: ORDER, status: 'placed', paymentStatus: 'unpaid' };

  it('when the held card could not be charged once it was approved', async () => {
    failedPayments = [{ metadata: { signOffCaptureFailed: true } }];
    expect(await approvedButNotCharged(tx as never, placedUnpaid)).toBe(true);
  });

  it('not for a card that simply failed at checkout', async () => {
    failedPayments = [{ metadata: {} }];
    expect(await approvedButNotCharged(tx as never, placedUnpaid)).toBe(false);
  });

  it('not once it is paid, and not for an order that is not going ahead', async () => {
    failedPayments = [{ metadata: { signOffCaptureFailed: true } }];
    expect(
      await approvedButNotCharged(tx as never, { ...placedUnpaid, paymentStatus: 'paid' })
    ).toBe(false);
    expect(await approvedButNotCharged(tx as never, { ...placedUnpaid, status: 'cancelled' })).toBe(
      false
    );
  });
});
