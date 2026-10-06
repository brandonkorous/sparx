import type { FastifyBaseLogger } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The payment webhook and a card held for sign-off (sparx persona issue 087).
 *
 *   1. "The card is held" is recorded as held, on the order's payment and our
 *      ledger. It never marks the order paid and never moves a held order off
 *      waiting: only somebody deciding it does that.
 *   2. A charge that lands on an order turned down while it was on its way (a
 *      gateway that cannot hold charges at checkout) goes straight back, and the
 *      buyer is not sent a receipt for an order that is not happening.
 *   3. The payment sweep finds a held card charged on approval, whose payment
 *      sits at `authorized` rather than `pending`.
 *   4. Deciding a held order: a charge that went through is recorded at once.
 *   5. A charge landing on an order still waiting for sign-off (a gateway that
 *      cannot hold) is recorded as paid, with no `order.paid` and no "order
 *      confirmed" email: the sign-off that places it announces it.
 *   6. One "order confirmed" email per order. It is the tenant's automation on
 *      `order.placed`, which sends with the email module on or off (an order
 *      confirmation is transactional). The webhook never sends one, on any path.
 */

interface Payment {
  id: string;
  orderId: string;
  status: string;
  metadata: Record<string, unknown>;
  processor: string;
  processorRef: string;
  amount: number;
  currency: string;
}

let payment: Payment;
let ledgerStatus: string;
/** The order's own status, as the webhook reads it after recording the money. */
let orderStatus: string;
/** What happens to the order while the rollup waits on its row. */
let duringRollup: () => void;
/** Other payments on the order already taken (a deposit order's earlier part). */
let earlierPayments: number;
/** Whether the email module is on. The webhook must not care either way. */
let emailModuleOn: boolean;
const orderWrites: unknown[] = [];
const paymentWrites: { where: unknown; data: Record<string, unknown> }[] = [];
const sweepWheres: unknown[] = [];

const tx = {
  paymentEvent: {
    create: () => Promise.resolve({}),
    updateMany: () => Promise.resolve({ count: 1 }),
  },
  paymentIntent: {
    updateMany: ({ where, data }: { where: { status?: unknown }; data: { status: string } }) => {
      ledgerStatus = data.status;
      void where;
      return Promise.resolve({ count: 1 });
    },
    findFirst: () => Promise.resolve({ amount: 120_800, currency: 'usd', status: ledgerStatus }),
  },
  orderPayment: {
    findFirst: () => Promise.resolve(payment),
    count: () => Promise.resolve(earlierPayments),
    findMany: ({ where }: { where: unknown }) => {
      sweepWheres.push(where);
      return Promise.resolve([]);
    },
    update: ({ data }: { data: Record<string, unknown> }) => {
      payment = { ...payment, ...(data as Partial<Payment>) };
      return Promise.resolve(payment);
    },
    updateMany: ({ where, data }: { where: { status: string }; data: Record<string, unknown> }) => {
      paymentWrites.push({ where, data });
      if (payment.status !== where.status) return Promise.resolve({ count: 0 });
      payment = { ...payment, ...(data as Partial<Payment>) };
      return Promise.resolve({ count: 1 });
    },
  },
  order: {
    findFirst: () =>
      Promise.resolve({
        id: 'order-14',
        orderNumber: 'O-000014',
        customerId: 'c-renee',
        propertyId: 'site-gillett',
        customer: { email: 'renee.castaneda@wasatchutility.test' },
      }),
    findUnique: () => Promise.resolve({ status: orderStatus }),
    update: (write: unknown) => {
      orderWrites.push(write);
      return Promise.resolve({});
    },
  },
};

const published: string[] = [];
const emails: unknown[] = [];
const settle = vi.fn((_ctx: unknown, moves: unknown[]) =>
  Promise.resolve(moves.map((move) => ({ move, ok: true })))
);

vi.mock('@wizeworks/db', () => ({
  prisma: {},
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('@wizeworks/crm', () => ({
  billingPaymentService: {},
  orderPaymentsService: {
    recomputeOrderPaymentRollup: () => {
      duringRollup();
      return Promise.resolve(true);
    },
  },
  heldOrderMoney: { REFUND_WHEN_PAID_KEY: 'refundWhenPaid' },
}));
vi.mock('@wizeworks/commerce', () => ({ heldOrderPayments: { settle } }));
vi.mock('@wizeworks/auth', () => ({
  isModuleEnabled: (_tenantId: string, module: string) =>
    Promise.resolve(module === 'email' && emailModuleOn),
}));
vi.mock('@wizeworks/api-core/pubsub', () => ({
  publish: (_log: unknown, topic: string) => {
    published.push(topic);
    return Promise.resolve();
  },
}));
vi.mock('./tenant-email.js', () => ({
  sendTenantEmailByKey: (_log: unknown, _t: unknown, mail: unknown) => {
    emails.push(mail);
    return Promise.resolve();
  },
}));
vi.mock('./payments-onboarding.js', () => ({ reconcileSparxPayAccount: () => Promise.resolve() }));

const { reconcilePaymentEvent, sweepStrandedCheckoutPayments } =
  await import('./payment-webhook-reconcile.js');
const { settleHeldOrderMoney } = await import('./held-order-money.js');

const log = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
} as unknown as FastifyBaseLogger;

const event = (type: 'payment.authorized' | 'payment.succeeded') => ({
  type,
  tenantId: 't-gillett',
  externalId: `evt_${type}`,
  providerEventType: type,
  payload: {},
  data: { chargeId: 'pi_wasatch', amountCents: 120_800, currency: 'usd' },
});

beforeEach(() => {
  payment = {
    id: 'pay-1',
    orderId: 'order-14',
    status: 'pending',
    metadata: {},
    processor: 'sparx_pay',
    processorRef: 'pi_wasatch',
    amount: 1208,
    currency: 'USD',
  };
  ledgerStatus = 'requires_payment_method';
  orderStatus = 'placed';
  duringRollup = () => undefined;
  earlierPayments = 0;
  emailModuleOn = false;
  orderWrites.length = 0;
  paymentWrites.length = 0;
  sweepWheres.length = 0;
  published.length = 0;
  emails.length = 0;
  settle.mockClear();
});

describe('the card is held', () => {
  it('is recorded as held, and nothing is paid or placed', async () => {
    await reconcilePaymentEvent(log, event('payment.authorized'), { gatewayId: 'sparx_pay' });
    expect(payment.status).toBe('authorized');
    expect(ledgerStatus).toBe('requires_capture');
    expect(orderWrites).toEqual([]);
    expect(published).toEqual([]);
  });

  it('never winds back a payment that has already been charged', async () => {
    payment = { ...payment, status: 'captured' };
    await reconcilePaymentEvent(log, event('payment.authorized'), { gatewayId: 'sparx_pay' });
    expect(payment.status).toBe('captured');
  });
});

describe('a charge landing on a turned-down order', () => {
  it('goes straight back, with no receipt and no "paid"', async () => {
    payment = { ...payment, metadata: { refundWhenPaid: true } };
    await reconcilePaymentEvent(log, event('payment.succeeded'), { gatewayId: 'square' });
    expect(payment.status).toBe('captured');
    expect(settle).toHaveBeenCalledWith({ tenantId: 't-gillett' }, [
      {
        action: 'refund',
        paymentId: 'pay-1',
        orderId: 'order-14',
        orderNumber: 'O-000014',
        customerId: 'c-renee',
        processor: 'sparx_pay',
        paymentRef: 'pi_wasatch',
        amountCents: 120_800,
        currency: 'USD',
      },
    ]);
    expect(published).not.toContain('order.paid');
    expect(emails).toEqual([]);
  });

  it('an ordinary charge is still announced', async () => {
    await reconcilePaymentEvent(log, event('payment.succeeded'), { gatewayId: 'sparx_pay' });
    expect(settle).not.toHaveBeenCalled();
    expect(published).toEqual(['payment.captured', 'order.paid']);
  });
});

describe('a charge landing on an order still waiting for sign-off', () => {
  // A gateway that charges on its own page (Square, Authorize.net, PayPal)
  // cannot hold the card, so the money lands before anybody has approved it.
  it('is recorded as paid, and neither announced nor confirmed to the buyer', async () => {
    orderStatus = 'pending_approval';
    await reconcilePaymentEvent(log, event('payment.succeeded'), { gatewayId: 'square' });
    expect(payment.status).toBe('captured');
    expect(orderWrites).toEqual([]);
    expect(published).toEqual(['payment.captured']);
    expect(emails).toEqual([]);
  });

  it('a sign-off that places it while this waits on the order row is seen, and this announces it', async () => {
    // The approval wrote the order first and saw it unpaid, so it announced
    // nothing: this is the one that has to.
    orderStatus = 'pending_approval';
    duringRollup = () => {
      orderStatus = 'placed';
    };
    await reconcilePaymentEvent(log, event('payment.succeeded'), { gatewayId: 'square' });
    expect(published).toEqual(['payment.captured', 'order.paid']);
  });
});

describe('the payment sweep', () => {
  it('looks at held cards as well as pending ones', async () => {
    await sweepStrandedCheckoutPayments(log, 't-gillett');
    expect(sweepWheres[0]).toMatchObject({ status: { in: ['pending', 'authorized'] } });
  });
});

describe('deciding a held order', () => {
  it('records a charge that went through at once, without waiting for the webhook', async () => {
    payment = { ...payment, status: 'authorized' };
    // `capturePayment` marks our ledger succeeded when the charge goes through.
    ledgerStatus = 'succeeded';
    await settleHeldOrderMoney(log, { tenantId: 't-gillett', userId: 'u-doty' }, [
      {
        action: 'capture',
        paymentId: 'pay-1',
        orderId: 'order-14',
        orderNumber: 'O-000014',
        customerId: 'c-renee',
        processor: 'sparx_pay',
        paymentRef: 'pi_wasatch',
        amountCents: 120_800,
        currency: 'USD',
      },
    ]);
    expect(settle).toHaveBeenCalledTimes(1);
    expect(payment.status).toBe('captured');
    expect(published).toEqual(['payment.captured', 'order.paid']);
  });
});

// The confirmation is the tenant's "Order confirmation: email" automation on
// `order.placed`, at checkout or at sign-off, and it sends with the email module
// on or off (sparx persona issue 087). The webhook used to send its own on every
// captured payment, so a card order got two; then it sent one only with the email
// module off, which left pay-later and held orders unconfirmed on those shops.
// Now it sends none, on every path, whatever the module says.
describe.each([
  ['off', false],
  ['on', true],
])('one "order confirmed" email per order, email module %s', (_label, moduleOn) => {
  beforeEach(() => {
    emailModuleOn = moduleOn;
  });

  it('a card order: the charge confirms nothing, `order.placed` at checkout did', async () => {
    await reconcilePaymentEvent(log, event('payment.succeeded'), { gatewayId: 'sparx_pay' });
    expect(published).toEqual(['payment.captured', 'order.paid']);
    expect(emails).toEqual([]);
  });

  it('a deposit order: neither part of the money is a confirmation', async () => {
    await reconcilePaymentEvent(log, event('payment.succeeded'), { gatewayId: 'sparx_pay' });
    payment = { ...payment, id: 'pay-2', status: 'pending' };
    earlierPayments = 1;
    await reconcilePaymentEvent(log, event('payment.succeeded'), { gatewayId: 'sparx_pay' });
    expect(emails).toEqual([]);
  });

  it('a held order charged at approval: the sign-off confirmed it, the charge does not', async () => {
    payment = { ...payment, status: 'authorized' };
    ledgerStatus = 'succeeded';
    await settleHeldOrderMoney(log, { tenantId: 't-gillett', userId: 'u-doty' }, [
      {
        action: 'capture',
        paymentId: 'pay-1',
        orderId: 'order-14',
        orderNumber: 'O-000014',
        customerId: 'c-renee',
        processor: 'sparx_pay',
        paymentRef: 'pi_wasatch',
        amountCents: 120_800,
        currency: 'USD',
      },
    ]);
    expect(payment.status).toBe('captured');
    expect(emails).toEqual([]);
  });

  it('a held order paid while it waited, then placed: the sign-off confirmed it', async () => {
    orderStatus = 'pending_approval';
    duringRollup = () => {
      orderStatus = 'placed';
    };
    await reconcilePaymentEvent(log, event('payment.succeeded'), { gatewayId: 'square' });
    expect(emails).toEqual([]);
  });
});
