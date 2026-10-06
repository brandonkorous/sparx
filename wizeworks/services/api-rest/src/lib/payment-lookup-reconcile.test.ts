import type { FastifyBaseLogger } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A card order is marked paid without a webhook (issue 739).
 *
 * Only the webhook ever wrote `succeeded` to the shop's own record, and the
 * step after checkout read only that record. So a shop that never set up a
 * webhook (the console calls the signing secret optional) left every card order
 * unpaid for ever, kept no card and started no repeat order. Measured on
 * Juniper Row with "Your own Stripe": O-000031, $158.21, paid at Stripe and
 * "unpaid" here.
 *
 *   1. When the record has not heard, the gateway is asked, and a payment it
 *      says went through is marked paid by the webhook's own handler.
 *   2. A payment still on its way, or a gateway that cannot be asked, changes
 *      nothing and throws nothing: the order is already placed.
 *   3. A card held for sign-off is recorded as held, never as paid.
 *   4. When the record already heard, the gateway is not asked.
 *   5. The sweep asks only about payments from the last three days.
 */

interface Payment {
  id: string;
  orderId: string;
  status: string;
  metadata: Record<string, unknown>;
  processor: string;
  processorRef: string;
  createdAt: Date;
}

let payment: Payment;
let ledgerStatus: string;
let swept: Payment[];

const tx = {
  paymentEvent: {
    create: () => Promise.resolve({}),
    updateMany: () => Promise.resolve({ count: 1 }),
  },
  paymentIntent: {
    updateMany: ({ data }: { data: { status: string } }) => {
      ledgerStatus = data.status;
      return Promise.resolve({ count: 1 });
    },
    findFirst: () => Promise.resolve({ amount: 15_821, currency: 'usd', status: ledgerStatus }),
  },
  orderPayment: {
    findFirst: () => Promise.resolve(payment),
    count: () => Promise.resolve(0),
    findMany: () => Promise.resolve(swept),
    update: ({ data }: { data: Record<string, unknown> }) => {
      payment = { ...payment, ...(data as Partial<Payment>) };
      return Promise.resolve(payment);
    },
    updateMany: ({ where, data }: { where: { status: string }; data: Record<string, unknown> }) => {
      if (payment.status !== where.status) return Promise.resolve({ count: 0 });
      payment = { ...payment, ...(data as Partial<Payment>) };
      return Promise.resolve({ count: 1 });
    },
  },
  order: {
    findFirst: () =>
      Promise.resolve({
        id: 'order-31',
        orderNumber: 'O-000031',
        customerId: 'c-mara',
        propertyId: 'site-juniper',
        customer: { email: 'p03.mara@piggles.test' },
      }),
    findUnique: () => Promise.resolve({ status: 'placed' }),
    update: () => Promise.resolve({}),
  },
};

const published: string[] = [];
/** What the gateway says, or the error it throws. */
let atGateway: { status: string; amountCents?: number } | Error | null;
let lookups: { tenantId: string; paymentRef: string }[];
let gatewayCanLookUp: boolean;

vi.mock('@wizeworks/db', () => ({
  prisma: {},
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('@wizeworks/crm', () => ({
  billingPaymentService: {},
  orderPaymentsService: { recomputeOrderPaymentRollup: () => Promise.resolve(true) },
  heldOrderMoney: { REFUND_WHEN_PAID_KEY: 'refundWhenPaid' },
}));
vi.mock('@wizeworks/commerce', () => ({ heldOrderPayments: { settle: vi.fn() } }));
vi.mock('@wizeworks/auth', () => ({ isModuleEnabled: () => Promise.resolve(false) }));
vi.mock('@wizeworks/api-core/pubsub', () => ({
  publish: (_log: unknown, topic: string) => {
    published.push(topic);
    return Promise.resolve();
  },
}));
vi.mock('./tenant-email.js', () => ({ sendTenantEmailByKey: () => Promise.resolve() }));
vi.mock('./payments-onboarding.js', () => ({ reconcileSparxPayAccount: () => Promise.resolve() }));
vi.mock('@wizeworks/payments', () => ({
  gatewayRegistry: {
    get: (id: string) => {
      if (id !== 'stripe_direct') throw new Error(`no gateway ${id}`);
      if (!gatewayCanLookUp) return {};
      return {
        lookupPayment: (params: { tenantId: string; paymentRef: string }) => {
          lookups.push(params);
          if (atGateway instanceof Error) return Promise.reject(atGateway);
          if (!atGateway) return Promise.resolve(null);
          return Promise.resolve({
            status: atGateway.status,
            data: {
              chargeId: params.paymentRef,
              amountCents: atGateway.amountCents ?? 15_821,
              currency: 'usd',
            },
          });
        },
      };
    },
  },
}));

const { reconcileCompletedCheckoutPayment, sweepStrandedCheckoutPayments } =
  await import('./payment-webhook-reconcile.js');

const log = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
} as unknown as FastifyBaseLogger;

const DAY = 24 * 60 * 60_000;

beforeEach(() => {
  payment = {
    id: 'pay-31',
    orderId: 'order-31',
    status: 'pending',
    metadata: {},
    processor: 'stripe_direct',
    processorRef: 'pi_juniper',
    createdAt: new Date(Date.now() - 10 * 60_000),
  };
  ledgerStatus = 'requires_payment_method';
  swept = [];
  atGateway = { status: 'succeeded' };
  lookups = [];
  gatewayCanLookUp = true;
  published.length = 0;
});

const complete = (gatewayId = 'stripe_direct') =>
  reconcileCompletedCheckoutPayment(log, 't-juniper', gatewayId, 'pi_juniper');

describe('no webhook has arrived', () => {
  it('asks the gateway, and marks a payment that went through as paid', async () => {
    expect(await complete()).toBe(true);
    expect(lookups).toEqual([{ tenantId: 't-juniper', paymentRef: 'pi_juniper' }]);
    expect(payment.status).toBe('captured');
    expect(ledgerStatus).toBe('succeeded');
    expect(published).toContain('order.paid');
  });

  it('changes nothing while the payment is still on its way', async () => {
    atGateway = { status: 'pending' };
    expect(await complete()).toBe(false);
    expect(payment.status).toBe('pending');
    expect(published).toEqual([]);
  });

  it('records a card held for sign-off as held, not paid', async () => {
    atGateway = { status: 'authorized' };
    expect(await complete()).toBe(false);
    expect(payment.status).toBe('authorized');
    expect(published).not.toContain('order.paid');
  });

  it('throws nothing when the gateway cannot be asked or the call fails', async () => {
    gatewayCanLookUp = false;
    expect(await complete()).toBe(false);
    gatewayCanLookUp = true;
    atGateway = new Error('Stripe is down');
    expect(await complete()).toBe(false);
    expect(await complete('manual')).toBe(false);
    expect(payment.status).toBe('pending');
  });
});

describe('the webhook already heard', () => {
  it('does not ask the gateway', async () => {
    ledgerStatus = 'succeeded';
    expect(await complete()).toBe(true);
    expect(lookups).toEqual([]);
    expect(payment.status).toBe('captured');
  });
});

describe('the stranded payment sweep', () => {
  it('asks about a recent payment and not about one four days old', async () => {
    swept = [
      { ...payment, processorRef: 'pi_recent', createdAt: new Date(Date.now() - DAY) },
      { ...payment, processorRef: 'pi_old', createdAt: new Date(Date.now() - 4 * DAY) },
    ];
    await sweepStrandedCheckoutPayments(log, 't-juniper');
    expect(lookups.map((l) => l.paymentRef)).toEqual(['pi_recent']);
  });
});
