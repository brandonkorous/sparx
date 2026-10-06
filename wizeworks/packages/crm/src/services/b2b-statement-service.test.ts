import { beforeEach, describe, expect, it, vi } from 'vitest';

// The read behind a trade account's statement. The arithmetic is held by
// b2b-statement.test.ts; this holds WHICH rows reach it, because a statement
// that counted a quote as an invoice would ask a buyer to pay for something
// they never agreed to buy (the mistake issue 857 found in eight other reads).

const WASATCH = '8aa59a36-acc9-455f-b0ba-41c0b66292b9';
const CTX = { tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508', userId: 'u-doty' };

const AP_BILL_TO = {
  name: 'Wasatch Front Utility Contractors, LLC',
  email: 'ap@wasatchutility.test',
  address: 'Accounts Payable\n2275 S 900 W\nSuite 200\nSalt Lake City, UT 84119\nUS',
};

let account: Record<string, unknown> | null;
let bills: Record<string, unknown>[];
let contacts: { role: string; customer: Record<string, unknown> }[];

const billFindMany = vi.fn(() => Promise.resolve(bills));
const billFindFirst = vi.fn(() => Promise.resolve(bills[bills.length - 1] ?? null));

const tx = {
  company: { findFirst: vi.fn(() => Promise.resolve(account)) },
  billingDocument: { findMany: billFindMany, findFirst: billFindFirst },
  b2bAccountContact: { findMany: vi.fn(() => Promise.resolve(contacts)) },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('./business-clock', () => ({ businessTimeZone: vi.fn(() => Promise.resolve(null)) }));
vi.mock('../events', () => ({ publishCrmEvent: vi.fn(() => Promise.resolve()) }));
vi.mock('../audit', () => ({ writeAuditLog: vi.fn(() => Promise.resolve()) }));

const { buildAccountStatement, statementRecipients } = await import('./b2b-statement-service');
const { ISSUED_BILL_WHERE } = await import('./billing-document-service');
const { CrmNotFoundError } = await import('../errors');

beforeEach(() => {
  vi.clearAllMocks();
  // The default period ends "today"; pin today so the test means the same thing
  // next year.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-15T17:00:00Z'));
  account = {
    id: WASATCH,
    companyName: 'Wasatch Front Utility Contractors, LLC',
    paymentTerms: 'net30',
    creditLimit: 25000,
    status: 'active',
  };
  bills = [
    {
      id: 'inv-1',
      number: 'INV-000001',
      currency: 'USD',
      propertyId: 'site-trade-counter',
      createdAt: new Date('2026-10-02T18:13:19Z'),
      finalizedAt: new Date('2026-10-02T18:13:19Z'),
      dueAt: new Date('2026-11-01T19:13:19Z'),
      voidedAt: null,
      total: 678,
      metadata: { poNumber: 'WFUC-24-0823', source: 'b2b_order' },
      billTo: { name: 'Wasatch Front Utility Contractors, LLC' },
      payments: [],
    },
    {
      id: 'inv-3',
      number: 'INV-000003',
      currency: 'USD',
      propertyId: 'site-trade-counter',
      createdAt: new Date('2026-10-02T19:12:54Z'),
      finalizedAt: null,
      dueAt: new Date('2026-11-01T19:12:54Z'),
      voidedAt: null,
      total: 4075.6,
      metadata: { poNumber: 'WFUC-24-0817' },
      billTo: AP_BILL_TO,
      payments: [],
    },
  ];
  contacts = [
    {
      role: 'buyer',
      customer: {
        email: 'renee.castaneda@wasatchutility.test',
        firstName: 'Renée',
        lastName: 'Castañeda',
        addresses: [],
      },
    },
  ];
});

describe('the statement read', () => {
  it('asks only for issued bills on this account, never a quote, an estimate or a draft', async () => {
    await buildAccountStatement(CTX, { accountId: WASATCH, from: '2026-10-01', to: '2026-10-02' });
    const where = (billFindMany.mock.calls[0] as unknown as [{ where: Record<string, unknown> }])[0]
      .where;
    expect(where.companyId).toBe(WASATCH);
    expect(where.deletedAt).toBeNull();
    // The shared rule, spread rather than re-spelled: the workflow clause keeps
    // quotes and estimates out, the stage clause keeps drafts and voids out.
    expect(where.workflow).toEqual(ISSUED_BILL_WHERE.workflow);
    expect(where.stage).toEqual(ISSUED_BILL_WHERE.stage);
    expect(where.createdAt).toEqual({ lt: new Date('2026-10-03T00:00:00.000Z') });
  });

  it("carries the buyer's PO number from each bill onto its rows", async () => {
    const s = await buildAccountStatement(CTX, {
      accountId: WASATCH,
      from: '2026-10-01',
      to: '2026-10-02',
    });
    expect(s.rows.map((r) => [r.documentNumber, r.poNumber, r.chargeCents])).toEqual([
      ['INV-000001', 'WFUC-24-0823', 67800],
      ['INV-000003', 'WFUC-24-0817', 407560],
    ]);
    expect(s.closingCents).toBe(475360);
    expect(s.openItems.map((i) => i.poNumber)).toEqual(['WFUC-24-0823', 'WFUC-24-0817']);
  });

  it('addresses the statement where the latest invoice was billed, without its email', async () => {
    const s = await buildAccountStatement(CTX, { accountId: WASATCH, to: '2026-10-02' });
    expect(s.account.billingAddress).toEqual([
      'Accounts Payable',
      '2275 S 900 W',
      'Suite 200',
      'Salt Lake City, UT 84119',
      'US',
    ]);
    expect(s.account.paymentTermsWords).toBe('Pay within 30 days');
    expect(s.account.creditLimitCents).toBe(2500000);
    expect(s.issuerPropertyId).toBe('site-trade-counter');
    expect(s.period).toEqual({ from: '2026-10-01', to: '2026-10-02' });
  });

  it("heads the statement with the account's own name, and addresses it from a contact when no bill has an address", async () => {
    bills = [];
    contacts = [
      {
        role: 'primary_contact',
        customer: {
          email: 'ap@wasatchutility.test',
          firstName: 'Dale',
          lastName: 'Ivers',
          addresses: [
            {
              isDefault: true,
              line1: '2275 S 900 W',
              line2: 'Suite 200',
              city: 'Salt Lake City',
              region: 'UT',
              postalCode: '84119',
              country: 'US',
            },
          ],
        },
      },
    ];
    const s = await buildAccountStatement(CTX, { accountId: WASATCH, to: '2026-10-02' });
    expect(s.account.companyName).toBe('Wasatch Front Utility Contractors, LLC');
    expect(s.account.billingAddress).toContain('2275 S 900 W');
    expect(s.account.billingAddress).toContain('Suite 200');
  });

  it('says the account is not there rather than printing an empty statement', async () => {
    account = null;
    await expect(
      buildAccountStatement(CTX, { accountId: WASATCH, to: '2026-10-02' })
    ).rejects.toBeInstanceOf(CrmNotFoundError);
  });
});

describe('who a statement is emailed to', () => {
  it('sends to the main contact and to the address the latest invoice went to, once each', async () => {
    contacts = [
      {
        role: 'primary_contact',
        customer: { email: 'AP@wasatchutility.test', firstName: 'Dale', lastName: 'Ivers' },
      },
      {
        role: 'buyer',
        customer: {
          email: 'renee.castaneda@wasatchutility.test',
          firstName: 'Renée',
          lastName: null,
        },
      },
    ];
    const to = await statementRecipients(CTX, WASATCH);
    expect(to).toEqual([
      { email: 'AP@wasatchutility.test', name: 'Dale Ivers', reason: 'main_contact' },
    ]);
  });

  it('falls back to the people who order for the account when nobody else is on record', async () => {
    bills = [];
    const to = await statementRecipients(CTX, WASATCH);
    expect(to).toEqual([
      { email: 'renee.castaneda@wasatchutility.test', name: 'Renée Castañeda', reason: 'contact' },
    ]);
  });

  it('uses the invoice address alone when the account has no main contact', async () => {
    const to = await statementRecipients(CTX, WASATCH);
    expect(to).toEqual([
      {
        email: 'ap@wasatchutility.test',
        name: 'Wasatch Front Utility Contractors, LLC',
        reason: 'invoice_address',
      },
    ]);
  });
});
