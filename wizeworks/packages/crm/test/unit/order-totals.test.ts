// The order spine's money, and the one number it used to throw away.
//
// `discountTotal` was on CreateOrderInput from the start, validated as Money and
// defaulted to 0, and `computeTotals` had no parameter for it — so it was parsed
// and dropped. A storefront checkout quoting $129.20 wrote an order for $152.00,
// and an orders import read a discount column into nothing. Both callers passed
// it; neither was ever told it went nowhere (issue 298).

import { describe, expect, it } from 'vitest';
import type { LineItemInput } from '@wizeworks/crm-schemas';

import { computeLine, computeTotals } from '../../src/services/order-totals';

function line(overrides: Partial<LineItemInput> = {}): LineItemInput {
  return {
    sku: 'SKU-1',
    name: 'A thing',
    quantity: 1,
    unitPrice: 0,
    taxAmount: 0,
    discountAmount: 0,
    ...overrides,
  };
}

// Anneliese's basket, to the cent: a $110.00 trouser and a $42.00 tee, 15% off
// the core range, over the shop's $150 free-shipping line.
const TROUSER = line({ sku: 'SUNDAY-TROUS-M-INK', name: 'Sunday Trouser', unitPrice: 110 });
const TEE = line({ sku: 'THE-EVERYDAY-M-CLAY', name: 'The Everyday Tee', unitPrice: 42 });

describe('a header discount is honored', () => {
  it('takes the header discount off the total', () => {
    const totals = computeTotals([TROUSER, TEE], 0, undefined, 0, 22.8);

    expect(totals.subtotal).toBe(152);
    expect(totals.discountTotal).toBe(22.8);
    // The number on the button she pressed.
    expect(totals.total).toBe(129.2);
  });

  it('sums the lines when no header discount is given', () => {
    const totals = computeTotals(
      [
        { ...TROUSER, discountAmount: 16.5 },
        { ...TEE, discountAmount: 6.3 },
      ],
      0
    );

    expect(totals.discountTotal).toBe(22.8);
    expect(totals.total).toBe(129.2);
  });

  it('lets the header win over the lines rather than adding to them', () => {
    // Checkout sends both — the header it quoted, and the split it apportioned.
    // They agree by construction, and a total of $106.40 would mean it had
    // taken the saving twice.
    const totals = computeTotals(
      [
        { ...TROUSER, discountAmount: 16.5 },
        { ...TEE, discountAmount: 6.3 },
      ],
      0,
      undefined,
      0,
      22.8
    );

    expect(totals.total).toBe(129.2);
  });

  it('treats a header discount of zero as a real discount of nothing', () => {
    // Why the schema field is optional rather than defaulted: 0 has to be able
    // to mean "no saving on this order" without erasing line-level discounts,
    // and `undefined` is the only way to say "I am not answering this".
    const discounted = [{ ...TEE, discountAmount: 6.3 }];

    expect(computeTotals(discounted, 0, undefined, 0, 0).discountTotal).toBe(0);
    expect(computeTotals(discounted, 0).discountTotal).toBe(6.3);
  });
});

describe('the rest of the composition', () => {
  it('adds shipping and surcharge after the discount, and tax over the top', () => {
    const totals = computeTotals([TEE], 9, 3.15, 1.5, 6.3);

    // 42.00 − 6.30 + 3.15 + 9.00 + 1.50
    expect(totals.total).toBe(49.35);
  });

  it('lets a header tax override the sum of line taxes', () => {
    const totals = computeTotals([{ ...TEE, taxAmount: 1 }], 0, 3.15);

    expect(totals.taxTotal).toBe(3.15);
  });

  it('computes a line as subtotal minus discount plus tax', () => {
    const computed = computeLine({ ...TEE, quantity: 2, discountAmount: 6.3, taxAmount: 1.5 });

    expect(computed.lineSubtotal).toBe(84);
    expect(computed.lineTotal).toBe(79.2);
  });
});
