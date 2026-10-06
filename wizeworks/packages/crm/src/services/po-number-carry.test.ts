import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * THE BUYER'S PO NUMBER RIDES FROM THE QUOTE TO THE ORDER TO THE INVOICE
 * (sparx persona issue 077).
 *
 * Wasatch Front Utility Contractors buys from Gillett Diesel on Net 30 against
 * their own purchase order, WFUC-24-0817. Their accounts department will not pay
 * an invoice it cannot match to that number. Web checkout already wrote it onto
 * `order.metadata.poNumber`, and nothing in invoicing read it: not the quote, not
 * the order made from the quote, not the invoice made from the order.
 */

const PO = 'WFUC-24-0817';
const QUOTE = '6e1f4a0c-7d0b-4c55-8a4e-3b9f6f0c2a11';
const ORDER = 'f3d0a7c2-1b5e-4f8a-9c6d-2e7b8a9c0d12';
const RENEE = 'fd7795a2-99f3-4583-b7be-efcb2d886a1b';
const WASATCH = '8aa59a36-acc9-455f-b0ba-41c0b66292b9';
const SITE = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';

const QUOTE_BILL_TO = {
  name: 'Wasatch Front Utility Contractors, LLC',
  email: 'renee.castaneda@wasatchutility.test',
  address: 'Accounts Payable\n2275 S 900 W, Suite 200\nSalt Lake City, UT 84119\nUS',
};

const orderCreate = vi.fn((args: { data: Record<string, unknown> }) =>
  Promise.resolve({
    id: ORDER,
    orderNumber: 'SO-000412',
    customerId: RENEE,
    placedAt: new Date('2026-10-02T17:00:00Z'),
    total: 528,
    currency: 'USD',
    ...args.data,
  })
);
const documentCreate = vi.fn((args: { data: Record<string, unknown> }) =>
  Promise.resolve({ id: 'doc-invoice', ...args.data })
);
const lineCreate = vi.fn(() => Promise.resolve({}));

let quoteMetadata: Record<string, unknown>;
let orderMetadata: Record<string, unknown>;
let accountTerms: string | null;
let account: { status: string; creditLimit: number; creditUsed: number };
let holdingRule: { id: string } | null;
let holdingRuleSignOffBy: 'business' | 'account';
let accountApprovers: {
  customerId: string;
  customer: { firstName: string; lastName: string; email: string };
}[];
const createOrderArDocument = vi.fn(() => Promise.resolve({ id: 'doc-ar' }));

const tx = {
  // Turning the quote into an order closes a task waiting on it; none waits here.
  task: { findMany: vi.fn(() => Promise.resolve([])) },
  billingDocument: {
    findUnique: vi.fn(() =>
      Promise.resolve({
        id: QUOTE,
        number: 'Q-000031',
        deletedAt: null,
        stage: { stageType: 'committed', name: 'Accepted' },
        customerId: RENEE,
        companyId: WASATCH,
        propertyId: SITE,
        currency: 'USD',
        subtotal: 528,
        taxTotal: 0,
        shippingTotal: 0,
        discountTotal: 0,
        surchargeTotal: 0,
        coreChargeTotal: 150,
        total: 678,
        billTo: QUOTE_BILL_TO,
        metadata: quoteMetadata,
        lines: [],
      })
    ),
    update: vi.fn(() => Promise.resolve({ id: QUOTE })),
    create: documentCreate,
    findUniqueOrThrow: vi.fn(() => Promise.resolve({ id: 'doc-invoice', lines: [] })),
  },
  order: {
    findFirst: vi.fn(() => Promise.resolve(null)),
    create: orderCreate,
    findUnique: vi.fn(() =>
      Promise.resolve({
        id: ORDER,
        orderNumber: 'SO-000412',
        status: 'placed',
        total: 678,
        amountPaid: 0,
        currency: 'USD',
        customerId: RENEE,
        propertyId: SITE,
        shippingTotal: 0,
        surchargeTotal: 0,
        paidAt: null,
        billingAddress: null,
        shippingAddress: null,
        metadata: orderMetadata,
        items: [
          {
            name: 'Bosch Remanufactured Fuel Injector (0986435621)',
            sku: '0986435621',
            quantity: 1,
            unitPrice: 528,
            lineSubtotal: 528,
            taxAmount: 0,
            discountAmount: 0,
            coreCharge: 150,
            productId: '2db1efc0-fd08-46b4-ac1d-6f334d426077',
            variantId: '6f0cf3c9-2fc3-4294-a285-643eb5ef229d',
          },
        ],
        customer: {
          email: 'renee.castaneda@wasatchutility.test',
          firstName: 'Renée',
          lastName: 'Castañeda',
        },
        billingDocuments: [],
        payments: [],
        convertedFromDocument: {
          billTo: QUOTE_BILL_TO,
          companyId: WASATCH,
          metadata: quoteMetadata,
        },
      })
    ),
  },
  company: {
    findUnique: vi.fn(() => Promise.resolve({ ...account, paymentTerms: accountTerms })),
  },
  purchaseApprovalRule: {
    findFirst: vi.fn(() => Promise.resolve(holdingRule)),
    // Who a held order asks to sign it (sparx persona issue 087): the rule that
    // held it, signed by the business, and nobody at the account who can approve.
    findMany: vi.fn(() =>
      Promise.resolve(
        holdingRule
          ? [
              {
                ...holdingRule,
                accountId: null,
                propertyId: null,
                minAmountCents: 0,
                createdAt: new Date('2026-10-01T00:00:00Z'),
                signOffBy: holdingRuleSignOffBy,
                requiredApproverUserId: null,
                requiredApprover: null,
              },
            ]
          : []
      )
    ),
  },
  b2bAccountContact: { findMany: vi.fn(() => Promise.resolve(accountApprovers)) },
  customerAddress: { findMany: vi.fn(() => Promise.resolve([])) },
  documentWorkflow: {
    findFirst: vi.fn(() =>
      Promise.resolve({ id: 'wf-invoice', stages: [{ id: 'stage-invoice' }] })
    ),
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
const publishPlatformEvent = vi.fn((_event: { topic: string; payload?: Record<string, unknown> }) =>
  Promise.resolve()
);
/** Who the held-order event says it asks. */
function heldEventAsks(): unknown {
  return publishPlatformEvent.mock.calls
    .map(([event]) => event)
    .find((event) => event.topic === 'b2b.order.pending_approval')?.payload?.asks;
}
vi.mock('../consumers/platform-bus', () => ({ publishPlatformEvent }));
vi.mock('./record-numbers', () => ({ nextOrderNumber: vi.fn(() => Promise.resolve('SO-000412')) }));
vi.mock('./customer-rollup', () => ({ recomputeCustomerCommerce: vi.fn(() => Promise.resolve()) }));
vi.mock('./billing-document-service', () => ({ recomputeTotals: vi.fn(() => Promise.resolve()) }));
vi.mock('./billing-document-stage-service', () => ({
  applyStageEntryEffects: vi.fn(() => Promise.resolve({ events: [] })),
}));
vi.mock('./business-clock', () => ({ businessTimeZone: vi.fn(() => Promise.resolve('UTC')) }));
vi.mock('./b2b-ar-service', () => ({ createOrderArDocument }));

const { convertToOrder } = await import('./billing-document-conversion-service');
const { createInvoiceForOrder, invoiceLineName } = await import('./billing-from-order-service');

const CTX = { tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508', userId: 'u-doty' };

beforeEach(() => {
  vi.clearAllMocks();
  quoteMetadata = { poNumber: PO };
  orderMetadata = {};
  accountTerms = 'net30';
  // Wasatch Front: $25,000 limit, $4,753.60 of it used.
  account = { status: 'active', creditLimit: 25000, creditUsed: 4753.6 };
  holdingRule = null;
  holdingRuleSignOffBy = 'business';
  accountApprovers = [];
});

describe('a quote becoming an order', () => {
  it("puts the buyer's PO number on the order, where checkout puts it", async () => {
    await convertToOrder(CTX, QUOTE);
    const data = orderCreate.mock.calls[0]?.[0].data;
    // Beside the account's terms, where checkout keeps the ones an order was
    // placed on (sparx persona issue 085).
    expect(data?.metadata).toEqual({ paymentTermsRequested: 'net30', poNumber: PO });
  });

  it('puts nothing there when the quote had none', async () => {
    quoteMetadata = {};
    await convertToOrder(CTX, QUOTE);
    expect(orderCreate.mock.calls[0]?.[0].data.metadata).toEqual({
      paymentTermsRequested: 'net30',
    });
  });

  // Sparx persona issue 084: Wasatch Front's accepted quote became an order with
  // no invoice, where the same order placed at checkout on Net 30 gets one.
  it('invoices an account on terms, due on its terms, made out as the quote was', async () => {
    const { order } = await convertToOrder(CTX, QUOTE);
    expect(createOrderArDocument).toHaveBeenCalledTimes(1);
    const [, input] = createOrderArDocument.mock.calls[0] as unknown as [
      unknown,
      { companyId: string; orderId: string; amount: number; dueAt: Date; billTo: unknown },
    ];
    expect(input.companyId).toBe(WASATCH);
    expect(input.orderId).toBe(order.id);
    expect(input.amount).toBe(678);
    expect(input.billTo).toEqual(QUOTE_BILL_TO);
    const days = (input.dueAt.getTime() - order.placedAt.getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(30);
  });

  it('issues no invoice for an account that pays first, or has no terms yet', async () => {
    accountTerms = 'prepay';
    await convertToOrder(CTX, QUOTE);
    accountTerms = null;
    await convertToOrder(CTX, QUOTE);
    expect(createOrderArDocument).not.toHaveBeenCalled();
  });
});

// Sparx persona issue 085: accepting a quote places its order, so the order has
// to answer what checkout answers first. An order over a spending limit or past
// the account's credit WAITS for sign-off; an account the business has stopped
// is refused, and nothing is written.
describe('a quote order that has to wait, or cannot be taken', () => {
  it('places an order that fits the credit and no limit covers', async () => {
    const result = await convertToOrder(CTX, QUOTE);
    expect(orderCreate.mock.calls[0]?.[0].data.status).toBe('placed');
    expect(result.held).toEqual([]);
    expect(publishPlatformEvent.mock.calls.map(([event]) => event.topic)).toContain('order.placed');
  });

  it('holds an order past the credit limit, with no invoice until it is signed off', async () => {
    account = { status: 'active', creditLimit: 5000, creditUsed: 4753.6 };
    const result = await convertToOrder(CTX, QUOTE);
    const data = orderCreate.mock.calls[0]?.[0].data;
    expect(data?.status).toBe('pending_approval');
    expect(createOrderArDocument).not.toHaveBeenCalled();
    expect(result.invoiceId).toBeNull();
    expect(result.held).toEqual([
      { kind: 'over_credit_limit', orderTotal: 678, creditLeft: 246.4, currency: 'USD' },
    ]);
    expect(data?.metadata).toMatchObject({
      paymentTermsRequested: 'net30',
      approvalHold: { reasons: result.held },
    });
    const topics = publishPlatformEvent.mock.calls.map(([event]) => event.topic);
    expect(topics).toContain('b2b.order.pending_approval');
    expect(topics).not.toContain('order.placed');
    // Over the credit limit is the business's to sign (sparx persona issue 087).
    expect(heldEventAsks()).toEqual(['business']);
  });

  it('asks the account’s own approver when the limit is theirs to sign', async () => {
    holdingRule = { id: 'rule-wasatch-1000' };
    holdingRuleSignOffBy = 'account';
    accountApprovers = [
      {
        customerId: 'c-teodora',
        customer: {
          firstName: 'Teodora',
          lastName: 'Vukić-Hale',
          email: 'teodora.vukic-hale@wasatchutility.test',
        },
      },
    ];
    const result = await convertToOrder(CTX, QUOTE);
    expect(result.asks).toEqual(['account']);
    expect(heldEventAsks()).toEqual(['account']);
  });

  it('holds an order a spending limit covers, even with credit to spare', async () => {
    holdingRule = { id: 'rule-slco-2500' };
    const result = await convertToOrder(CTX, QUOTE);
    expect(orderCreate.mock.calls[0]?.[0].data.status).toBe('pending_approval');
    expect(result.held).toEqual([{ kind: 'approval_rule', ruleId: 'rule-slco-2500' }]);
  });

  it('refuses an account on credit hold, and writes no order', async () => {
    account = { status: 'credit_hold', creditLimit: 25000, creditUsed: 0 };
    await expect(convertToOrder(CTX, QUOTE)).rejects.toThrow('credit hold');
    expect(orderCreate).not.toHaveBeenCalled();
  });
});

describe('an order made from a quote becoming an invoice', () => {
  it("prints the buyer's PO number, from the quote when the order has none of its own", async () => {
    await createInvoiceForOrder(CTX, { orderId: ORDER });
    const data = documentCreate.mock.calls[0]?.[0].data;
    expect(data?.metadata).toEqual({ poNumber: PO });
  });

  it("prefers the order's own PO number, taken at checkout", async () => {
    orderMetadata = { poNumber: 'WFUC-24-0901' };
    await createInvoiceForOrder(CTX, { orderId: ORDER });
    expect(documentCreate.mock.calls[0]?.[0].data.metadata).toEqual({ poNumber: 'WFUC-24-0901' });
  });

  it('is addressed to the business the quote was, and bills its account', async () => {
    await createInvoiceForOrder(CTX, { orderId: ORDER });
    const data = documentCreate.mock.calls[0]?.[0].data;
    expect(data?.billTo).toEqual(QUOTE_BILL_TO);
    expect(data?.companyId).toBe(WASATCH);
  });

  it('prints the part code once, not twice', async () => {
    await createInvoiceForOrder(CTX, { orderId: ORDER });
    const line = (lineCreate.mock.calls[0] as unknown as [{ data: { description: string } }])[0];
    expect(line.data.description).toBe('Bosch Remanufactured Fuel Injector (0986435621)');
  });
});

describe('invoiceLineName', () => {
  it('adds the code only when the name lacks it', () => {
    expect(invoiceLineName('Country sourdough', 'SRD-001')).toBe('Country sourdough (SRD-001)');
    expect(invoiceLineName('Bosch injector (0986435621)', '0986435621')).toBe(
      'Bosch injector (0986435621)'
    );
    expect(invoiceLineName('Gift card', '')).toBe('Gift card');
  });
});

// Sparx persona issue 086: a buyer's quote request says when they need it and
// where it goes. That is for whoever packs and ships the ORDER, so it rides from
// the quote onto the order, beside the PO number, whether the order goes ahead
// or waits to be signed off (signing off changes only the status).
describe('delivery needs on a quote becoming an order', () => {
  const DELIVERY = {
    neededBy: '2026-10-20',
    deliverTo: 'Yard 2, 400 Industrial Way, Salt Lake City',
    notes: 'Forklift on site',
  };

  it('puts the needed-by day, where it goes and the delivery notes on the order', async () => {
    quoteMetadata = { poNumber: PO, delivery: DELIVERY };
    await convertToOrder(CTX, QUOTE);
    expect(orderCreate.mock.calls[0]?.[0].data.metadata).toEqual({
      paymentTermsRequested: 'net30',
      poNumber: PO,
      delivery: DELIVERY,
    });
  });

  it('keeps them on an order that waits to be signed off', async () => {
    quoteMetadata = { delivery: DELIVERY };
    holdingRule = { id: 'rule-1' };
    await convertToOrder(CTX, QUOTE);
    const data = orderCreate.mock.calls[0]?.[0].data;
    expect(data?.status).toBe('pending_approval');
    expect((data?.metadata as Record<string, unknown>).delivery).toEqual(DELIVERY);
  });

  it('writes no delivery at all when the quote said nothing about it', async () => {
    quoteMetadata = { delivery: { neededBy: null, deliverTo: ' ', notes: null } };
    await convertToOrder(CTX, QUOTE);
    expect(orderCreate.mock.calls[0]?.[0].data.metadata).not.toHaveProperty('delivery');
  });
});
