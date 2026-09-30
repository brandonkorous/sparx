// What a till line says about its own price. Issue 737.
//
// The till used to fill every line with the catalog's list price, so a shop
// with a signed agreement was quoted full retail at its own counter. The number
// is fixed in `sale-detail`; this is the sentence that makes the number
// readable, and the three shapes it takes.

import { describe, it, expect } from 'vitest';

import { priceNote } from './sale-price-note';
import type { SaleLine } from './sale-data';

function line(over: Partial<SaleLine> = {}): SaleLine {
  return {
    id: 'l_1',
    name: 'Marlow Knit · XL · Moss',
    quantity: 1,
    price: '52.00',
    sku: 'MARLOW-KNIT-XL-MOSS',
    productId: 'p1',
    variantId: 'v1',
    orderAheadDays: null,
    priceTouched: false,
    ...over,
  };
}

const AGREED = { unitPriceCents: 5200, listPriceCents: 9600, why: 'their agreed price' };

describe('priceNote', () => {
  it('says nothing at all on an ordinary line', () => {
    // No customer named yet, so no answer has been asked for.
    expect(priceNote(line())).toBeNull();
  });

  it('says nothing when the customer pays the normal price', () => {
    // The commonest line on the commonest sale. A till that explains every
    // normal price is a till nobody reads.
    expect(
      priceNote(
        line({
          price: '96.00',
          agreed: { unitPriceCents: 9600, listPriceCents: 9600, why: null },
        })
      )
    ).toBeNull();
  });

  it('names the rule and the price it beat', () => {
    const note = priceNote(line({ agreed: AGREED }));
    expect(note).toEqual({ text: 'Their agreed price · normally $96.00', typedOver: false });
  });

  it('starts with a capital even though the reason is stored lower case', () => {
    // Stored lower case so it reads inside a sentence. The first version put
    // "Their" in front of "Their agreed price" and printed it twice.
    const note = priceNote(
      line({
        price: '48.00',
        agreed: {
          unitPriceCents: 4800,
          listPriceCents: 9600,
          why: 'a bulk price at this quantity',
        },
      })
    );
    expect(note?.text).toBe('A bulk price at this quantity · normally $96.00');
  });

  it('warns when she has typed a different number, and never changes it', () => {
    const note = priceNote(line({ price: '80.00', priceTouched: true, agreed: AGREED }));
    expect(note).toEqual({
      text: 'You have typed $80.00. They pay $52.00, their agreed price.',
      typedOver: true,
    });
  });

  it('reads as a sentence when the engine gave no reason', () => {
    const note = priceNote(
      line({
        price: '80.00',
        priceTouched: true,
        agreed: { unitPriceCents: 5200, listPriceCents: 9600, why: null },
      })
    );
    expect(note?.text).toBe('You have typed $80.00. They pay $52.00.');
  });

  it('stops warning once she types the agreed number herself', () => {
    // Touched, but she has landed on their price. Nothing left to say.
    const note = priceNote(line({ price: '52.00', priceTouched: true, agreed: AGREED }));
    expect(note).toEqual({ text: 'Their agreed price · normally $96.00', typedOver: false });
  });

  it('treats an emptied price box as zero rather than as no opinion', () => {
    // She has cleared it to retype. Zero is what the sale would take, so zero
    // is what the warning has to say. `Number('')` is 0, which is right here
    // and is the sort of thing that is only right by accident, so it is pinned.
    const note = priceNote(line({ price: '', priceTouched: true, agreed: AGREED }));
    expect(note?.typedOver).toBe(true);
    expect(note?.text).toContain('You have typed $0.00');
  });

  it('says nothing on a hand-typed line, which has nothing to be priced', () => {
    expect(
      priceNote(line({ name: 'Alterations', variantId: null, productId: null, priceTouched: true }))
    ).toBeNull();
  });
});
