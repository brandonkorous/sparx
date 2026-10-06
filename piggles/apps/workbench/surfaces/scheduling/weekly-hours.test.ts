// The hours a day starts with when it is switched on. Issue 086.
//
// A diesel shop set Monday to 7:30 to 5:30, switched Tuesday on, and got 9 to 5,
// so the same two times were typed five times over. A day switched on now starts
// with the hours of the nearest open day before it in the week as the editor
// lists it (Monday first), or failing that the nearest one after it, and only
// with 9 to 5 when no day is open at all.

import { describe, expect, it } from 'vitest';

import { FALLBACK_BLOCK, hoursForNewDay, type HoursBlock, type WeekDraft } from './weekly-hours';

const SUN = 0;
const MON = 1;
const TUE = 2;
const WED = 3;
const FRI = 5;
const SAT = 6;

function block(start: string, end: string, validFrom = '', validTo = ''): HoursBlock {
  return { start, end, validFrom, validTo };
}

function week(days: Partial<Record<number, HoursBlock[]>>): WeekDraft {
  return { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], ...days };
}

describe('hoursForNewDay', () => {
  it('starts Tuesday with the hours just set on Monday', () => {
    const draft = week({ [MON]: [block('07:30', '17:30')] });
    expect(hoursForNewDay(draft, TUE)).toEqual([block('07:30', '17:30')]);
  });

  it('takes the NEAREST earlier open day, not the first one in the week', () => {
    const draft = week({
      [MON]: [block('07:30', '17:30')],
      [WED]: [block('10:00', '14:00')],
    });
    expect(hoursForNewDay(draft, FRI)).toEqual([block('10:00', '14:00')]);
  });

  it('reads the week Monday first, so Sunday follows Saturday', () => {
    const draft = week({
      [MON]: [block('07:30', '17:30')],
      [SAT]: [block('08:00', '12:00')],
    });
    expect(hoursForNewDay(draft, SUN)).toEqual([block('08:00', '12:00')]);
  });

  it('falls back to the nearest LATER open day when nothing earlier is open', () => {
    const draft = week({
      [WED]: [block('08:00', '16:00')],
      [FRI]: [block('06:00', '10:00')],
    });
    expect(hoursForNewDay(draft, MON)).toEqual([block('08:00', '16:00')]);
  });

  it('carries a split shift and its season dates whole', () => {
    const split = [
      block('08:00', '12:00', '2026-05-01', '2026-09-30'),
      block('13:00', '17:00', '2026-05-01', '2026-09-30'),
    ];
    const draft = week({ [MON]: split });
    expect(hoursForNewDay(draft, TUE)).toEqual(split);
  });

  it('hands back copies, so editing the new day leaves the old one alone', () => {
    const monday = [block('07:30', '17:30')];
    const draft = week({ [MON]: monday });
    const tuesday = hoursForNewDay(draft, TUE);
    expect(tuesday[0]).not.toBe(monday[0]);
  });

  it('is 9 to 5 when no day is open at all', () => {
    expect(hoursForNewDay(week({}), WED)).toEqual([FALLBACK_BLOCK]);
    expect(FALLBACK_BLOCK).toEqual(block('09:00', '17:00'));
  });
});
