import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * "MAKE AN INVOICE" ON A QUOTE'S ORDER KEEPS THE QUOTE'S COSTS (sparx persona
 * issue 086).
 *
 * An order made from a quote for a customer not on terms is invoiced by hand,
 * one invoice line per order item. Order items have no cost of their own, so the
 * costs on the quote were lost and the invoice showed no margin. Each item now
 * takes the cost of the quote line it was made from: same description, part,
 * quantity and price. An item that matches no quote line gets no cost, never $0.
 */

const ORDER = 'f3d0a7c2-1b5e-4f8a-9c6d-2e7b8a9c0d12';
const RENEE = 'fd7795a2-99f3-4583-b7be-efcb2d886a1b';
const SITE = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const INJECTOR = '0b8f2c1e-4d3a-4f5b-9c6d-7e8f9a0b1c2d';

const item = (over: Record<string, unknown>) => ({
  name: 'Install and test',
  sku: '',
  quantity: 2,
  unitPrice: 145,
  lineSubtotal: 290,
  taxAmount: 0,
  discountAmount: 0,
  coreCharge: null,
  productId: null,
  variantId: null,
  ...over,
});

let items: ReturnType<typeof item>[];
let quoteLines: Record<string, unknown>[] | null;
const lineCreate = vi.fn((_args: { data: Record<string, unknown> }) => Promise.resolve({}));

const tx = {
  order: {
    findUnique: vi.fn(() =>
      Promise.resolve({
        id: ORDER,
        orderNumber: 'O-000008',
        status: 'placed',
        propertyId: SITE,
        customerId: RENEE,
        currency: 'USD',
        total: 935,
        amountPaid: 0,
        shippingTotal: 0,
        surchargeTotal: 0,
        metadata: {},
        billingAddress: null,
        shippingAddress: null,
        paidAt: null,
        items,
        customer: { email: 'ap@wasatch.test', firstName: 'Renee', lastName: 'C' },
        billingDocuments: [],
        payments: [],
        convertedFromDocument:
          quoteLines === null
            ? null
            : { billTo: null, companyId: null, metadata: {}, lines: quoteLines },
      })
    ),
  },
  documentWorkflow: {
    findFirst: vi.fn(() =>
      Promise.resolve({ id: 'wf', stages: [{ id: 's1', stageType: 'final' }] })
    ),
  },
  billingDocument: {
    create: vi.fn((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'doc-inv', ...args.data })
    ),
    findUniqueOrThrow: vi.fn(() => Promise.resolve({ id: 'doc-inv', lines: [] })),
  },
  billingDocumentLine: { create: lineCreate },
  billingDocumentPayment: { create: vi.fn(() => Promise.resolve({})) },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('../audit', () => ({ writeAuditLog: vi.fn(() => Promise.resolve()) }));
vi.mock('../events', () => ({ publishCrmEvent: vi.fn(() => Promise.resolve()) }));
vi.mock('./billing-document-service', () => ({ recomputeTotals: vi.fn(() => Promise.resolve()) }));
vi.mock('./billing-document-stage-service', () => ({
  applyStageEntryEffects: vi.fn(() => Promise.resolve({ events: [] })),
}));
vi.mock('./business-clock', () => ({ businessTimeZone: vi.fn(() => Promise.resolve('UTC')) }));

const { createInvoiceForOrder } = await import('./billing-from-order-service');

const CTX = { tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508', userId: 'u-doty' };

function costs() {
  return lineCreate.mock.calls.map((call) => call[0].data.costCents ?? null);
}

beforeEach(() => {
  vi.clearAllMocks();
  items = [
    item({
      name: 'Bosch Injector',
      quantity: 1,
      unitPrice: 600,
      lineSubtotal: 600,
      variantId: INJECTOR,
    }),
    item({}),
    item({ name: 'Shop supplies', quantity: 1, unitPrice: 25, lineSubtotal: 25 }),
  ];
  // As the quote holds them, not in the order's order.
  quoteLines = [
    { description: 'Shop supplies', variantId: null, quantity: 1, unitPrice: 25, costCents: null },
    {
      description: 'Install and test',
      variantId: null,
      quantity: 2,
      unitPrice: 145,
      costCents: 6_200,
    },
    {
      description: 'Bosch Injector',
      variantId: INJECTOR,
      quantity: 1,
      unitPrice: 600,
      costCents: 41_250,
    },
  ];
});

describe('an invoice made by hand from a quote order', () => {
  it('gives each line the cost of the quote line it came from', async () => {
    await createInvoiceForOrder(CTX, { orderId: ORDER });
    expect(costs()).toEqual([41_250, 6_200, null]);
  });

  it('gives no cost to an item that matches no quote line, never $0', async () => {
    items = [item({ unitPrice: 160, lineSubtotal: 320 })];
    await createInvoiceForOrder(CTX, { orderId: ORDER });
    expect(costs()).toEqual([null]);
  });

  it('uses each quote line once, so two like items do not share one cost', async () => {
    items = [item({}), item({})];
    await createInvoiceForOrder(CTX, { orderId: ORDER });
    expect(costs()).toEqual([6_200, null]);
  });
});

describe('an invoice made by hand from any other order', () => {
  it('has no costs to carry', async () => {
    quoteLines = null;
    await createInvoiceForOrder(CTX, { orderId: ORDER });
    expect(costs()).toEqual([null, null, null]);
  });
});
