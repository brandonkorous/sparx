import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A held order keeps the stock its basket was holding.
 *
 * MEASURED 2026-10-03 on Gillett Diesel: Renée Castañeda's order O-000014
 * (3 CP4 kits) went over Wasatch Front's spending limit and waited for a
 * sign-off. Checkout left the basket's hold on the basket, on its thirty-minute
 * timer, and the approval hours later took the kits again without it. Driving
 * the real checkout service:
 *
 *   1. A held order moves the basket's holds to the order (they are kept, off
 *      the basket's timer), and the basket line stops pointing at them, so an
 *      edit to the basket cannot let them go.
 *   2. Nothing is sold while it waits.
 *   3. An order that goes straight through sells from the basket's hold, as it
 *      always has, and holds nothing.
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
const KIT = '77777777-7777-4777-8777-777777777777';
const HOLD = '88888888-8888-4888-8888-888888888888';
const LINE = '99999999-9999-4999-8999-999999999999';

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
    items: [
      {
        id: LINE,
        variantId: KIT,
        quantity: 3,
        unitPriceCents: 40_266,
        subtotalCents: 120_800,
        coreChargeCents: null,
        coreFirst: false,
        repeatIntervalUnit: null,
        repeatIntervalCount: null,
        inventoryReservationId: HOLD,
        variant: {
          productId: 'p-kit',
          sku: 'CP4-6.7F-BP-G2.1',
          dropshipSourceId: null,
          product: { title: 'S&S CP4 kit' },
        },
      },
    ],
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
  cartItem: {
    count: vi.fn(() => Promise.resolve(0)),
    updateMany: vi.fn(() => Promise.resolve({ count: 1 })),
  },
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
vi.mock('../inventory-gate', () => ({ isInventoryActive: () => Promise.resolve(true) }));
const holdStockForOrderOnTx = vi.fn((..._args: unknown[]) =>
  Promise.resolve({ reservationIds: [HOLD], unheldQuantity: 0 })
);
const commitSaleOnTx = vi.fn((..._args: unknown[]) => Promise.resolve([]));
vi.mock('@wizeworks/inventory', async (importOriginal) => {
  const real = await importOriginal<{ inventoryService: Record<string, unknown> }>();
  return {
    ...real,
    inventoryService: { ...real.inventoryService, holdStockForOrderOnTx, commitSaleOnTx },
  };
});
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

const { complete } = await import('./checkout-service');
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
  holdStockForOrderOnTx.mockClear();
  commitSaleOnTx.mockClear();
  tx.cartItem.updateMany.mockClear();
});

describe('the stock of an order a spending limit holds', () => {
  it('moves the basket’s hold to the order, and the basket stops pointing at it', async () => {
    const result = await complete(ctx, { sessionId: SESSION, idempotencyKey: 'k-held-stock' });
    expect(result.pendingApproval).toBe(true);
    expect(orderStatus).toBe('pending_approval');
    expect(holdStockForOrderOnTx).toHaveBeenCalledTimes(1);
    expect(holdStockForOrderOnTx.mock.calls[0]?.[2]).toEqual({
      orderId: ORDER,
      lines: [{ variantId: KIT, quantity: 3, reservationId: HOLD }],
    });
    expect(tx.cartItem.updateMany).toHaveBeenCalledWith({
      where: { cartId: CART, inventoryReservationId: { not: null } },
      data: { inventoryReservationId: null },
    });
  });

  it('sells nothing while it waits', async () => {
    await complete(ctx, { sessionId: SESSION, idempotencyKey: 'k-held-nothing-sold' });
    expect(commitSaleOnTx).not.toHaveBeenCalled();
  });

  it('an order under the limit sells from the basket’s hold and holds nothing', async () => {
    limitCents = 200_000;
    const result = await complete(ctx, { sessionId: SESSION, idempotencyKey: 'k-straight' });
    expect(result.pendingApproval).toBe(false);
    expect(holdStockForOrderOnTx).not.toHaveBeenCalled();
    expect(commitSaleOnTx.mock.calls[0]?.[2]).toEqual({
      orderId: ORDER,
      lines: [{ variantId: KIT, quantity: 3, reservationId: HOLD, lineKey: LINE }],
    });
  });
});
