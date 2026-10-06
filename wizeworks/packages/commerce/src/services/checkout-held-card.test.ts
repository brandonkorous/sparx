import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A card order that a spending limit holds is HELD, not charged (sparx persona
 * issue 087).
 *
 * Renée's $1,208.00 order went over Wasatch Front's $1,000.00 limit and waited
 * for sign-off, and her card was charged at checkout anyway: no checkout ever
 * asked the gateway to hold a card. When her own company turned the order down,
 * it was cancelled and the money kept. These drive the real checkout service:
 *
 *   1. The card form for an order a limit will hold asks the gateway to hold
 *      the card, where it can. Where it cannot, the card is charged as before
 *      (and a turned-down order is refunded instead).
 *   2. Nothing else is held: an order under the limit, or a shopper with no
 *      trade account, is charged as it always was.
 *   3. A card held for a sign-off the order turned out not to need (the limit
 *      or the basket changed before Place order) is charged as soon as the
 *      order is placed, rather than left to drop off the card a week later with
 *      the order unpaid. A held order's card is left alone.
 */

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const CART = '22222222-2222-4222-8222-222222222222';
const SESSION = '44444444-4444-4444-8444-444444444444';
const ORDER = '66666666-6666-4666-8666-666666666666';

let totalCents = 120_800;
let companyId: string | null = ACCOUNT;
let limitCents: number | null = 100_000;
let canHold = true;
let heldIntent = true;
let orderStatus = 'placed';

const gatewayIntent = vi.fn((params: { amount: number }) =>
  Promise.resolve({
    id: 'pi_wasatch',
    clientSecret: 'pi_wasatch_secret',
    amount: params.amount,
    currency: 'usd',
    status: 'requires_payment_method',
    metadata: {},
  })
);
const settle = vi.fn((_ctx: unknown, moves: unknown[]) =>
  Promise.resolve(moves.map((move) => ({ move, ok: true })))
);

const session = () => ({
  id: SESSION,
  cartId: CART,
  step: 'review',
  channel: 'storefront',
  currency: 'USD',
  customerId: 'renee',
  companyId,
  customerEmail: 'renee.castaneda@wasatchutility.test',
  customerName: 'Renée Castañeda',
  customerNote: null,
  shippingAddress: { line1: '1 Depot Road' },
  billingAddress: null,
  shippingProviderSlug: 'flat',
  shippingRateRef: 'flat-1',
  shippingDescription: 'Ground',
  paymentProviderSlug: 'sparx_pay',
  paymentRef: 'pi_wasatch',
  paymentTermsRequested: null,
  poNumber: 'WFU-PO-24-0917',
  totalCents,
  subtotalCents: totalCents,
  discountTotalCents: 0,
  shippingTotalCents: 0,
  taxTotalCents: 0,
  surchargeTotalCents: 0,
  giftCardAppliedCents: 0,
  accountCreditAppliedCents: 0,
  coreChargeTotalCents: 0,
  expiresAt: new Date(Date.now() + 3_600_000),
  cart: {
    id: CART,
    propertyId: 'site-gillett',
    customerId: 'renee',
    channel: 'storefront',
    currency: 'USD',
    items: [],
    discounts: [],
  },
});

const orderPayments: Record<string, unknown>[] = [];

const tx = {
  checkoutSession: {
    findFirst: vi.fn(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve('idempotencyKey' in where ? null : session())
    ),
    update: vi.fn(() => Promise.resolve(session())),
  },
  cart: {
    findFirst: vi.fn(() => Promise.resolve({ propertyId: 'site-gillett' })),
    findFirstOrThrow: vi.fn(() =>
      Promise.resolve({
        subtotalCents: totalCents,
        discountTotalCents: 0,
        giftCardAppliedCents: 0,
        coreChargeTotalCents: 0,
        pricingTrace: null,
      })
    ),
  },
  cartItem: { count: vi.fn(() => Promise.resolve(0)) },
  cartDiscount: { findMany: vi.fn(() => Promise.resolve([])) },
  property: { findFirst: vi.fn(() => Promise.resolve({ id: 'site-gillett' })) },
  purchaseApprovalRule: {
    findMany: vi.fn(() =>
      Promise.resolve(
        limitCents === null
          ? []
          : [
              {
                id: 'rule-wasatch',
                accountId: ACCOUNT,
                propertyId: null,
                minAmountCents: limitCents,
                createdAt: new Date('2026-10-01T00:00:00Z'),
                signOffBy: 'business',
                requiredApproverUserId: null,
                requiredApprover: null,
              },
            ]
      )
    ),
    findFirst: vi.fn(() =>
      Promise.resolve(
        limitCents !== null && totalCents >= limitCents ? { id: 'rule-wasatch' } : null
      )
    ),
  },
  b2bAccountContact: { findMany: vi.fn(() => Promise.resolve([])) },
  user: { findUnique: vi.fn(() => Promise.resolve(null)) },
  company: { findUnique: vi.fn(() => Promise.resolve({ companyName: 'Wasatch Front' })) },
  order: {
    update: vi.fn(({ data }: { data: { status?: string } }) => {
      if (data.status) orderStatus = data.status;
      return Promise.resolve({});
    }),
  },
  orderPayment: {
    create: vi.fn(({ data }: { data: Record<string, unknown> }) => {
      orderPayments.push({ id: 'pay-1', metadata: {}, refunds: [], ...data });
      return Promise.resolve(data);
    }),
    findMany: vi.fn(() => Promise.resolve(orderPayments)),
  },
  paymentIntent: {
    updateMany: vi.fn(() => Promise.resolve({ count: 1 })),
    findFirst: vi.fn(() =>
      Promise.resolve({ metadata: heldIntent ? { sparx_capture: 'manual' } : {} })
    ),
  },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('@wizeworks/payments', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  paymentService: {
    createPaymentIntent: gatewayIntent,
    getGatewayForTenant: () => Promise.resolve({ id: 'sparx_pay' }),
    canHoldCards: () => Promise.resolve(canHold),
  },
}));
vi.mock('@wizeworks/crm', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>();
  return {
    ...real,
    orderService: {
      create: () =>
        Promise.resolve({
          id: ORDER,
          orderNumber: 'O-000015',
          propertyId: 'site-gillett',
          metadata: {},
        }),
    },
  };
});
vi.mock('../audit', () => ({ writeAuditLog: () => Promise.resolve() }));
vi.mock('../events', () => ({ publishCommerceEvent: () => Promise.resolve() }));
vi.mock('../inventory-gate', () => ({ isInventoryActive: () => Promise.resolve(false) }));
vi.mock('./account-buying-rules', () => ({ assertCartMayBeOrdered: () => Promise.resolve() }));
vi.mock('./cart-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  recomputeCartTotals: () => Promise.resolve(),
}));
vi.mock('./pricing-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveActiveB2bAccountId: () => Promise.resolve(companyId ?? undefined),
}));
vi.mock('./surcharge-service', () => ({ listActiveSpecs: () => Promise.resolve([]) }));
vi.mock('./made-to-order-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  assertWithinDailyLimits: () => Promise.resolve(),
  forCart: (_tx: unknown, _cart: unknown, total: number) =>
    Promise.resolve({ dueNowCents: total, noticeDays: null }),
}));
vi.mock('./held-order-payments', () => ({ settle }));

const { complete, createPaymentIntent } = await import('./checkout-service');
const ctx = { tenantId: '55555555-5555-4555-8555-555555555555' };

beforeEach(() => {
  totalCents = 120_800;
  companyId = ACCOUNT;
  limitCents = 100_000;
  canHold = true;
  heldIntent = true;
  orderStatus = 'placed';
  orderPayments.length = 0;
  gatewayIntent.mockClear();
  settle.mockClear();
});

const askedToHold = () =>
  (gatewayIntent.mock.calls[0]?.[0] as { captureMethod?: string } | undefined)?.captureMethod ===
  'manual';

describe('the card for an order a spending limit will hold', () => {
  it('is held, not charged, and the card step is told so', async () => {
    const result = await createPaymentIntent(ctx, { sessionId: SESSION });
    expect(askedToHold()).toBe(true);
    expect(gatewayIntent.mock.calls[0]?.[0]).toMatchObject({
      amount: 120_800,
      metadata: { sparx_capture: 'manual' },
    });
    expect(result.cardHeld).toBe(true);
  });

  it('is charged now where the gateway cannot hold a card', async () => {
    canHold = false;
    const result = await createPaymentIntent(ctx, { sessionId: SESSION });
    expect(askedToHold()).toBe(false);
    expect(gatewayIntent.mock.calls[0]?.[0]).not.toHaveProperty('metadata.sparx_capture');
    expect(result.cardHeld).toBe(false);
  });
});

describe('every other card payment is charged as it always was', () => {
  it('an order under the limit', async () => {
    totalCents = 90_000;
    const result = await createPaymentIntent(ctx, { sessionId: SESSION });
    expect(askedToHold()).toBe(false);
    expect(result.cardHeld).toBe(false);
  });

  it('a shopper with no trade account', async () => {
    companyId = null;
    const result = await createPaymentIntent(ctx, { sessionId: SESSION });
    expect(askedToHold()).toBe(false);
    expect(result.cardHeld).toBe(false);
  });
});

describe('placing the order', () => {
  it('leaves a held order’s card held until somebody decides it', async () => {
    const result = await complete(ctx, { sessionId: SESSION, idempotencyKey: 'key-held-order' });
    expect(result.pendingApproval).toBe(true);
    expect(orderStatus).toBe('pending_approval');
    expect(settle).not.toHaveBeenCalled();
  });

  it('charges a held card at once when the order turned out not to need sign-off', async () => {
    // The limit was raised between the card form and Place order.
    limitCents = 200_000;
    const result = await complete(ctx, { sessionId: SESSION, idempotencyKey: 'k-placed' });
    expect(result.pendingApproval).toBe(false);
    expect(settle).toHaveBeenCalledTimes(1);
    expect(settle.mock.calls[0]?.[1]).toEqual([
      expect.objectContaining({
        action: 'capture',
        orderId: ORDER,
        orderNumber: 'O-000015',
        paymentRef: 'pi_wasatch',
        amountCents: 120_800,
      }),
    ]);
    // What the gateway work needs stays inside the service.
    expect(result).not.toHaveProperty('captureNow');
  });

  it('leaves a card that was charged at checkout to the payment webhook', async () => {
    limitCents = 200_000;
    heldIntent = false;
    await complete(ctx, { sessionId: SESSION, idempotencyKey: 'k-charged' });
    expect(settle).not.toHaveBeenCalled();
  });
});
