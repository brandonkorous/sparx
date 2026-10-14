// What returned units cost the buyer (sparx persona issue 231).
//
// Brynn O'Hara-Løvdal paid $1,287.00 for two injectors, $1,200.00 and $87.00 of
// Utah tax, and sent one back. The refund was worked out as $600.00, keeping the
// $43.50 of tax she paid on it.

import { describe, expect, it } from 'vitest';

import { paidForUnits, paidLine } from './return-paid';

describe('paidForUnits', () => {
  const injectors = paidLine({ quantity: 2, lineSubtotal: 1200, discountAmount: 0, taxAmount: 87 });

  it('is the price and the sales tax on the units sent back', () => {
    expect(paidForUnits(injectors, 1)).toEqual({ goodsCents: 60_000, taxCents: 4_350 });
  });

  it('is the whole line for every unit', () => {
    expect(paidForUnits(injectors, 2)).toEqual({ goodsCents: 120_000, taxCents: 8_700 });
  });

  it('takes the line discount off', () => {
    // A $42.00 jacket at 15% off, $35.70, with $2.59 of tax.
    const jacket = paidLine({
      quantity: 1,
      lineSubtotal: 42,
      discountAmount: 6.3,
      taxAmount: 2.59,
    });
    expect(paidForUnits(jacket, 1)).toEqual({ goodsCents: 3_570, taxCents: 259 });
  });

  it('is nothing for no units, and never more than the line', () => {
    expect(paidForUnits(injectors, 0)).toEqual({ goodsCents: 0, taxCents: 0 });
    expect(paidForUnits(injectors, 5)).toEqual({ goodsCents: 120_000, taxCents: 8_700 });
  });

  it('reads a line with no tax as no tax', () => {
    const exempt = paidLine({ quantity: 3, lineSubtotal: 13.84, discountAmount: 0, taxAmount: 0 });
    expect(paidForUnits(exempt, 1)).toEqual({ goodsCents: 461, taxCents: 0 });
  });
});
