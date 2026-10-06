// Sparx persona issue 087: a bought basket took edits. The server now refuses
// them with 410 `CART_ALREADY_BOUGHT`, and the site starts a fresh basket on
// exactly that answer and no other.

import { describe, expect, it } from 'vitest';

import { CART_ALREADY_BOUGHT, errorCodeOf, isBoughtCart, isBoughtCartError } from './bought-cart';

describe('a basket that was already bought', () => {
  it('is recognized by the status and the code together', () => {
    expect(isBoughtCart(410, CART_ALREADY_BOUGHT)).toBe(true);
  });

  it('is not read into another refusal', () => {
    // Out of stock is a 409 the shopper must hear about, not a basket to drop.
    expect(isBoughtCart(409, 'OUT_OF_STOCK')).toBe(false);
    expect(isBoughtCart(409, CART_ALREADY_BOUGHT)).toBe(false);
    expect(isBoughtCart(410, null)).toBe(false);
    expect(isBoughtCart(410, 'NOT_FOUND')).toBe(false);
  });

  it('is recognized on a thrown error that carries the answer', () => {
    expect(isBoughtCartError({ status: 410, code: CART_ALREADY_BOUGHT })).toBe(true);
    expect(isBoughtCartError({ status: 422, code: 'VALIDATION_ERROR' })).toBe(false);
    expect(isBoughtCartError(new Error('Something went wrong.'))).toBe(false);
    expect(isBoughtCartError(null)).toBe(false);
  });

  it('reads the code out of the error envelope', () => {
    expect(
      errorCodeOf({ success: false, error: { code: CART_ALREADY_BOUGHT, message: 'x' } })
    ).toBe(CART_ALREADY_BOUGHT);
    expect(errorCodeOf({ success: false })).toBeNull();
    expect(errorCodeOf(null)).toBeNull();
    expect(errorCodeOf('nope')).toBeNull();
  });
});
