// A line picked from the catalog keeps the product's NAME, so its badge still
// says which product it draws from when the quote is reopened. The name lived
// only in the editor's memory, and every reopened line read "Linked product"
// (sparx persona issue 085).

import { describe, expect, it } from 'vitest';

import { productLabelOf } from './line-price-note';
import { linkedProductBadge } from './product-pick';
import { lineMetadata } from './save';
import type { DraftLine } from './totals';

const INJECTOR = 'Bosch Remanufactured Fuel Injector (0986435621)';

function line(partial: Partial<DraftLine>): DraftLine {
  return {
    lineTypeId: null,
    description: INJECTOR,
    quantity: 6,
    unitPrice: 528,
    discountAmount: 0,
    taxable: true,
    ...partial,
  } as DraftLine;
}

describe('the product name kept with a line', () => {
  it('is saved with the line, beside the price note, and read back on reopen', () => {
    const saved = lineMetadata(
      line({
        productId: 'p-injector',
        productLabel: INJECTOR,
        priceNote: 'Fleet price: 15% off $621.18',
        metadata: { other: 'kept' },
      })
    ).metadata;
    expect(saved).toEqual({
      other: 'kept',
      priceNote: 'Fleet price: 15% off $621.18',
      productLabel: INJECTOR,
    });
    expect(productLabelOf(saved)).toBe(INJECTOR);
  });

  it('names the product on a reopened line whose description was changed', () => {
    const reopened = {
      productId: 'p-injector',
      productLabel: productLabelOf({ productLabel: INJECTOR }),
      description: 'Injector, cylinder 3',
    };
    expect(linkedProductBadge(reopened)).toBe(INJECTOR);
  });

  it('drops the name when the line no longer draws from a product', () => {
    const saved = lineMetadata(
      line({ productId: null, productLabel: INJECTOR, metadata: { productLabel: INJECTOR } })
    ).metadata;
    expect(saved).toEqual({});
  });

  it('sends nothing when neither the name nor the note was said', () => {
    expect(lineMetadata(line({ productId: 'p-injector' }))).toEqual({});
  });
});
