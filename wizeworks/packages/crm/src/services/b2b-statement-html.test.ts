import { describe, expect, it } from 'vitest';

import { computeStatement, statementPeriod } from './b2b-statement';
import { renderAccountStatementHtml } from './b2b-statement-html';
import type { AccountStatement } from './b2b-statement-service';

// The printed statement is the copy an accounts clerk files. What it must carry
// is what their ledger is keyed on: our invoice number AND their PO number, on
// every line, in the shop's own letterhead.

const period = statementPeriod(
  { from: '2026-10-01', to: '2026-10-31' },
  new Date('2026-11-02T12:00:00Z')
);

const figures = computeStatement(
  [
    {
      id: 'a',
      number: 'INV-000001',
      poNumber: 'WFUC-24-0823',
      issuedAt: new Date('2026-09-02T18:00:00Z'),
      dueAt: new Date('2026-10-02T18:00:00Z'),
      totalCents: 67800,
      voidedAt: null,
      payments: [],
    },
    {
      id: 'b',
      number: 'INV-000003',
      poNumber: '<WFUC-24-0817>',
      issuedAt: new Date('2026-10-02T19:00:00Z'),
      dueAt: new Date('2026-11-01T19:00:00Z'),
      totalCents: 407560,
      voidedAt: null,
      payments: [],
    },
  ],
  period
);

const statement: AccountStatement = {
  ...figures,
  account: {
    id: 'acct',
    companyName: 'Wasatch Front Utility Contractors, LLC',
    billingAddress: ['Accounts Payable', '2275 S 900 W', 'Salt Lake City, UT 84119'],
    paymentTerms: 'net30',
    paymentTermsWords: 'Pay within 30 days',
    creditLimitCents: 2500000,
    status: 'active',
  },
  period: { from: period.from, to: period.to },
  currency: 'USD',
  generatedAt: '2026-11-02T12:00:00.000Z',
  issuerPropertyId: null,
};

const BRAND = {
  businessName: 'Gillett Diesel Service',
  addressLines: ['410 W 2100 S', 'Salt Lake City, UT 84115'],
  primary: '#1F4E79',
};

describe('the printed statement', () => {
  const html = renderAccountStatementHtml(statement, BRAND);

  it("prints every invoice with the buyer's PO number beside it, escaped", () => {
    expect(html).toContain('INV-000001');
    expect(html).toContain('WFUC-24-0823');
    expect(html).toContain('&lt;WFUC-24-0817&gt;');
    expect(html).not.toContain('<WFUC-24-0817>');
  });

  it('is on the shop letterhead and names who it is for and when', () => {
    expect(html).toContain('Gillett Diesel Service');
    expect(html).toContain('410 W 2100 S');
    expect(html).toContain('Wasatch Front Utility Contractors, LLC');
    expect(html).toContain('Accounts Payable');
    expect(html).toContain('Oct 1, 2026 to Oct 31, 2026');
    expect(html).toContain('Pay within 30 days');
  });

  it('states the opening, the closing and what is late', () => {
    expect(html).toContain('Owed at the start');
    expect(html).toContain('$678.00');
    expect(html).toContain('$4,753.60');
    expect(html).toContain('29 days late');
    expect(html).toContain('1 to 30 days late');
  });

  it('draws a print button only on the screen copy that asks for one', () => {
    expect(html).not.toContain('window.print()');
    expect(renderAccountStatementHtml(statement, BRAND, { printButton: true })).toContain(
      'window.print()'
    );
  });

  it('leaks nothing half-rendered', () => {
    expect(html).not.toMatch(/\bundefined\b|\bNaN\b|\[object Object\]/);
  });
});
