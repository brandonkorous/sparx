import { describe, expect, it } from 'vitest';

import {
  anySeason,
  hasSeason,
  seasonFromWire,
  seasonHelp,
  seasonToWire,
  seasonValid,
  withoutSeason,
  type SeasonBounds,
  type SeasonWire,
} from './season-window';

// The platform has always bounded a weekly window by two dates: the column, the
// writer, the availability engine and the MCP tool's own description all support
// it. The console's write shape did not, and the save REPLACES the whole week, so
// opening Availability and pressing Save deleted every seasonal bound on a screen
// that never showed one. Measured 2026-09-28: 0 of 236 stored windows carry a
// date, which is what a screen that cannot hold them produces (issue 866).

function bounds(validFrom: string, validTo: string): SeasonBounds {
  return { validFrom, validTo };
}

describe('whether a block is limited to part of the year', () => {
  it('counts either end on its own', () => {
    expect(hasSeason(bounds('', ''))).toBe(false);
    expect(hasSeason(bounds('2026-06-01', ''))).toBe(true);
    expect(hasSeason(bounds('', '2026-08-31'))).toBe(true);
    expect(hasSeason(bounds('2026-06-01', '2026-08-31'))).toBe(true);
  });

  it('opens the editor showing dates that are already stored', () => {
    // WHAT THE SWITCH READS. If this returned false for a week she set through
    // her assistant, the screen would hide the dates and then delete them on the
    // next save, which is the defect.
    expect(anySeason([bounds('', ''), bounds('', '2026-08-31')])).toBe(true);
    expect(anySeason([bounds('', ''), bounds('', '')])).toBe(false);
    expect(anySeason([])).toBe(false);
  });
});

describe('a range that can actually happen', () => {
  it('accepts one date alone, at either end', () => {
    expect(seasonValid(bounds('2026-06-01', ''))).toBe(true);
    expect(seasonValid(bounds('', '2026-08-31'))).toBe(true);
    expect(seasonValid(bounds('', ''))).toBe(true);
  });

  it('accepts a single day', () => {
    expect(seasonValid(bounds('2026-06-01', '2026-06-01'))).toBe(true);
  });

  it('refuses a range that runs backwards', () => {
    // The engine skips a day before `validFrom` and a day after `validTo`, so
    // this matches NOTHING: the block would be saved and silently never apply.
    expect(seasonValid(bounds('2026-08-31', '2026-06-01'))).toBe(false);
  });

  it('compares the days, not the digits it happens to start with', () => {
    // `YYYY-MM-DD` is fixed-width and big-endian, so a string compare is a day
    // compare. A parser that read the numbers in any other order would call
    // these backwards.
    expect(seasonValid(bounds('2026-09-01', '2026-10-01'))).toBe(true);
    expect(seasonValid(bounds('2026-12-31', '2027-01-01'))).toBe(true);
    expect(seasonValid(bounds('2027-01-01', '2026-12-31'))).toBe(false);
  });
});

describe('clearing the dates', () => {
  it('empties both ends and keeps everything else on the block', () => {
    const window = { start: '09:00', end: '17:00', validFrom: '2026-06-01', validTo: '2026-08-31' };
    expect(withoutSeason(window)).toEqual({
      start: '09:00',
      end: '17:00',
      validFrom: '',
      validTo: '',
    });
  });
});

describe('the sentence under the switch', () => {
  it('warns before Save removes dates she already has', () => {
    // THE WHOLE POINT. The screen used to do this silently. Turning the switch
    // off is now the one way to lose the dates, and it says so first.
    const warning = seasonHelp(false, true);
    expect(warning).toMatch(/remove the dates/);
    expect(seasonHelp(false, false)).not.toMatch(/remove/);
    expect(seasonHelp(true, true)).not.toMatch(/remove/);
  });

  it('says something in every state, with no em dash', () => {
    for (const seasonal of [true, false]) {
      for (const stored of [true, false]) {
        const line = seasonHelp(seasonal, stored);
        expect(line.trim().length).toBeGreaterThan(20);
        expect(line).not.toContain('\u2014');
      }
    }
  });
});

describe('the round trip the save used to lose', () => {
  it('carries both dates out to the wire and back unchanged', () => {
    // THE REGRESSION, held down. The console read the week from the server,
    // dropped the dates on the floor, and PUT the week back without them; the
    // server deletes every window before writing the ones it is handed, so the
    // seasonal bound was gone. Either direction losing a date reddens this.
    const cases: SeasonWire[] = [
      { validFrom: '2026-06-01', validTo: '2026-08-31' },
      { validFrom: '2026-06-01', validTo: null },
      { validFrom: null, validTo: '2026-08-31' },
      { validFrom: null, validTo: null },
    ];
    for (const wire of cases) {
      expect(seasonToWire(seasonFromWire(wire))).toEqual(wire);
    }
  });

  it('speaks the empty string to the control and null to the server', () => {
    // Two vocabularies for "no limit", and mixing them up is how an optional date
    // gets written as the string "null" or refused by the YYYY-MM-DD guard.
    expect(seasonFromWire({ validFrom: null, validTo: null })).toEqual({
      validFrom: '',
      validTo: '',
    });
    expect(seasonToWire({ validFrom: '', validTo: '' })).toEqual({
      validFrom: null,
      validTo: null,
    });
  });
});
