// Opening hours in the words a person would use (persona issue 268): the
// summary read "Mon 09:00–17:00, … (America/Denver)" over a form showing 5:00 PM.

import { describe, expect, it } from 'vitest';

import { describeHours } from './business-hours-words';

const weekday = (day: number) => ({ day, startMinute: 9 * 60, endMinute: 17 * 60 });
const DENVER = 'America/Denver';

describe('opening hours, said out loud', () => {
  it('runs the same days together, on a twelve-hour clock, in the zone by name', () => {
    const hours = [1, 2, 3, 4, 5].map(weekday);
    expect(describeHours({ businessHours: hours, timezone: DENVER })).toBe(
      'Mon–Fri, 9:00am–5:00pm, Mountain time'
    );
  });

  it('keeps a day with different hours apart', () => {
    const hours = [
      ...[1, 2, 3, 4, 5].map(weekday),
      { day: 6, startMinute: 8 * 60, endMinute: 12 * 60 },
    ];
    expect(describeHours({ businessHours: hours, timezone: DENVER })).toBe(
      'Mon–Fri, 9:00am–5:00pm; Sat, 8:00am–noon, Mountain time'
    );
  });

  it('says a desk that never closes', () => {
    expect(describeHours({ businessHours: [], timezone: DENVER })).toBe(
      'Open at all hours, Mountain time'
    );
  });

  it('names a single day alone and a split day in full', () => {
    const hours = [
      { day: 2, startMinute: 9 * 60, endMinute: 12 * 60 },
      { day: 2, startMinute: 13 * 60, endMinute: 17 * 60 },
    ];
    expect(describeHours({ businessHours: hours, timezone: DENVER })).toBe(
      'Tue, 9:00am–noon and 1:00pm–5:00pm, Mountain time'
    );
  });
});
