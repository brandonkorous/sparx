// See @sparx/crm-schemas' patch-semantics.test.ts for the full story: a
// `.default()` survives `.partial()`, so a PATCH body built from a create body
// fabricates values the caller never sent, and the route writes them. Here that
// meant renaming a wholesale pricing tier widened it from a few collections to
// ALL products and dropped its minimum order to $0 — handing every buyer on that
// tier a discount it was never meant to cover.

import { describe, expect, it } from 'vitest';

import { TierPatchBody } from './pricing-tiers';

describe('TierPatchBody', () => {
  it('parses an empty patch into an empty object', () => {
    expect(TierPatchBody.parse({})).toEqual({});
  });

  it('does not widen the product scope on a rename', () => {
    expect(TierPatchBody.parse({ name: 'Distributor' })).toEqual({ name: 'Distributor' });
  });

  it('still accepts an explicit scope change', () => {
    expect(TierPatchBody.parse({ productScope: 'all', minOrderCents: 0 })).toEqual({
      productScope: 'all',
      minOrderCents: 0,
    });
  });
});
