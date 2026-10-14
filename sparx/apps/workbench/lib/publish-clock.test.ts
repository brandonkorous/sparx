import { describe, expect, it } from 'vitest';
import {
  clockNote,
  futureInstant,
  isoToWallClock,
  onClock,
  summaryOnClock,
  wallClockFromNow,
  wallClockToIso,
} from './publish-clock';

describe('the clock a piece goes live on (Piggles issue 942)', () => {
  it('reads Thursday 06:00 on the business clock, not the computer one', () => {
    // 06:00 in London in October is 05:00 UTC; on a Pacific laptop it was stored as 13:00.
    expect(wallClockToIso('2026-10-08T06:00', 'Europe/London')).toBe('2026-10-08T05:00:00.000Z');
    expect(wallClockToIso('2026-10-08T06:00', 'America/Los_Angeles')).toBe(
      '2026-10-08T13:00:00.000Z'
    );
  });

  it('lands on the right side of a clock change', () => {
    // The clocks go forward in London on 2026-03-29; 09:00 that morning is BST.
    expect(wallClockToIso('2026-03-29T09:00', 'Europe/London')).toBe('2026-03-29T08:00:00.000Z');
    expect(wallClockToIso('2026-03-28T09:00', 'Europe/London')).toBe('2026-03-28T09:00:00.000Z');
  });

  it('refuses what is not a date and time', () => {
    expect(wallClockToIso('', 'Europe/London')).toBeNull();
    expect(wallClockToIso('next Thursday', 'Europe/London')).toBeNull();
  });

  it('names the clock it shows a time on', () => {
    expect(onClock('2026-10-08T05:00:00.000Z', 'Europe/London')).toBe(
      'Oct 8, 2026, 6:00 AM British Summer Time'
    );
  });

  it('says when it is the computer, and where to change that', () => {
    const at = new Date('2026-10-08T05:00:00.000Z');
    expect(clockNote('Europe/London', 'America/Los_Angeles', at)).toBe(
      "On your business's clock, British Summer Time."
    );
    expect(clockNote(null, 'America/Los_Angeles', at)).toContain(
      "this computer's clock, Pacific Daylight Time"
    );
  });
});

describe('a schedule in the history (Piggles issue 942)', () => {
  it('reads the stored time out on the reader clock', () => {
    expect(summaryOnClock('Scheduled for 2026-10-08T05:00:00.000Z', 'Europe/London')).toBe(
      'Scheduled for Oct 8, 2026, 6:00 AM British Summer Time'
    );
  });

  it('leaves a line with no time in it alone', () => {
    expect(summaryOnClock('Published', 'Europe/London')).toBe('Published');
  });
});

describe('changing a scheduled time starts from it (Piggles issue 942)', () => {
  it('shows the stored instant as the box reads it, on the business clock', () => {
    expect(isoToWallClock('2026-10-08T13:00:00.000Z', 'Europe/London')).toBe('2026-10-08T14:00');
    expect(
      wallClockToIso(isoToWallClock('2026-10-08T05:00:00.000Z', 'Europe/London'), 'Europe/London')
    ).toBe('2026-10-08T05:00:00.000Z');
  });
});

describe('a newsletter scheduled and sent on the business clock (Piggles persona issue 984)', () => {
  // Friday morning in London, 9:00 AM British Summer Time.
  const fridayNine = Date.parse('2026-10-09T08:00:00.000Z');

  it('reads her Friday send on her clock in summer and in winter', () => {
    // October is British Summer Time, an hour ahead of UTC.
    expect(wallClockToIso('2026-10-16T08:30', 'Europe/London')).toBe('2026-10-16T07:30:00.000Z');
    // December is Greenwich Mean Time, the same as UTC.
    expect(wallClockToIso('2026-12-04T08:30', 'Europe/London')).toBe('2026-12-04T08:30:00.000Z');
  });

  it('says when it went out on her clock, not on a California laptop', () => {
    // Sent at 08:20 UTC: the review read "1:20 AM" on a Pacific computer.
    expect(onClock('2026-10-11T08:20:00.000Z', 'Europe/London')).toBe(
      'Oct 11, 2026, 9:20 AM British Summer Time'
    );
    expect(onClock('2026-12-04T08:30:00.000Z', 'Europe/London')).toBe(
      'Dec 4, 2026, 8:30 AM Greenwich Mean Time'
    );
  });

  it('asks whether a time is still to come on her clock', () => {
    // 08:30 in London is half an hour gone at 9:00 BST, though a Pacific laptop
    // reading the same box would put it seven and a half hours ahead.
    expect(futureInstant('2026-10-09T08:30', 'Europe/London', fridayNine)).toBeNull();
    expect(futureInstant('2026-10-09T08:30', 'America/Los_Angeles', fridayNine)).toBe(
      '2026-10-09T15:30:00.000Z'
    );
    // 09:30 in London is still to come.
    expect(futureInstant('2026-10-09T09:30', 'Europe/London', fridayNine)).toBe(
      '2026-10-09T08:30:00.000Z'
    );
    expect(futureInstant('not a time', 'Europe/London', fridayNine)).toBeNull();
  });

  it('opens the box a quarter of an hour ahead on her clock', () => {
    expect(wallClockFromNow(15, 'Europe/London', fridayNine)).toBe('2026-10-09T09:15');
    expect(wallClockFromNow(15, 'Europe/London', Date.parse('2026-12-04T08:00:00.000Z'))).toBe(
      '2026-12-04T08:15'
    );
  });
});
