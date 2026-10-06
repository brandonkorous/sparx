// The wholesale group choice, shared by the Wholesale customer pane and the
// Customers company pane (sparx persona issue 086, finding 35).
//
// The company pane had a free-text "Wholesale price" box over a column nothing
// priced from, and showed a business with no group while the Wholesale pane
// showed it on Fleet at 12% off. Both now offer the same list, built here.

import { describe, expect, it } from 'vitest';
import type { TierChoice } from './accounts-data';
import { accountTierWords, tierChoiceItems } from './tier-choices';

const FLEET: TierChoice = {
  id: 'tier-fleet',
  name: 'Fleet',
  discountType: 'percentage',
  discountValue: 12,
};
const DEALER: TierChoice = {
  id: 'tier-dealer',
  name: 'Dealer',
  discountType: 'percentage',
  discountValue: 20,
};

describe('the wholesale group choices', () => {
  it('offers normal prices first, then each group with what it gives', () => {
    expect(tierChoiceItems([FLEET, DEALER], 'No group: normal prices')).toEqual([
      { value: '', label: 'No group: normal prices' },
      { value: 'tier-fleet', label: 'Fleet · 12% off' },
      { value: 'tier-dealer', label: 'Dealer · 20% off' },
    ]);
  });

  it('names the group they are in while the list is still loading', () => {
    const items = tierChoiceItems(undefined, 'No group: normal prices', {
      id: 'tier-fleet',
      name: 'Fleet',
    });
    expect(items).toContainEqual({ value: 'tier-fleet', label: 'Fleet' });
  });

  it('says a removed group no longer gives them anything', () => {
    const items = tierChoiceItems([DEALER], 'No group: normal prices', {
      id: 'tier-fleet',
      name: 'Fleet',
    });
    expect(items).toContainEqual({
      value: 'tier-fleet',
      label: 'Fleet (removed, so normal prices)',
    });
  });

  it('does not list the group twice when it is among the choices', () => {
    const items = tierChoiceItems([FLEET], 'No group: normal prices', {
      id: 'tier-fleet',
      name: 'Fleet',
    });
    expect(items.filter((item) => item.value === 'tier-fleet')).toHaveLength(1);
  });

  it('says a removed one plainly even before the list has loaded', () => {
    const items = tierChoiceItems(undefined, 'No group: normal prices', {
      id: 'tier-fleet',
      name: 'Fleet',
      removed: true,
    });
    expect(items).toContainEqual({
      value: 'tier-fleet',
      label: 'Fleet (removed, so normal prices)',
    });
  });

  it('names the removed one under the account name, never as if it applied', () => {
    expect(accountTierWords({ pricingTierName: 'Fleet', removedTierName: null })).toBe('Fleet');
    expect(accountTierWords({ pricingTierName: null, removedTierName: 'Fleet' })).toBe(
      'Fleet (removed, so normal prices)'
    );
    expect(accountTierWords({ pricingTierName: null, removedTierName: null })).toBeNull();
  });
});
