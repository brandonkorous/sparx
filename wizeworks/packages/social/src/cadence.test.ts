import { describe, expect, it } from 'vitest';

import {
  describeSlot,
  nextSlotOccurrence,
  slotOccurrences,
  wallTimeToInstant,
  zonedDateParts,
  zoneOffsetMs,
} from './cadence.js';

// The whole point of this module is that a posting slot is a recurring LOCAL time, not a
// timestamp — "Tuesdays at 9" has to stay 9am when the clocks change. These tests are
// mostly about that one property, because it is the only part that is easy to get wrong
// and impossible to notice: a slot that quietly fires at 8am for half the year still
// looks correct in every UI.

describe('zoneOffsetMs', () => {
  it('is zero for UTC', () => {
    expect(zoneOffsetMs(new Date('2026-07-01T12:00:00Z'), 'UTC')).toBe(0);
  });

  it('tracks daylight saving in a zone that observes it', () => {
    // Denver is UTC-7 in summer, UTC-6 in winter.
    const summer = zoneOffsetMs(new Date('2026-07-01T12:00:00Z'), 'America/Denver');
    const winter = zoneOffsetMs(new Date('2026-01-01T12:00:00Z'), 'America/Denver');
    expect(summer).toBe(-6 * 60 * 60 * 1000);
    expect(winter).toBe(-7 * 60 * 60 * 1000);
  });
});

describe('wallTimeToInstant', () => {
  it('resolves a UTC wall time to itself', () => {
    const instant = wallTimeToInstant(2026, 7, 14, 9 * 60, 'UTC');
    expect(instant.toISOString()).toBe('2026-07-14T09:00:00.000Z');
  });

  it('resolves the same wall time to different instants either side of a DST change', () => {
    // 9am local on both dates — but the UTC instants are an hour apart, which is exactly
    // the behaviour that keeps a 9am slot at 9am.
    const summer = wallTimeToInstant(2026, 7, 14, 9 * 60, 'America/Denver');
    const winter = wallTimeToInstant(2026, 1, 13, 9 * 60, 'America/Denver');
    expect(summer.toISOString()).toBe('2026-07-14T15:00:00.000Z');
    expect(winter.toISOString()).toBe('2026-01-13T16:00:00.000Z');
  });
});

describe('zonedDateParts', () => {
  it('reads the local date and weekday, not the UTC one', () => {
    // 01:00 UTC on the 15th is still the 14th, late evening, in Denver.
    const parts = zonedDateParts(new Date('2026-07-15T01:00:00Z'), 'America/Denver');
    expect(parts).toMatchObject({ year: 2026, month: 7, day: 14 });
    expect(parts.weekday).toBe(2); // Tuesday
  });
});

describe('slotOccurrences', () => {
  const tuesdayAt9 = { weekday: 2, minuteOfDay: 9 * 60, timezone: 'UTC' };

  it('finds one occurrence per week within the window', () => {
    const from = new Date('2026-07-01T00:00:00Z'); // a Wednesday
    const hits = slotOccurrences(tuesdayAt9, from, 21);
    expect(hits).toHaveLength(3);
    expect(hits.map((d) => d.toISOString())).toEqual([
      '2026-07-07T09:00:00.000Z',
      '2026-07-14T09:00:00.000Z',
      '2026-07-21T09:00:00.000Z',
    ]);
  });

  it('never returns an occurrence in the past', () => {
    // Starting AFTER Tuesday 9am, that same Tuesday must not come back.
    const from = new Date('2026-07-07T10:00:00Z');
    const [first] = slotOccurrences(tuesdayAt9, from, 14);
    expect(first?.toISOString()).toBe('2026-07-14T09:00:00.000Z');
  });

  it('keeps a local hour steady across a DST boundary', () => {
    // The US spring-forward is 2026-03-08. A Sunday 10am slot must stay 10am local on
    // both sides of it, which means the UTC instants differ by an hour.
    const sundayAt10 = { weekday: 0, minuteOfDay: 10 * 60, timezone: 'America/Denver' };
    const hits = slotOccurrences(sundayAt10, new Date('2026-03-01T00:00:00Z'), 14);
    const local = hits.map((d) =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Denver',
        hour: '2-digit',
        hour12: false,
      }).format(d)
    );
    expect(local.every((h) => h === '10')).toBe(true);
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it('returns nothing when the window is shorter than the gap to the next hit', () => {
    const from = new Date('2026-07-08T00:00:00Z'); // Wednesday
    expect(slotOccurrences(tuesdayAt9, from, 2)).toEqual([]);
  });
});

describe('nextSlotOccurrence', () => {
  it('is the first of the occurrences', () => {
    const slot = { weekday: 5, minuteOfDay: 17 * 60 + 30, timezone: 'UTC' };
    const next = nextSlotOccurrence(slot, new Date('2026-07-01T00:00:00Z'));
    expect(next?.toISOString()).toBe('2026-07-03T17:30:00.000Z');
  });

  it('is null when nothing lands inside the window', () => {
    const slot = { weekday: 5, minuteOfDay: 0, timezone: 'UTC' };
    expect(nextSlotOccurrence(slot, new Date('2026-07-04T00:00:00Z'), 3)).toBeNull();
  });
});

describe('describeSlot', () => {
  it('reads as a sentence a person would say', () => {
    expect(describeSlot({ weekday: 2, minuteOfDay: 9 * 60, timezone: 'UTC' }, 'en-US')).toBe(
      'Tuesdays at 9:00 AM'
    );
  });
});
