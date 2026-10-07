// An invoice on terms knows the order it bills (sparx persona issue 084).
//
// The order-derived AR document kept the order only as `metadata.orderId`, so
// the order page, which lists invoices by the real `order_id` link, showed
// "You have not asked for the money on this order yet" over an order that had
// one, and offered to make a second. Measured on the dev database: 4 of 4
// order invoices had no link.

import { describe, expect, it, vi } from 'vitest';

const create = vi.fn((args: { data: Record<string, unknown> }) =>
  Promise.resolve({ id: 'inv-1', ...args.data })
);

// The people on the account, for a bill nobody else names an address for.
let contacts: unknown[] = [];

const tx = {
  company: {
    findUnique: vi.fn(() =>
      Promise.resolve({
        id: 'acct',
        companyName: 'Høgberg Diesel & Performance',
        paymentTerms: 'net30',
      })
    ),
  },
  documentWorkflow: {
    findUnique: vi.fn(() =>
      Promise.resolve({
        id: 'wf',
        stages: [
          { id: 'invoice', stageType: 'final', sortOrder: 0 },
          { id: 'paid', stageType: 'paid', sortOrder: 1 },
        ],
      })
    ),
  },
  order: {
    findUnique: vi.fn(() =>
      Promise.resolve({
        metadata: { poNumber: 'HDP-1188' },
        customer: { email: 'renee.castaneda@wasatchutility.test' },
        // A real order always carries its items; none here, so the invoice is
        // the single order line these tests read.
        shippingTotal: 0,
        surchargeTotal: 0,
        items: [],
      })
    ),
  },
  billingDocument: {
    create,
    findFirst: vi.fn((): Promise<{ billTo: unknown } | null> => Promise.resolve(null)),
    findUniqueOrThrow: vi.fn(() => Promise.resolve({ id: 'inv-1', lines: [] })),
  },
  billingDocumentLine: {
    create: vi.fn(() => Promise.resolve({})),
    findMany: vi.fn(() => Promise.resolve([])),
  },
  billingDocumentSnapshot: { create: vi.fn(() => Promise.resolve({})) },
  b2bAccountContact: { findMany: vi.fn(() => Promise.resolve(contacts)) },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('../../src/audit', () => ({ writeAuditLog: vi.fn(() => Promise.resolve()) }));
vi.mock('../../src/services/billing-document-service', () => ({
  ISSUED_BILL_WHERE: {},
  recomputeTotals: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../src/services/billing-snapshot', () => ({ buildSnapshotPayload: vi.fn(() => ({})) }));
vi.mock('../../src/services/billing-document-stage-service', () => ({
  snapshotIssuer: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('../../src/services/record-numbers', () => ({
  nextBillingDocumentSeq: vi.fn(() => Promise.resolve(5)),
  formatBillingNumber: (prefix: string, seq: number) => `${prefix}${String(seq).padStart(6, '0')}`,
}));

const { createOrderArDocument } = await import('../../src/services/b2b-ar-service');

const CTX = { tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508' };
const input = {
  companyId: 'acct',
  propertyId: 'site',
  amount: 13.84,
  dueAt: new Date('2026-11-01T00:00:00Z'),
};

describe('createOrderArDocument', () => {
  it('links the invoice to the order it bills', async () => {
    await createOrderArDocument(CTX, { ...input, orderId: 'order-9' });
    expect(create.mock.calls.at(-1)?.[0].data.orderId).toBe('order-9');
  });

  // The terms it was issued on, frozen with it and printed as "Net 30"
  // (sparx persona issue 103).
  it("freezes the account's terms onto the invoice, by order or by hand", async () => {
    await createOrderArDocument(CTX, { ...input, orderId: 'order-9' });
    expect(create.mock.calls.at(-1)?.[0].data.metadata).toMatchObject({
      poNumber: 'HDP-1188',
      paymentTerms: 'net30',
    });
    await createOrderArDocument(CTX, { ...input, orderId: null });
    expect(create.mock.calls.at(-1)?.[0].data.metadata).toMatchObject({ paymentTerms: 'net30' });
  });

  it('links nothing on an invoice raised by hand', async () => {
    await createOrderArDocument(CTX, { ...input, orderId: null });
    expect(create.mock.calls.at(-1)?.[0].data.orderId).toBeNull();
  });

  // Who it is made out to when the caller names nobody (sparx persona issue
  // 087): an invoice with only a company name could not be emailed, so every
  // checkout order on account failed "Invoice on terms: email it to the buyer".
  it('goes to the address the account’s last invoice went to', async () => {
    tx.billingDocument.findFirst.mockResolvedValueOnce({
      billTo: {
        name: 'Wasatch Front Utility Contractors, LLC',
        email: 'ap@wasatchutility.test',
        address: 'Accounts Payable, 2275 S 900 W',
      },
    });
    await createOrderArDocument(CTX, { ...input, orderId: 'order-9' });
    expect(create.mock.calls.at(-1)?.[0].data.billTo).toEqual({
      name: 'Høgberg Diesel & Performance',
      email: 'ap@wasatchutility.test',
      address: 'Accounts Payable, 2275 S 900 W',
    });
  });

  it('goes to whoever placed the order when the account has no invoice address yet', async () => {
    await createOrderArDocument(CTX, { ...input, orderId: 'order-9' });
    expect(create.mock.calls.at(-1)?.[0].data.billTo).toEqual({
      name: 'Høgberg Diesel & Performance',
      email: 'renee.castaneda@wasatchutility.test',
    });
  });

  // O'Malley Ranch's first bill on sparx, 4471, raised by hand: no earlier bill
  // and no order, so it went out to the company name alone and could not be
  // emailed, with Seamus O'Malley on the account as its buyer (issue 100).
  it("goes to the account's own buyer on a first bill raised by hand", async () => {
    contacts = [
      {
        role: 'buyer',
        customer: {
          email: 'seamus.omalley@omalleyranch.test',
          addresses: [
            {
              isDefault: true,
              line1: '4410 N Old Hwy 91',
              line2: null,
              city: 'Hyde Park',
              region: 'UT',
              postalCode: '84318',
              country: 'US',
            },
          ],
        },
      },
    ];
    await createOrderArDocument(CTX, { ...input, orderId: null });
    contacts = [];
    const billTo = create.mock.calls.at(-1)?.[0].data.billTo as Record<string, string>;
    expect(billTo.email).toBe('seamus.omalley@omalleyranch.test');
    expect(billTo.address).toContain('4410 N Old Hwy 91');
    expect(billTo.address).toContain('Hyde Park');
  });

  it('keeps a bill-to the caller gives, as a quote’s', async () => {
    const billTo = { name: 'Salt Lake County', email: 'dana@slcopw.test' };
    await createOrderArDocument(CTX, { ...input, orderId: 'order-9', billTo });
    expect(create.mock.calls.at(-1)?.[0].data.billTo).toEqual(billTo);
  });
});
