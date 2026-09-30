import { describe, expect, it } from 'vitest';
import { afterSent, cadenceSentence, zoneLabel } from './reporting-data';

/**
 * "SENT EVERY MONDAY AT 7AM." - EXCEPT IT WAS NOT 7AM, AND MONDAY WAS LOWERCASE.
 *
 * One sentence on the schedule form carried three faults at once:
 *
 *   1. it hid the time zone for `UTC` alone, and `UTC` is what the form
 *      defaulted to - so the one case where the hour is not the reader's hour
 *      was the one case it kept quiet about;
 *   2. the caller `.toLowerCase()`d the whole string to slot it after "Sent ",
 *      which lowercases a weekday and would lowercase a zone name too;
 *   3. the 21st, 22nd, 23rd and 31st of the month all read "the 21th".
 */
const LONDON = 'Europe/London';

const weekly = {
  cadence: 'weekly',
  dayOfWeek: 1,
  dayOfMonth: null,
  hour: 7,
  timezone: 'UTC',
};

describe('cadenceSentence', () => {
  it("names the zone when it is not the reader's own", () => {
    // A 7am UTC report lands at 8am in London for five months of the year.
    expect(cadenceSentence(weekly, LONDON)).toBe('Every Monday at 7am UTC');
  });

  it("stays quiet about the zone when it IS the reader's own", () => {
    expect(cadenceSentence({ ...weekly, timezone: LONDON }, LONDON)).toBe('Every Monday at 7am');
  });

  it('names a zone that is neither UTC nor hers', () => {
    expect(cadenceSentence({ ...weekly, timezone: 'America/New_York' }, LONDON)).toBe(
      'Every Monday at 7am New York time'
    );
  });

  it('counts the days of the month the way English does', () => {
    const monthly = { ...weekly, cadence: 'monthly', dayOfWeek: null, timezone: LONDON };
    const on = (d: number) => cadenceSentence({ ...monthly, dayOfMonth: d }, LONDON);
    expect(on(1)).toContain('the 1st');
    expect(on(2)).toContain('the 2nd');
    expect(on(3)).toContain('the 3rd');
    expect(on(4)).toContain('the 4th');
    expect(on(11)).toContain('the 11th');
    expect(on(12)).toContain('the 12th');
    expect(on(13)).toContain('the 13th');
    expect(on(21)).toContain('the 21st');
    expect(on(22)).toContain('the 22nd');
    expect(on(23)).toContain('the 23rd');
    expect(on(31)).toContain('the 31st');
  });

  it('says midnight and noon the way a person does', () => {
    const at = (h: number) => cadenceSentence({ ...weekly, hour: h, timezone: LONDON }, LONDON);
    expect(at(0)).toContain('at 12am');
    expect(at(12)).toContain('at 12pm');
    expect(at(13)).toContain('at 1pm');
  });
});

describe('afterSent', () => {
  it('lowers only the first letter, so Monday stays Monday', () => {
    expect(afterSent('Every Monday at 7am UTC')).toBe('every Monday at 7am UTC');
    expect(afterSent('On the 21st of each month at 7am New York time')).toBe(
      'on the 21st of each month at 7am New York time'
    );
  });
});

describe('zoneLabel', () => {
  it('says the place, not the database key', () => {
    expect(zoneLabel('Europe/London')).toBe('London time');
    expect(zoneLabel('America/New_York')).toBe('New York time');
    expect(zoneLabel('Australia/Sydney')).toBe('Sydney time');
    expect(zoneLabel('UTC')).toBe('UTC');
  });
});
