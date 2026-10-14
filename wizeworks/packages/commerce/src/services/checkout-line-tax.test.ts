import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * An order's lines carry the sales tax the checkout quoted for them.
 *
 * MEASURED 2026-10-11 on Gillett Diesel: Renée Castañeda's O-000029, a Stanadyne
 * additive at $12.50 with $0.91 of Utah tax, was written with $0.91 on the order
 * and $0.00 on its line. The invoice for an order on account lists its lines only
 * when they come to the order total, so all nine taxed fleet orders were invoiced
 * as one line, "Order O-000029, non-taxable" (sparx persona issue 226). Driving
 * the real checkout service, the items it hands the order carry their tax.
 */

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const CART = '22222222-2222-4222-8222-222222222222';
const SESSION = '44444444-4444-4444-8444-444444444444';
const ORDER = '66666666-6666-4666-8666-666666666666';

let totalCents = 120_800;
let taxCents = 8_757;
let taxBreakdown: unknown = null;
let createdMetadata: Record<string, unknown> = {};
let companyId: string | null = ACCOUNT;
let limitCents: number | null = 100_000;
let canHold = true;
let heldIntent = true;
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
  taxTotalCents: taxCents,
  taxBreakdown,
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
const createdItems: { taxAmount?: number }[] = [];

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
    update: vi.fn(() => Promise.resolve({})),
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
      create: (
        _ctx: unknown,
        input: { items: { taxAmount?: number }[]; metadata?: Record<string, unknown> }
      ) => {
        createdItems.push(...input.items);
        createdMetadata = input.metadata ?? {};
        return Promise.resolve({
          id: ORDER,
          orderNumber: 'O-000015',
          propertyId: 'site-gillett',
          metadata: {},
        });
      },
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
  taxCents = 8_757;
  taxBreakdown = {
    providerSlug: 'sparx-manual',
    breakdownRef: 'manual:gillett',
    totalTaxCents: 8_757,
    shippingTaxCents: 0,
    calculatedAt: '2026-10-11T09:55:00.000Z',
    lines: [
      {
        lineRef: 0,
        cartItemId: LINE,
        taxableAmountCents: 120_800,
        taxAmountCents: 8_757,
        jurisdictions: [
          { name: 'Utah sales tax', type: 'state', rateBasisPoints: 725, amountCents: 8_757 },
        ],
      },
    ],
  };
  createdMetadata = {};
  companyId = ACCOUNT;
  limitCents = null;
  canHold = true;
  heldIntent = true;
  orderPayments.length = 0;
  createdItems.length = 0;
});

describe('the tax on an order line', () => {
  it('is the tax the checkout quoted for that basket line', async () => {
    await complete(ctx, { sessionId: SESSION, idempotencyKey: 'k-line-tax' });
    expect(createdItems.map((item) => item.taxAmount)).toEqual([87.57]);
  });

  it('stays on the order alone when the quote cannot say which line it was on', async () => {
    taxBreakdown = {
      providerSlug: 'sparx-manual',
      totalTaxCents: 8_757,
      shippingTaxCents: 0,
      lines: [{ lineRef: 0, taxAmountCents: 8_757 }],
    };
    await complete(ctx, { sessionId: SESSION, idempotencyKey: 'k-old-quote' });
    expect(createdItems.map((item) => item.taxAmount ?? 0)).toEqual([0]);
  });
});

// The invoice divided the tax by the subtotal and printed "Tax (7.24%)" on an
// order Utah taxed at 7.25% (sparx persona issue 228).
describe('the tax rate on an order', () => {
  it('is the rate the checkout charged', async () => {
    await complete(ctx, { sessionId: SESSION, idempotencyKey: 'k-order-rate' });
    expect(createdMetadata.taxRateBasisPoints).toBe(725);
  });

  it('is left off when the quote names no rate', async () => {
    taxBreakdown = { lines: [{ lineRef: 0, cartItemId: LINE, taxAmountCents: 8_757 }] };
    await complete(ctx, { sessionId: SESSION, idempotencyKey: 'k-order-no-rate' });
    expect(createdMetadata).not.toHaveProperty('taxRateBasisPoints');
  });
});
