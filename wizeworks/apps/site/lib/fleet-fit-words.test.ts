// What the shop tells a trade buyer about a part and their fleet (sparx persona
// issue 086). The rule with teeth: a part with NO fitment data says nothing,
// because "we do not know" printed as "does not fit" tells a buyer a bag of shop
// rags does not fit their trucks.

import { describe, expect, it } from 'vitest';

import { fleetFitBadge, fleetFitNotice } from './fleet-fit-words';

const unit12 = { id: 'v-12', label: 'Unit 12, 2019 Ram 3500 6.7L Cummins' };

describe('the card badge', () => {
  it('says a fitting part fits', () => {
    expect(fleetFitBadge({ fits: true, vehicles: [unit12] })).toEqual({
      color: 'success',
      text: 'Fits your fleet',
    });
  });

  it('warns on a part that fits none of the vehicles', () => {
    expect(fleetFitBadge({ fits: false, vehicles: [] })).toEqual({
      color: 'warning',
      text: 'Does not fit your fleet',
    });
  });

  it('says nothing about a part with no fitment data, or to a shopper with no fleet', () => {
    expect(fleetFitBadge(null)).toBeNull();
    expect(fleetFitBadge(undefined)).toBeNull();
  });
});

describe('the product page', () => {
  it('names the vehicles it fits', () => {
    expect(fleetFitNotice({ fits: true, vehicles: [unit12] })).toEqual({
      color: 'success',
      text: 'Fits Unit 12, 2019 Ram 3500 6.7L Cummins.',
    });
  });

  it('warns, and still lets them buy, when it fits none of them', () => {
    const notice = fleetFitNotice({ fits: false, vehicles: [] });
    expect(notice?.color).toBe('warning');
    expect(notice?.text).toContain('does not fit any vehicle in your fleet');
    expect(notice?.text).toContain('You can still buy it.');
  });

  it('says nothing about a part with no fitment data', () => {
    expect(fleetFitNotice(null)).toBeNull();
  });
});
