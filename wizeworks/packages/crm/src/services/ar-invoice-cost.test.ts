import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A QUOTE'S LINE COSTS FOLLOW IT ONTO THE INVOICE (sparx persona issue 086).
 *
 * Wasatch Front accepts quote Q-000031; it becomes an order on Net 30 and the
 * order's invoice is raised at once (or when a held order is signed off). That
 * invoice was ONE line, "Order O-000008", carrying the whole total, so the cost
 * on every quote line was gone and the invoice showed no margin at all, where
 * the quote it came from showed one. Raised from a quote, the invoice now
 * carries the quote's own lines, each with its cost. A line with no cost stays
 * null. The order total stays the authority: when the quote's lines no longer
 * add up to it, the invoice is the single line it always was.
 */

const ORDER = 'f3d0a7c2-1b5e-4f8a-9c6d-2e7b8a9c0d12';
const QUOTE = '6e1f4a0c-7d0b-4c55-8a4e-3b9f6f0c2a11';
const WASATCH = '8aa59a36-acc9-455f-b0ba-41c0b66292b9';
const SITE = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';

// The quote: a $600 injector costing $412.50, two hours of labor at $145 costing
// $62 each, and a $25 shop-supplies line with no cost. 7.25% tax on the parts.
const quoteLines = [
  {
    id: 'q1',
    lineTypeId: 'type-part',
    productId: 'p1',
    variantId: 'v1',
    description: 'Bosch Remanufactured Fuel Injector (0986435621)',
    quantity: 1,
    unitPrice: 600,
    costCents: 41_250,
    taxable: true,
    discountAmount: 0,
    taxAmount: 43.5,
    lineSubtotal: 600,
    lineTotal: 643.5,
    coreCharge: 150,
    sortOrder: 0,
    metadata: {},
  },
  {
    id: 'q2',
    lineTypeId: 'type-labor',
    productId: null,
    variantId: null,
    description: 'Install and test',
    quantity: 2,
    unitPrice: 145,
    costCents: 6_200,
    taxable: false,
    discountAmount: 0,
    taxAmount: 0,
    lineSubtotal: 290,
    lineTotal: 290,
    coreCharge: null,
    sortOrder: 1,
    metadata: {},
  },
  {
    id: 'q3',
    lineTypeId: null,
    productId: null,
    variantId: null,
    description: 'Shop supplies',
    quantity: 1,
    unitPrice: 25,
    costCents: null,
    taxable: false,
    discountAmount: 0,
    taxAmount: 0,
    lineSubtotal: 25,
    lineTotal: 25,
    coreCharge: null,
    sortOrder: 2,
    metadata: {},
  },
];
// 600 + 43.50 tax + 290 + 25 + 150 core deposit + 9 delivery.
const QUOTE_TOTAL = 1117.5;

let convertedFrom: string | null;
const lineCreate = vi.fn((_args: { data: Record<string, unknown> }) => Promise.resolve({}));
const docCreate = vi.fn((args: { data: Record<string, unknown> }) =>
  Promise.resolve({ id: 'doc-ar', ...args.data })
);

const tx = {
  company: { findUnique: vi.fn(() => Promise.resolve({ id: WASATCH, companyName: 'Wasatch' })) },
  documentWorkflow: {
    findUnique: vi.fn(() =>
      Promise.resolve({
        id: 'wf',
        stages: [
          { id: 's-inv', stageType: 'final', sortOrder: 0, customerLabel: 'Invoice' },
          { id: 's-paid', stageType: 'paid', sortOrder: 1, customerLabel: 'Paid' },
        ],
      })
    ),
  },
  order: {
    findUnique: vi.fn(() =>
      Promise.resolve({ metadata: {}, convertedFromDocumentId: convertedFrom })
    ),
  },
  billingDocument: {
    create: docCreate,
    findFirst: vi.fn(() => Promise.resolve(null)),
    findUnique: vi.fn(() =>
      Promise.resolve({
        id: QUOTE,
        taxRate: 0.0725,
        shippingTotal: 9,
        surchargeTotal: 0,
        lines: quoteLines,
      })
    ),
    findUniqueOrThrow: vi.fn(() => Promise.resolve({ id: 'doc-ar', number: 'INV-1', lines: [] })),
  },
  billingDocumentLine: { create: lineCreate, findMany: vi.fn(() => Promise.resolve([])) },
  billingDocumentSnapshot: { create: vi.fn(() => Promise.resolve({})) },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('../audit', () => ({ writeAuditLog: vi.fn(() => Promise.resolve()) }));
vi.mock('./billing-document-service', () => ({
  ISSUED_BILL_WHERE: {},
  recomputeTotals: vi.fn(() => Promise.resolve()),
}));
vi.mock('./billing-document-stage-service', () => ({
  snapshotIssuer: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('./record-numbers', () => ({
  nextBillingDocumentSeq: vi.fn(() => Promise.resolve(41)),
  formatBillingNumber: (prefix: string, seq: number) => `${prefix}${String(seq)}`,
}));
vi.mock('./billing-snapshot', () => ({ buildSnapshotPayload: vi.fn(() => ({})) }));

const { createOrderArDocument } = await import('./b2b-ar-service');

const CTX = { tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508', userId: 'u-doty' };

function raise(amount: number) {
  return createOrderArDocument(CTX, {
    companyId: WASATCH,
    propertyId: SITE,
    orderId: ORDER,
    amount,
    dueAt: new Date('2026-11-01T12:00:00Z'),
    description: 'Order O-000008',
  });
}

function writtenLines() {
  return lineCreate.mock.calls.map((call) => call[0].data);
}

beforeEach(() => {
  vi.clearAllMocks();
  convertedFrom = QUOTE;
});

describe('an invoice raised from a quote order', () => {
  it("carries every quote line with that line's own cost", async () => {
    await raise(QUOTE_TOTAL);
    const lines = writtenLines();
    expect(lines.map((l) => l.description)).toEqual([
      'Bosch Remanufactured Fuel Injector (0986435621)',
      'Install and test',
      'Shop supplies',
    ]);
    expect(lines.map((l) => l.costCents)).toEqual([41_250, 6_200, null]);
  });

  it('prices each line as the quote did, so its margin reads the same', async () => {
    await raise(QUOTE_TOTAL);
    const [part, labor] = writtenLines();
    expect(part).toMatchObject({ quantity: 1, unitPrice: 600, taxable: true, coreCharge: 150 });
    expect(labor).toMatchObject({ quantity: 2, unitPrice: 145, discountAmount: 0 });
  });

  it("takes the quote's tax rate and delivery, so the totals come to the order's", async () => {
    await raise(QUOTE_TOTAL);
    expect(docCreate.mock.calls[0]?.[0].data).toMatchObject({ taxRate: 0.0725, shippingTotal: 9 });
  });

  it('never turns a missing cost into $0', async () => {
    await raise(QUOTE_TOTAL);
    expect(writtenLines()[2]?.costCents).toBeNull();
  });
});

describe('the single order line it falls back to', () => {
  it('is used when the quote lines no longer add up to the order total', async () => {
    await raise(QUOTE_TOTAL + 10);
    const lines = writtenLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ description: 'Order O-000008', unitPrice: QUOTE_TOTAL + 10 });
    expect(lines[0]?.costCents ?? null).toBeNull();
  });

  it('is used for an order that did not come from a quote', async () => {
    convertedFrom = null;
    await raise(500);
    expect(writtenLines()).toHaveLength(1);
  });
});
