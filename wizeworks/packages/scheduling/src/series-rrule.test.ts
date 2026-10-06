// A repeating booking keeps its WALL time and its weekday where the business is
// (sparx persona issue 086).
//
// The series engine stepped the UTC instant: every week was exactly 7 x 24 hours
// later, and every weekday was read in UTC. So a 9:00 AM Saturday oil change in
// Salt Lake City became an 8:00 AM one the week the clocks went back, a 6:00 PM
// Monday class (already Tuesday in UTC) landed on Sunday evenings, and "Last day
// it can happen: December 5" dropped December 5, because its UNTIL was midnight
// UTC, which is the evening before in Denver.

import { describe, expect, it } from 'vitest';

import { expandRecurrenceInZone, parseRRule } from './rrule';

const DENVER = 'America/Denver';
const HOUR = 3600_000;
const ms = (iso: string): number => Date.parse(iso);
const isos = (out: { start: number }[]): string[] =>
  out.map((i) => new Date(i.start).toISOString());

function expand(rrule: string, startIso: string, endIso = '2027-06-01T00:00:00Z') {
  const rule = parseRRule(rrule);
  if (!rule) throw new Error('bad rule');
  return expandRecurrenceInZone(ms(startIso), HOUR, rule, ms(startIso), ms(endIso), DENVER);
}

describe('a repeating booking on the business clock', () => {
  it('stays at 9:00 AM when the clocks go back', () => {
    // Saturdays at 9:00 AM Mountain, either side of November 1.
    expect(isos(expand('FREQ=WEEKLY;COUNT=3', '2026-10-24T15:00:00Z'))).toEqual([
      '2026-10-24T15:00:00.000Z',
      '2026-10-31T15:00:00.000Z',
      '2026-11-07T16:00:00.000Z',
    ]);
  });

  it('stays at 9:00 AM every day across the clocks going forward', () => {
    expect(isos(expand('FREQ=DAILY;COUNT=3', '2026-03-07T16:00:00Z'))).toEqual([
      '2026-03-07T16:00:00.000Z',
      '2026-03-08T15:00:00.000Z',
      '2026-03-09T15:00:00.000Z',
    ]);
  });

  it('reads the weekday where the business is, not in UTC', () => {
    // 6:00 PM on Monday, October 5 in Denver is already Tuesday in UTC.
    expect(isos(expand('FREQ=WEEKLY;BYDAY=MO;COUNT=2', '2026-10-06T00:00:00Z'))).toEqual([
      '2026-10-06T00:00:00.000Z',
      '2026-10-13T00:00:00.000Z',
    ]);
  });

  it('includes the whole of the last day it can happen', () => {
    // Every day at 9:00 AM Mountain, the last one on December 5.
    expect(isos(expand('FREQ=DAILY;UNTIL=20261205', '2026-12-03T16:00:00Z'))).toEqual([
      '2026-12-03T16:00:00.000Z',
      '2026-12-04T16:00:00.000Z',
      '2026-12-05T16:00:00.000Z',
    ]);
  });

  it('still honors an UNTIL written as an exact moment', () => {
    expect(isos(expand('FREQ=DAILY;UNTIL=20261204T170000Z', '2026-12-03T16:00:00Z'))).toEqual([
      '2026-12-03T16:00:00.000Z',
      '2026-12-04T16:00:00.000Z',
    ]);
  });
});
