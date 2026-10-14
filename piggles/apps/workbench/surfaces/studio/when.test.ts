// The version lists read a moment on the business's clock (piggles persona issue 987).
//
// The Marrow Review is in London. She published at 09:39 UTC, 10:39 on her clock, and
// her publish history said "2:39 AM" because it read the time on this computer's clock.

import { describe, expect, it } from 'vitest';

import { versionClock, versionClockNote, versionDay } from './when';

const PUBLISHED = '2026-10-11T09:39:00.000Z';

describe('a version on the business clock', () => {
  it('reads the time on her clock, not this computer’s', () => {
    expect(versionClock(PUBLISHED, 'Europe/London')).toMatch(/^10:39\sAM$/);
    expect(versionClock(PUBLISHED, 'America/Los_Angeles')).toMatch(/^2:39\sAM$/);
  });

  it('puts a late save under her day, not this computer’s', () => {
    // 23:30 UTC on Saturday is half past midnight on Sunday in London.
    const late = '2026-10-10T23:30:00.000Z';
    expect(versionDay(late, 'Europe/London')).toMatch(/Sunday, October 11/);
    expect(versionDay(late, 'America/Los_Angeles')).toMatch(/Saturday, October 10/);
  });

  it('says whose clock the times are on', () => {
    const at = new Date(PUBLISHED);
    expect(versionClockNote('Europe/London', 'America/Los_Angeles', at)).toBe(
      "Times are on your business's clock, British Summer Time."
    );
    expect(versionClockNote(null, 'America/Los_Angeles', at)).toMatch(
      /^Times are on this computer's clock, Pacific Daylight Time, because your business has no time zone yet\./
    );
  });
});
