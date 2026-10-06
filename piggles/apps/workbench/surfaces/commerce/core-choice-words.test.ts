// Today's price beside tomorrow's, on every product that moves (issue 057).

import type { CoreChoiceCandidate } from '@wizeworks/commerce-schemas';
import { describe, expect, it } from 'vitest';

import {
  blockedBy,
  changeFor,
  priceShift,
  rowState,
  startingDraft,
  whatHappens,
} from './core-choice-words';

function candidate(over: Partial<CoreChoiceCandidate>): CoreChoiceCandidate {
  return {
    productId: 'p-1',
    title: 'Bosch injector 0986435621',
    optionName: 'Core Charge',
    depositLabel: 'Accept Core Charge (+$150)',
    firstLabel: 'Defer Core Charge',
    keptVariantId: 'v-1',
    keptSku: '0986435621',
    retiredVariantIds: ['v-2'],
    groups: 1,
    depositSidePriceCents: 73015,
    firstSidePriceCents: 60000,
    suggestedPartPriceCents: 60000,
    suggestedCoreChargeCents: 15000,
    currency: 'USD',
    problem: null,
    ...over,
  };
}

describe('a core charge set up as a choice', () => {
  it('calls out a ship-now price that the words do not add up to', () => {
    const doty = candidate({});
    expect(priceShift(doty, startingDraft(doty))).toBe(
      'Today a buyer who ships now pays $730.15. After: $600.00 + $150.00 deposit.'
    );
    expect(rowState(doty, startingDraft(doty))).toEqual({ label: 'Price changes', tone: 'info' });
  });

  it('says nothing when today already matches the words', () => {
    const even = candidate({ depositSidePriceCents: 75000 });
    expect(priceShift(even, startingDraft(even))).toBeNull();
    expect(rowState(even, startingDraft(even)).tone).toBe('success');
  });

  it('asks for the deposit when the words name no amount', () => {
    const bare = candidate({ depositLabel: 'Ship now', suggestedCoreChargeCents: null });
    expect(blockedBy(bare, startingDraft(bare))).toBe(
      '“Ship now” names no amount, so type the core deposit.'
    );
    expect(rowState(bare, startingDraft(bare)).label).toBe('Needs a deposit amount');
  });
});

describe('what is sent for a core charge choice', () => {
  it('sends no single part price for a product that keeps one per version', () => {
    const sized = candidate({ groups: 3, retiredVariantIds: ['a', 'b', 'c'] });
    expect(changeFor(sized, startingDraft(sized))).toEqual({
      productId: 'p-1',
      coreChargeCents: 15000,
      offerCoreFirst: true,
    });
    expect(whatHappens(sized, startingDraft(sized))).toContain('each of its 3 versions');
  });

  it('sends the typed prices and the send-first choice', () => {
    const doty = candidate({});
    expect(
      changeFor(doty, { ...startingDraft(doty), depositCents: 13015, offerFirst: false })
    ).toEqual({
      productId: 'p-1',
      partPriceCents: 60000,
      coreChargeCents: 13015,
      offerCoreFirst: false,
    });
  });

  it('holds a product the reader could not place, in its own words', () => {
    const odd = candidate({ problem: 'It has 2 choices about the core. Change it by hand.' });
    expect(blockedBy(odd, startingDraft(odd))).toBe(
      'It has 2 choices about the core. Change it by hand.'
    );
  });
});
