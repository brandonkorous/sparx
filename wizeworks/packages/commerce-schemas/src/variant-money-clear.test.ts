// A version's cost and was-price: nothing, zero and "leave it" are three answers.
//
// The Pricing tab sends `costCents` and `compareAtPriceCents` on every save of a
// changed version. `variantService.update` writes each one whenever it is not
// `undefined`, so what reaches the service decides what is stored:
//
//   null       clears it: no cost on record, not on offer
//   0          a real zero: a part that cost nothing
//   absent     leaves whatever is stored alone
//
// For weeks the tab could not send the first two apart (sparx persona issue 086):
// it drew a missing cost as 0.00 and sent a typed 0 as null. The console now
// keeps them apart, and this holds the wire to the same three answers. Turning
// `.nullish()` back into `.optional()` on either field reddens the "clears"
// case, because a null would then be refused and nothing could be removed.

import { describe, expect, it } from 'vitest';

import { UpdateVariantInput } from './products';

describe('UpdateVariantInput, cost and was-price', () => {
  for (const field of ['costCents', 'compareAtPriceCents'] as const) {
    it(`${field}: null arrives as null, so the stored amount is cleared`, () => {
      const parsed = UpdateVariantInput.parse({ [field]: null });
      expect(field in parsed).toBe(true);
      expect(parsed[field]).toBeNull();
    });

    it(`${field}: 0 arrives as 0, a real zero rather than nothing`, () => {
      expect(UpdateVariantInput.parse({ [field]: 0 })[field]).toBe(0);
    });

    it(`${field}: left out arrives as undefined, so the stored amount is kept`, () => {
      expect(UpdateVariantInput.parse({ priceCents: 1200 })[field]).toBeUndefined();
    });
  }

  it('the Pricing tab body for a version with no cost and a zero was-price', () => {
    const parsed = UpdateVariantInput.parse({
      priceCents: 4500,
      compareAtPriceCents: 0,
      costCents: null,
    });
    expect(parsed).toMatchObject({ priceCents: 4500, compareAtPriceCents: 0, costCents: null });
  });
});
