import { describe, expect, it } from 'vitest';

import {
  bandsWarning,
  carrierWarning,
  gapCount,
  weightGap,
  WHERE_TO_SET,
} from './weight-readiness';

/** Devi's own shop on the day this was found: every postable thing, no weight. */
const HERS = { shippableItems: 106, itemsMissingWeight: 106, assumedWeightGrams: 500 };

describe('weightGap', () => {
  it('says nothing when every weight is filled in', () => {
    expect(
      weightGap({ shippableItems: 106, itemsMissingWeight: 0, assumedWeightGrams: 500 })
    ).toBeNull();
  });

  it('says nothing when the shop posts nothing at all', () => {
    // A collect-only shop cannot be quoted wrong, so a warning here would be a
    // chore invented for somebody who does not owe it. The count must not be
    // trusted over the denominator: 0 postable means 0 to warn about.
    expect(
      weightGap({ shippableItems: 0, itemsMissingWeight: 0, assumedWeightGrams: 500 })
    ).toBeNull();
    expect(
      weightGap({ shippableItems: 0, itemsMissingWeight: 4, assumedWeightGrams: 500 })
    ).toBeNull();
  });

  it('reports the gap with its denominator', () => {
    const gap = weightGap({ shippableItems: 106, itemsMissingWeight: 23, assumedWeightGrams: 500 });
    expect(gap).not.toBeNull();
    expect(gap?.missing).toBe(23);
    expect(gap?.total).toBe(106);
    expect(gap?.everyItem).toBe(false);
  });

  it('knows when not one of them has a weight', () => {
    expect(weightGap(HERS)?.everyItem).toBe(true);
  });

  it('turns the assumed grams into the unit the bands are typed in', () => {
    expect(weightGap(HERS)?.assumed).toBe('0.5 kg');
    expect(
      weightGap({ shippableItems: 2, itemsMissingWeight: 1, assumedWeightGrams: 1000 })?.assumed
    ).toBe('1 kg');
    expect(
      weightGap({ shippableItems: 2, itemsMissingWeight: 1, assumedWeightGrams: 250 })?.assumed
    ).toBe('0.25 kg');
  });
});

describe('gapCount', () => {
  it('drops the denominator when every one is missing', () => {
    const gap = weightGap(HERS);
    expect(gap).not.toBeNull();
    // "106 of the 106" reads as though some are fine. They are not.
    if (gap) {
      expect(gapCount(gap)).toBe('Not one of the 106 things you sell has a weight recorded');
      expect(gapCount(gap)).not.toContain('106 of the 106');
    }
  });

  it('keeps the denominator when only some are missing', () => {
    const gap = weightGap({ shippableItems: 106, itemsMissingWeight: 23, assumedWeightGrams: 500 });
    if (gap) expect(gapCount(gap)).toBe('23 of the 106 things you sell have no weight recorded');
  });

  it('counts one thing as one thing', () => {
    const some = weightGap({ shippableItems: 9, itemsMissingWeight: 1, assumedWeightGrams: 500 });
    if (some) expect(gapCount(some)).toBe('1 of the 9 things you sell has no weight recorded');
    const only = weightGap({ shippableItems: 1, itemsMissingWeight: 1, assumedWeightGrams: 500 });
    if (only) expect(gapCount(only)).toBe('The one thing you sell has no weight recorded');
  });
});

describe('the two warnings', () => {
  it('says where to type the weight, in both', () => {
    const gap = weightGap(HERS);
    if (gap) {
      expect(bandsWarning(gap)).toContain(WHERE_TO_SET);
      expect(carrierWarning(gap)).toContain(WHERE_TO_SET);
    }
  });

  it('names the assumed weight rather than describing it vaguely', () => {
    const gap = weightGap(HERS);
    if (gap) {
      expect(bandsWarning(gap)).toContain('0.5 kg');
      expect(carrierWarning(gap)).toContain('0.5 kg');
    }
  });

  it('tells two different harms, because they are two different harms', () => {
    const gap = weightGap(HERS);
    if (gap) {
      // The bands harm is that the bands stop meaning anything.
      expect(bandsWarning(gap)).toContain('same band');
      // The carrier harm is money out of her pocket. Saying "same band" here
      // would describe the wrong problem to someone being under-charged.
      expect(carrierWarning(gap)).toContain('pay the difference');
      expect(carrierWarning(gap)).not.toContain('same band');
      expect(bandsWarning(gap)).not.toContain('pay the difference');
    }
  });

  it('never writes an em dash', () => {
    const gap = weightGap(HERS);
    if (gap) {
      expect(bandsWarning(gap)).not.toContain('—');
      expect(carrierWarning(gap)).not.toContain('—');
    }
  });
});
