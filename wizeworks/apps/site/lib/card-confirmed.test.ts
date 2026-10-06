// A card held for an order that waits for sign-off answers `requires_capture`,
// not `succeeded` (sparx persona issue 087). The card form has to count that as
// the card saying yes, or a held order could never be placed.

import { describe, expect, it } from 'vitest';

import { cardConfirmed } from './checkout-client';

describe('cardConfirmed', () => {
  it('counts a held card as confirmed', () => {
    expect(cardConfirmed('requires_capture')).toBe(true);
  });

  it('counts a charge that went through, or is going through', () => {
    expect(cardConfirmed('succeeded')).toBe(true);
    expect(cardConfirmed('processing')).toBe(true);
  });

  it('counts no answer the way it always did', () => {
    expect(cardConfirmed(undefined)).toBe(true);
  });

  it('does not count a card that has not said yes', () => {
    expect(cardConfirmed('requires_payment_method')).toBe(false);
    expect(cardConfirmed('requires_action')).toBe(false);
    expect(cardConfirmed('canceled')).toBe(false);
  });
});
