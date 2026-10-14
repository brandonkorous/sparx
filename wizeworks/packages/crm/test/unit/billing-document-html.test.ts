// The default print renderer (docs/87 §10) — a pure function, so unit-tested
// directly: it formats money/quantities, escapes author text, omits zero rows,
// honours brand tokens, and surfaces the AR status + balance.

import { describe, expect, it } from 'vitest';

import {
  renderBillingDocumentHtml,
  withCoreRows,
  type BillingRenderData,
} from '../../src/services/billing-document-html';

function baseData(overrides: Partial<BillingRenderData> = {}): BillingRenderData {
  return {
    title: 'Invoice',
    number: 'INV-000123',
    status: 'unpaid',
    currency: 'USD',
    issuedAt: '2026-06-01T00:00:00.000Z',
    dueAt: null,
    validUntil: null,
    billTo: { heading: 'Bill to', name: 'Acme Co', lines: ['acme@example.com'] },
    shipTo: null,
    lines: [
      {
        typeLabel: 'Part',
        description: 'Fuel injector',
        quantity: 2,
        unitPrice: 150,
        amount: 300,
        taxable: true,
      },
    ],
    totals: {
      subtotal: 300,
      discountTotal: 0,
      taxTotal: 26.25,
      taxRate: 0.0875,
      shippingTotal: 0,
      surchargeTotal: 0,
      total: 326.25,
      depositTotal: 0,
      amountPaid: 0,
      balance: 326.25,
    },
    notes: null,
    ...overrides,
  };
}

describe('renderBillingDocumentHtml', () => {
  it('renders the title, number, party and a money-formatted line', () => {
    const html = renderBillingDocumentHtml(baseData());
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Invoice');
    expect(html).toContain('INV-000123');
    expect(html).toContain('Acme Co');
    expect(html).toContain('Fuel injector');
    expect(html).toContain('$150.00'); // unit price
    expect(html).toContain('$300.00'); // line total
    expect(html).toContain('$326.25'); // grand total / balance
  });

  // A business on account matches every invoice to its own purchase order
  // before it pays (sparx persona issue 077).
  it("prints the buyer's PO number beside the document number, and nothing without one", () => {
    const html = renderBillingDocumentHtml(baseData({ poNumber: 'WFUC-24-0817' }));
    expect(html).toContain('<span>PO number</span><strong>WFUC-24-0817</strong>');
    expect(renderBillingDocumentHtml(baseData())).not.toContain('PO number');
    expect(renderBillingDocumentHtml(baseData({ poNumber: '<b>x</b>' }))).toContain(
      '&lt;b&gt;x&lt;/b&gt;'
    );
  });

  // Salt Lake County is on Net 45, and Gillett's own footer said Net 30: the
  // bill states the account's terms itself (sparx persona issue 103).
  it('prints the terms beside the due date, on a bill only', () => {
    const html = renderBillingDocumentHtml(baseData({ paymentTerms: 'Net 45' }));
    expect(html).toContain('<span>Terms</span>Net 45');
    expect(renderBillingDocumentHtml(baseData())).not.toContain('<span>Terms</span>');
    expect(
      renderBillingDocumentHtml(baseData({ paymentTerms: 'Net 45', priceOffer: true }))
    ).not.toContain('<span>Terms</span>');
  });

  it('shows the tax row with its rate and the balance due', () => {
    const html = renderBillingDocumentHtml(baseData());
    expect(html).toContain('Tax (8.75%)');
    expect(html).toContain('Balance due');
  });

  it('omits discount / shipping / surcharge rows when zero', () => {
    const html = renderBillingDocumentHtml(baseData());
    expect(html).not.toContain('Discount');
    expect(html).not.toContain('Shipping');
    expect(html).not.toContain('Surcharge');
  });

  it('renders deposit and amount-paid as credits when present', () => {
    const html = renderBillingDocumentHtml(
      baseData({
        status: 'partial',
        totals: {
          subtotal: 300,
          discountTotal: 0,
          taxTotal: 0,
          taxRate: 0,
          shippingTotal: 0,
          surchargeTotal: 0,
          total: 300,
          depositTotal: 50,
          amountPaid: 100,
          balance: 200,
        },
      })
    );
    expect(html).toContain('Deposit');
    expect(html).toContain('Amount paid');
    expect(html).toContain('Partially paid');
    expect(html).toContain('$200.00'); // balance
  });

  it('escapes author/customer text so it cannot break out of the markup', () => {
    const html = renderBillingDocumentHtml(
      baseData({
        notes: '<script>alert(1)</script>',
        lines: [
          {
            typeLabel: null,
            description: 'Widget <b>&</b> "thing"',
            quantity: 1,
            unitPrice: 10,
            amount: 10,
            taxable: false,
          },
        ],
      })
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Widget &lt;b&gt;&amp;&lt;/b&gt; &quot;thing&quot;');
    expect(html).toContain('non-taxable');
  });

  it('formats fractional quantities (labor hours) without trailing zeros', () => {
    const html = renderBillingDocumentHtml(
      baseData({
        lines: [
          {
            typeLabel: 'Labor',
            description: 'Diagnostic',
            quantity: 2.5,
            unitPrice: 120,
            amount: 300,
            taxable: false,
          },
        ],
      })
    );
    expect(html).toContain('>2.5<');
  });

  it('falls back to the business name wordmark and sparx default brand', () => {
    const html = renderBillingDocumentHtml(baseData(), { businessName: 'Gillett Diesel' });
    expect(html).toContain('Gillett Diesel');
    expect(html).not.toContain('<img class="logo"');
  });

  it('renders the logo image when a logo URL is supplied', () => {
    const html = renderBillingDocumentHtml(baseData(), {
      businessName: 'Gillett Diesel',
      logoUrl: 'https://cdn.example.com/logo.png',
    });
    expect(html).toContain('<img class="logo" src="https://cdn.example.com/logo.png"');
  });

  it('renders an empty-state row when there are no lines', () => {
    const html = renderBillingDocumentHtml(baseData({ lines: [] }));
    expect(html).toContain('No line items.');
  });

  it('handles a non-USD currency', () => {
    const html = renderBillingDocumentHtml(
      baseData({
        currency: 'EUR',
        totals: {
          subtotal: 100,
          discountTotal: 0,
          taxTotal: 0,
          taxRate: 0,
          shippingTotal: 0,
          surchargeTotal: 0,
          total: 100,
          depositTotal: 0,
          amountPaid: 0,
          balance: 100,
        },
        lines: [
          {
            typeLabel: null,
            description: 'Service',
            quantity: 1,
            unitPrice: 100,
            amount: 100,
            taxable: false,
          },
        ],
      })
    );
    expect(html).toContain('€100.00'); // €100.00
  });
});

// Renée's invoice read "2 · $12.50 · $26.81": the row's amount had its sales tax
// added in, so the rows did not come to the Subtotal and the tax showed twice. The
// editor showed $25.00 (sparx persona issue 227).
describe('a printed row', () => {
  // A saved line, as the database holds it: both figures are there.
  const additive = {
    typeLabel: null,
    description: 'Stanadyne Diesel Fuel Additive (38565)',
    quantity: 2,
    unitPrice: 12.5,
    lineSubtotal: 25,
    lineTotal: 26.81,
    taxable: true,
    coreCharge: null,
  };

  it('is worth quantity times unit price, before tax', () => {
    const html = renderBillingDocumentHtml(
      baseData({
        lines: withCoreRows([additive]),
        totals: {
          subtotal: 25,
          discountTotal: 0,
          taxTotal: 1.81,
          taxRate: 0.0725,
          shippingTotal: 15,
          surchargeTotal: 0,
          total: 41.81,
          depositTotal: 0,
          amountPaid: 0,
          balance: 41.81,
        },
      })
    );
    const row = html.slice(html.indexOf('<tbody>'), html.indexOf('</tbody>'));
    expect(row).toContain('$25.00');
    expect(row).not.toContain('$26.81');
  });

  it("prints a core deposit's row at the deposit times the quantity", () => {
    const rows = withCoreRows([{ ...additive, coreCharge: 75 }]);
    expect(rows.map((r) => r.amount)).toEqual([25, 150]);
  });
});
