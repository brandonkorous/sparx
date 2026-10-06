import { describe, expect, it } from 'vitest';

import { TierBody, TierPatchBody } from './pricing-tiers';

// A price tier can be added without a note, and its note can be cleared (sparx
// persona issue 086). The tier pane sends an empty note as null, and the schema
// refused null, so every new tier without a note failed with "The problem is
// with Description".
describe('a price tier with no note', () => {
  it('can be added', () => {
    const body = TierBody.parse({
      name: 'Spring trial',
      description: null,
      discountType: 'percentage',
      discountValue: 7,
    });
    expect(body.description).toBeNull();
  });

  it('can have its note cleared', () => {
    expect(TierPatchBody.parse({ description: null }).description).toBeNull();
  });
});
