import { describe, expect, it } from 'vitest';

import {
  cadenceFromKey,
  cadenceKey,
  cadenceLabel,
  cadenceWords,
  ProductRepeatOptions,
  readRepeatOptions,
  REPEAT_CADENCE_CHOICES,
} from './repeat';

// The cadences a shopper may pick (issue 739). One set and one way of saying
// each, so a product page, a cart line and a confirmation never describe the
// same choice in different words.

describe('cadenceWords', () => {
  it('says one of a unit without a number, and more than one with it', () => {
    expect(cadenceWords({ intervalUnit: 'week', intervalCount: 1 })).toBe('every week');
    expect(cadenceWords({ intervalUnit: 'week', intervalCount: 2 })).toBe('every 2 weeks');
    expect(cadenceWords({ intervalUnit: 'month', intervalCount: 1 })).toBe('every month');
    expect(cadenceWords({ intervalUnit: 'month', intervalCount: 3 })).toBe('every 3 months');
  });

  it('capitalizes for the start of a sentence or a button', () => {
    expect(cadenceLabel({ intervalUnit: 'week', intervalCount: 4 })).toBe('Every 4 weeks');
  });
});

describe('cadence keys', () => {
  it('round-trips every offered cadence', () => {
    for (const choice of REPEAT_CADENCE_CHOICES) {
      expect(cadenceFromKey(cadenceKey(choice))).toEqual(choice);
    }
  });

  it('refuses a cadence that is not on offer', () => {
    expect(cadenceFromKey('3-week')).toBeNull();
    expect(cadenceFromKey('1-day')).toBeNull();
  });
});

describe('ProductRepeatOptions', () => {
  it('keeps the shown order and drops repeats, whatever order they were ticked in', () => {
    const parsed = ProductRepeatOptions.parse([
      { intervalUnit: 'month', intervalCount: 1 },
      { intervalUnit: 'week', intervalCount: 2 },
      { intervalUnit: 'month', intervalCount: 1 },
    ]);
    expect(parsed).toEqual([
      { intervalUnit: 'week', intervalCount: 2 },
      { intervalUnit: 'month', intervalCount: 1 },
    ]);
  });

  it('refuses a schedule the shop cannot offer', () => {
    expect(
      ProductRepeatOptions.safeParse([{ intervalUnit: 'week', intervalCount: 3 }]).success
    ).toBe(false);
  });

  it('accepts none, which is bought once only', () => {
    expect(ProductRepeatOptions.parse([])).toEqual([]);
  });
});

describe('readRepeatOptions', () => {
  it('drops anything in a stored row that is not an offered cadence', () => {
    expect(
      readRepeatOptions([
        { intervalUnit: 'month', intervalCount: 2 },
        { intervalUnit: 'day', intervalCount: 1 },
        'every week',
        null,
      ])
    ).toEqual([{ intervalUnit: 'month', intervalCount: 2 }]);
  });

  it('reads a missing or malformed column as once only', () => {
    expect(readRepeatOptions(null)).toEqual([]);
    expect(readRepeatOptions({ intervalUnit: 'week' })).toEqual([]);
  });
});
