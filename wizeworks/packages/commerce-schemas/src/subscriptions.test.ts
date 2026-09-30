import { describe, expect, it } from 'vitest';

import {
  monthlyOccurrenceFactor,
  nextOccurrenceAfter,
  repeatOrderMonthlyCents,
  repeatOrderYearlyUnits,
} from './subscriptions';

describe('monthlyOccurrenceFactor', () => {
  it('counts a monthly cadence once', () => {
    expect(monthlyOccurrenceFactor('month', 1)).toBe(1);
  });

  it('counts a quarterly cadence as a third of a month', () => {
    expect(monthlyOccurrenceFactor('month', 3)).toBeCloseTo(1 / 3);
  });

  it('spreads a year over twelve', () => {
    expect(monthlyOccurrenceFactor('year', 1)).toBeCloseTo(1 / 12);
  });

  it('fits more than four weeks into a month', () => {
    expect(monthlyOccurrenceFactor('week', 1)).toBeCloseTo(30 / 7);
  });

  it('refuses to invent a factor for a cadence it cannot read', () => {
    expect(monthlyOccurrenceFactor('fortnight', 1)).toBe(0);
    expect(monthlyOccurrenceFactor('month', 0)).toBe(0);
    expect(monthlyOccurrenceFactor('month', -2)).toBe(0);
  });
});

describe('repeatOrderMonthlyCents', () => {
  const monthly = {
    intervalUnit: 'month',
    intervalCount: 1,
    deliveriesPerCycle: 1,
  };

  it('is the line total on a monthly cadence', () => {
    expect(
      repeatOrderMonthlyCents({
        ...monthly,
        lines: [
          { unitPriceCents: 5800, quantity: 1 },
          { unitPriceCents: 12800, quantity: 2 },
        ],
      })
    ).toBe(31400);
  });

  it('is worth more every two weeks than every month', () => {
    const fortnightly = repeatOrderMonthlyCents({
      lines: [{ unitPriceCents: 5800, quantity: 1 }],
      intervalUnit: 'week',
      intervalCount: 2,
      deliveriesPerCycle: 1,
    });
    expect(fortnightly).toBe(12429);
    expect(fortnightly).toBeGreaterThan(5800);
  });

  it('is worth a twelfth of itself on a yearly membership', () => {
    expect(
      repeatOrderMonthlyCents({
        lines: [{ unitPriceCents: 12000, quantity: 1 }],
        intervalUnit: 'year',
        intervalCount: 1,
        deliveriesPerCycle: 1,
      })
    ).toBe(1000);
  });

  it('multiplies by how many go out per cycle', () => {
    expect(
      repeatOrderMonthlyCents({
        ...monthly,
        deliveriesPerCycle: 2,
        lines: [{ unitPriceCents: 5000, quantity: 1 }],
      })
    ).toBe(10000);
  });

  it('is zero for a cadence nobody can read, not a guess', () => {
    expect(
      repeatOrderMonthlyCents({
        lines: [{ unitPriceCents: 5800, quantity: 1 }],
        intervalUnit: 'fortnight',
        intervalCount: 1,
        deliveriesPerCycle: 1,
      })
    ).toBe(0);
  });

  it('never lets a negative price or quantity subtract from the total', () => {
    expect(
      repeatOrderMonthlyCents({
        ...monthly,
        lines: [
          { unitPriceCents: 5800, quantity: 1 },
          { unitPriceCents: -9900, quantity: 1 },
          { unitPriceCents: 1000, quantity: -3 },
        ],
      })
    ).toBe(5800);
  });

  it('is zero with nothing on it', () => {
    expect(repeatOrderMonthlyCents({ ...monthly, lines: [] })).toBe(0);
  });
});

describe('nextOccurrenceAfter', () => {
  const from = new Date('2026-09-19T10:00:00.000Z');

  it('adds a whole month', () => {
    expect(nextOccurrenceAfter(from, 'month', 1)?.toISOString()).toBe('2026-10-19T10:00:00.000Z');
  });

  it('adds weeks as seven days each', () => {
    expect(nextOccurrenceAfter(from, 'week', 2)?.toISOString()).toBe('2026-10-03T10:00:00.000Z');
  });

  it('adds days', () => {
    expect(nextOccurrenceAfter(from, 'day', 10)?.toISOString()).toBe('2026-09-29T10:00:00.000Z');
  });

  it('adds years', () => {
    expect(nextOccurrenceAfter(from, 'year', 1)?.toISOString()).toBe('2027-09-19T10:00:00.000Z');
  });

  it('leaves the date it was given alone', () => {
    const original = from.toISOString();
    nextOccurrenceAfter(from, 'month', 6);
    expect(from.toISOString()).toBe(original);
  });

  it('says it cannot say rather than returning the date it started from', () => {
    expect(nextOccurrenceAfter(from, 'fortnight', 1)).toBeNull();
  });
});

/**
 * A COUNT OF THINGS, which a month cannot hold.
 *
 * The product panel used `repeatOrderMonthlyCents` with a price of one to count
 * units, so every count was a rounded fraction: one every two months read as 1
 * a month, one every three months read as 0, and three quarterly subscribers
 * summed to nothing beside "3 customers have it on repeat right now".
 */
describe('repeatOrderYearlyUnits', () => {
  const order = (quantity: number, intervalUnit: string, intervalCount: number) => ({
    lines: [{ quantity }],
    intervalUnit,
    intervalCount,
    deliveriesPerCycle: 1,
  });

  it('counts a monthly order as twelve a year', () => {
    expect(repeatOrderYearlyUnits(order(1, 'month', 1))).toBe(12);
  });

  it('counts a two-monthly order as six, not as one a month', () => {
    expect(repeatOrderYearlyUnits(order(1, 'month', 2))).toBe(6);
  });

  it('counts a quarterly order as four, where a monthly figure reported none', () => {
    expect(repeatOrderYearlyUnits(order(1, 'month', 3))).toBe(4);
    // The shape that was shipped, for contrast: it rounds to nothing.
    expect(
      repeatOrderMonthlyCents({
        lines: [{ unitPriceCents: 1, quantity: 1 }],
        intervalUnit: 'month',
        intervalCount: 3,
        deliveriesPerCycle: 1,
      })
    ).toBe(0);
  });

  it('counts a yearly order as one, not as none', () => {
    expect(repeatOrderYearlyUnits(order(1, 'year', 1))).toBe(1);
  });

  it('multiplies by the quantity and by the deliveries in a cycle', () => {
    expect(repeatOrderYearlyUnits({ ...order(3, 'month', 1) })).toBe(36);
    expect(repeatOrderYearlyUnits({ ...order(1, 'month', 1), deliveriesPerCycle: 2 })).toBe(24);
  });

  it('is left UNROUNDED so a caller summing several rounds once at the end', () => {
    // Three quarterly subscribers: 4 + 4 + 4, never 0 + 0 + 0.
    const each = repeatOrderYearlyUnits(order(1, 'month', 3));
    expect(Math.round(each * 3)).toBe(12);
  });

  it('says nothing rather than guessing at a cadence it does not know', () => {
    expect(repeatOrderYearlyUnits(order(1, 'fortnight', 1))).toBe(0);
  });
});
