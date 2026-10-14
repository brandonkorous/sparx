// The version history reads a moment on the business's clock (piggles persona issue 987).

import { describe, expect, it } from 'vitest';

import { versionClock, versionClockNote, versionDayLabel } from './version-clock';

const NOW = new Date('2026-10-11T09:39:00.000Z');

describe('a version on the business clock', () => {
  it('reads the time on the business clock, not this computer’s', () => {
    expect(versionClock(NOW.toISOString(), 'Europe/London')).toMatch(/^10:39\sAM$/);
    expect(versionClock(NOW.toISOString(), 'America/Los_Angeles')).toMatch(/^2:39\sAM$/);
  });

  it('measures Today and Yesterday against the business’s midnight', () => {
    // 23:30 UTC on Saturday is already Sunday in London, and still Saturday in LA.
    const late = '2026-10-10T23:30:00.000Z';
    expect(versionDayLabel(late, 'Europe/London', NOW)).toBe('Today');
    expect(versionDayLabel(late, 'America/Los_Angeles', NOW)).toBe('Yesterday');
    expect(versionDayLabel('2026-10-08T12:00:00.000Z', 'Europe/London', NOW)).toMatch(/Thu, Oct 8/);
  });

  it('says whose clock the times are on', () => {
    expect(versionClockNote('Europe/London', 'America/Los_Angeles', NOW)).toBe(
      "Times are on your business's clock, British Summer Time."
    );
    expect(versionClockNote(null, 'America/Los_Angeles', NOW)).toMatch(
      /^Times are on this computer's clock, Pacific Daylight Time,/
    );
  });
});
