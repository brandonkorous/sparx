// What the silica buy box's form asks the cart for. Each field the form posts is a
// choice the shopper made on the page, and a field dropped here is a choice silently
// thrown away.

import { describe, expect, it } from 'vitest';

import { addToCartRequest } from './add-to-cart-values';

describe('the buy box submit', () => {
  it('adds nothing without a variant', () => {
    // A product with no live variant posts `variantId=""`, and `required` is inert on
    // a hidden input, so this is the only thing that stops the add.
    expect(addToCartRequest({ variantId: '', quantity: '1' })).toBeNull();
  });

  it('pays the core deposit by default', () => {
    expect(addToCartRequest({ variantId: 'v1', quantity: '1', coreFirst: '' })).toMatchObject({
      variantId: 'v1',
      quantity: 1,
      coreFirst: false,
    });
    // A form stamped before the choice existed posts no field at all.
    expect(addToCartRequest({ variantId: 'v1' })?.coreFirst).toBe(false);
  });

  it('sends the old part first when the shopper chose to (issue 057)', () => {
    expect(addToCartRequest({ variantId: 'v1', quantity: '2', coreFirst: '1' })).toMatchObject({
      quantity: 2,
      coreFirst: true,
    });
  });

  it('keeps the schedule beside it (issue 739)', () => {
    const request = addToCartRequest({ variantId: 'v1', repeat: '1-month', coreFirst: '1' });
    expect(request?.repeat).toEqual({ intervalUnit: 'month', intervalCount: 1 });
    expect(request?.coreFirst).toBe(true);
  });
});
