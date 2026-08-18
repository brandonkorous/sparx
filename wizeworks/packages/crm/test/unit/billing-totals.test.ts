// Billing-document totals — per-line `taxable` × document `taxRate` (docs/87 §7).
// The distinguishing behavior vs orders/quotes: parts are taxed while labor is
// not, on the same document, and tax is charged on the post-discount amount.

import { describe, expect, it } from 'vitest';

import { computeBillingLine, computeBillingTotals } from '../../src/services/billing-totals';

describe('computeBillingLine', () => {
  it('taxes a taxable line on quantity × unitPrice', () => {
    const r = computeBillingLine(
      { quantity: 2, unitPrice: 50, discountAmount: 0, taxable: true },
      0.08
    );
    expect(r).toEqual({ lineSubtotal: 100, discountAmount: 0, taxAmount: 8, lineTotal: 108 });
  });

  it('never taxes a non-taxable line (labor)', () => {
    const r = computeBillingLine(
      { quantity: 1.5, unitPrice: 120, discountAmount: 0, taxable: false },
      0.08
    );
    expect(r).toEqual({ lineSubtotal: 180, discountAmount: 0, taxAmount: 0, lineTotal: 180 });
  });

  it('charges tax on the post-discount amount', () => {
    const r = computeBillingLine(
      { quantity: 1, unitPrice: 100, discountAmount: 20, taxable: true },
      0.1
    );
    expect(r).toEqual({ lineSubtotal: 100, discountAmount: 20, taxAmount: 8, lineTotal: 88 });
  });

  it('rounds fractional labor hours cleanly', () => {
    const r = computeBillingLine(
      { quantity: 2.5, unitPrice: 95, discountAmount: 0, taxable: false },
      0.0875
    );
    expect(r.lineSubtotal).toBe(237.5);
    expect(r.lineTotal).toBe(237.5);
  });
});

describe('computeBillingTotals', () => {
  it('taxes only the taxable lines and adds shipping + surcharge last', () => {
    const totals = computeBillingTotals(
      [
        { quantity: 2, unitPrice: 50, discountAmount: 0, taxable: true }, // part: 100, tax 8
        { quantity: 1.5, unitPrice: 120, discountAmount: 0, taxable: false }, // labor: 180, no tax
      ],
      0.08,
      15, // shipping
      5 // surcharge
    );
    expect(totals).toEqual({
      subtotal: 280,
      discountTotal: 0,
      taxTotal: 8,
      shippingTotal: 15,
      surchargeTotal: 5,
      total: 308,
    });
  });

  it('subtracts discounts before tax and from the grand total', () => {
    const totals = computeBillingTotals(
      [{ quantity: 1, unitPrice: 200, discountAmount: 50, taxable: true }],
      0.1
    );
    // subtotal 200, discount 50, taxBase 150 → tax 15, total 200 - 50 + 15 = 165
    expect(totals.subtotal).toBe(200);
    expect(totals.discountTotal).toBe(50);
    expect(totals.taxTotal).toBe(15);
    expect(totals.total).toBe(165);
  });

  it('is zero across the board for an empty document', () => {
    const totals = computeBillingTotals([], 0.08);
    expect(totals).toEqual({
      subtotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      shippingTotal: 0,
      surchargeTotal: 0,
      total: 0,
    });
  });
});
