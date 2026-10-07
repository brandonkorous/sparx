import { describe, expect, it } from 'vitest';
import {
  clockNote,
  isoToWallClock,
  onClock,
  summaryOnClock,
  wallClockToIso,
} from './publish-clock';

describe('the clock a piece goes live on (issue 942)', () => {
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

describe('a schedule in the history (issue 942)', () => {
  it('reads the stored time out on the reader clock', () => {
    expect(summaryOnClock('Scheduled for 2026-10-08T05:00:00.000Z', 'Europe/London')).toBe(
      'Scheduled for Oct 8, 2026, 6:00 AM British Summer Time'
    );
  });

  it('leaves a line with no time in it alone', () => {
    expect(summaryOnClock('Published', 'Europe/London')).toBe('Published');
  });
});

describe('changing a scheduled time starts from it (issue 942)', () => {
  it('shows the stored instant as the box reads it, on the business clock', () => {
    expect(isoToWallClock('2026-10-08T13:00:00.000Z', 'Europe/London')).toBe('2026-10-08T14:00');
    expect(
      wallClockToIso(isoToWallClock('2026-10-08T05:00:00.000Z', 'Europe/London'), 'Europe/London')
    ).toBe('2026-10-08T05:00:00.000Z');
  });
});
