// A booking's time box reads and writes the BUSINESS's clock, never this
// computer's (sparx persona issue 086).
//
// Renée booked a Diesel oil change for Saturday, October 3, 2026 at 9:00 AM in
// Salt Lake City (stored 15:00 UTC). The booking pane's header said 9:00 AM; its
// "Move it" box said 08:00 AM, because the console was open on a computer set to
// Pacific time and the box was a browser datetime-local field, which only knows
// the computer's zone. Moving the booking from there would have moved it to the
// wrong hour without a word.
//
// Every expectation below holds whatever zone the machine running the test is
// in. The old conversion only passed on a machine set to Mountain time.

import { describe, expect, it } from 'vitest';

import {
  dayEndIn,
  dayIn,
  dayStartIn,
  instantFromWall,
  wallClockHint,
  wallProblem,
  wallValue,
  zoneWords,
} from './wall-clock';

const DENVER = 'America/Denver';

describe('the box shows the time on the business clock', () => {
  it('shows the booking at 9:00 AM in Salt Lake City, wherever the computer is', () => {
    expect(wallValue('2026-10-03T15:00:00.000Z', DENVER)).toBe('2026-10-03T09:00');
  });

  it('shows nothing for no time, or for something that is not a time', () => {
    expect(wallValue(null, DENVER)).toBe('');
    expect(wallValue('', DENVER)).toBe('');
    expect(wallValue('not a date', DENVER)).toBe('');
  });

  it('reads a half-hour zone correctly', () => {
    expect(wallValue('2026-10-03T03:30:00.000Z', 'Asia/Kolkata')).toBe('2026-10-03T09:00');
  });
});

describe('what is typed is read on the business clock', () => {
  it('saves 9:00 AM Mountain as 15:00 UTC in October', () => {
    expect(instantFromWall('2026-10-03T09:00', DENVER)).toBe('2026-10-03T15:00:00.000Z');
  });

  it('saves 9:00 AM Mountain as 16:00 UTC in winter', () => {
    expect(instantFromWall('2026-12-05T09:00', DENVER)).toBe('2026-12-05T16:00:00.000Z');
  });

  it('refuses an empty box and a year with too many digits', () => {
    expect(instantFromWall('', DENVER)).toBeNull();
    expect(instantFromWall('20266-10-03T09:00', DENVER)).toBeNull();
    expect(instantFromWall('2026-02-30T09:00', DENVER)).toBeNull();
  });
});

describe('across a clock change', () => {
  it('keeps 9:00 AM the day before, and the day after, the clocks go forward', () => {
    expect(instantFromWall('2026-03-07T09:00', DENVER)).toBe('2026-03-07T16:00:00.000Z');
    expect(instantFromWall('2026-03-09T09:00', DENVER)).toBe('2026-03-09T15:00:00.000Z');
  });

  it('keeps 9:00 AM the day before, and the day after, the clocks go back', () => {
    expect(instantFromWall('2026-10-31T09:00', DENVER)).toBe('2026-10-31T15:00:00.000Z');
    expect(instantFromWall('2026-11-02T09:00', DENVER)).toBe('2026-11-02T16:00:00.000Z');
  });

  it('round-trips every half hour of both change days', () => {
    for (const day of ['2026-03-08', '2026-11-01']) {
      for (let minute = 0; minute < 24 * 60; minute += 30) {
        const hh = String(Math.floor(minute / 60)).padStart(2, '0');
        const mm = String(minute % 60).padStart(2, '0');
        const wall = `${day}T${hh}:${mm}`;
        const iso = instantFromWall(wall, DENVER);
        // 2:00 to 2:59 on March 8 never happens in Denver.
        if (day === '2026-03-08' && hh === '02') {
          expect(iso).toBeNull();
          continue;
        }
        expect(iso).not.toBeNull();
        expect(wallValue(iso, DENVER)).toBe(wall);
      }
    }
  });

  it('says why a time in the skipped hour cannot be saved', () => {
    expect(wallProblem('2026-03-08T02:30', DENVER)).toBe(
      '2:30 AM does not happen on Sunday, March 8 in Mountain time: the clocks go forward an hour that night. Pick a time from 3:00 AM.'
    );
    expect(wallProblem('2026-03-08T03:30', DENVER)).toBeNull();
    expect(wallProblem('', DENVER)).toBeNull();
  });

  it('takes the first of the two 1:30 AMs when the clocks go back', () => {
    expect(instantFromWall('2026-11-01T01:30', DENVER)).toBe('2026-11-01T07:30:00.000Z');
  });
});

describe('a whole day on the business clock', () => {
  it('starts at Mountain midnight and ends just before the next', () => {
    expect(dayStartIn('2026-12-25', DENVER)).toBe('2026-12-25T07:00:00.000Z');
    expect(dayEndIn('2026-12-25', DENVER)).toBe('2026-12-26T06:59:59.000Z');
  });

  it('is 23 hours long on the day the clocks go forward', () => {
    expect(dayStartIn('2026-03-08', DENVER)).toBe('2026-03-08T07:00:00.000Z');
    expect(dayEndIn('2026-03-08', DENVER)).toBe('2026-03-09T05:59:59.000Z');
  });

  it('reads a stored day back as the same day', () => {
    expect(dayIn('2026-12-25T07:00:00.000Z', DENVER)).toBe('2026-12-25');
    expect(dayIn('2026-12-26T06:59:59.000Z', DENVER)).toBe('2026-12-25');
  });

  it('refuses something that is not a day', () => {
    expect(dayStartIn('20266-12-25', DENVER)).toBeNull();
    expect(dayEndIn('', DENVER)).toBeNull();
  });
});

describe('the zone is named the way a person says it', () => {
  it('says Mountain time and Pacific time', () => {
    expect(zoneWords(DENVER)).toBe('Mountain time');
    expect(zoneWords('America/Los_Angeles')).toBe('Pacific time');
  });

  it('says so when this computer is on a different clock', () => {
    expect(wallClockHint(DENVER, 'America/Los_Angeles')).toBe(
      'In Mountain time, where the booking happens. This computer is set to Pacific time, so this is not the time on your screen’s clock.'
    );
    expect(wallClockHint(DENVER, DENVER)).toBe('In Mountain time, where the booking happens.');
  });
});
