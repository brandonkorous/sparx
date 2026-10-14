// The social screens read a post's time on the business's clock (piggles persona issue 990).
//
// A business in London, opened on a laptop set to Pacific time, saw her 09:00 post as
// "1:00 AM", a post at half past midnight on her Sunday under Saturday on the calendar,
// and a time typed in the schedule box read on the laptop's clock, eight hours out.

import { describe, expect, it } from 'vitest';

import { wallClockToIso, isoToWallClock, futureInstant } from '../../lib/publish-clock';
import {
  byDayOn,
  dayLabel,
  dayOn,
  dayStartOn,
  importClockNote,
  monthGrid,
  rangeLabel,
  rescheduleOn,
  seedForInstant,
  stepCursor,
  timeOn,
  timesNote,
  todayOn,
  weekDays,
  whenLine,
  whenOn,
} from './social-clock';
import type { Post } from './data';

const LONDON = 'Europe/London';
const LA = 'America/Los_Angeles';

/** 09:00 in London on Sunday, October 11, 2026 (British Summer Time, UTC+1). */
const NINE_LONDON = '2026-10-11T08:00:00.000Z';
/** 23:30 UTC on Saturday, October 10: Sunday 00:30 in London, Saturday 16:30 in LA. */
const LATE_SATURDAY = '2026-10-10T23:30:00.000Z';

function post(fields: Partial<Post>): Post {
  return {
    id: 'p1',
    body: 'Fresh loaves at nine',
    publishedAt: null,
    scheduledAt: null,
    createdAt: NINE_LONDON,
    ...fields,
  } as Post;
}

describe('a post time on the business clock', () => {
  it('reads the time on her clock, not this computer’s', () => {
    expect(timeOn(NINE_LONDON, LONDON)).toMatch(/^9:00\sAM$/);
    expect(timeOn(NINE_LONDON, LA)).toMatch(/^1:00\sAM$/);
    expect(whenOn(NINE_LONDON, LONDON)).toMatch(/Oct 11.*9:00\sAM/);
    expect(whenOn(NINE_LONDON, LA)).toMatch(/Oct 11.*1:00\sAM/);
  });

  it('says when a post goes out on her clock', () => {
    expect(whenLine(post({ scheduledAt: NINE_LONDON }), LONDON)).toMatch(
      /^Goes out Oct 11.*9:00\sAM$/
    );
    expect(whenLine(post({ publishedAt: LATE_SATURDAY }), LONDON)).toMatch(
      /^Posted Oct 11.*12:30\sAM$/
    );
  });

  it('says whose clock the times are on', () => {
    const at = new Date(NINE_LONDON);
    expect(timesNote(LONDON, LA, at)).toBe(
      "Times are on your business's clock, British Summer Time."
    );
    expect(timesNote(null, LA, at)).toBe(
      "Times are on this computer's clock, Pacific Daylight Time, because your business has no time zone yet. You can set one in Business details."
    );
  });
});

describe('the spreadsheet import', () => {
  it('says whose clock a time typed in the file is read on', () => {
    const at = new Date(NINE_LONDON);
    expect(importClockNote(LONDON, LA, at)).toBe(
      "Times in your file are read on your business's clock, British Summer Time, unless a time names its own zone."
    );
    expect(importClockNote(null, LA, at)).toBe(
      "Times in your file are read on this computer's clock, Pacific Daylight Time, because your business has no time zone yet. You can set one in Business details."
    );
  });
});

describe('the calendar day a post sits under', () => {
  it('puts a post at 23:30 UTC Saturday under Sunday in London and Saturday in LA', () => {
    expect(dayOn(LATE_SATURDAY, LONDON)).toBe('2026-10-11');
    expect(dayOn(LATE_SATURDAY, LA)).toBe('2026-10-10');

    const late = post({ scheduledAt: LATE_SATURDAY });
    const london = byDayOn([late], (p) => p.scheduledAt, LONDON);
    const la = byDayOn([late], (p) => p.scheduledAt, LA);
    expect([...london.keys()]).toEqual(['2026-10-11']);
    expect([...la.keys()]).toEqual(['2026-10-10']);
  });

  it('marks today on her clock', () => {
    const now = Date.parse(LATE_SATURDAY);
    expect(todayOn(LONDON, now)).toBe('2026-10-11');
    expect(todayOn(LA, now)).toBe('2026-10-10');
  });

  it('starts her day at her midnight', () => {
    expect(dayStartOn('2026-10-11', LONDON)?.toISOString()).toBe('2026-10-10T23:00:00.000Z');
    expect(dayStartOn('2026-10-11', LA)?.toISOString()).toBe('2026-10-11T07:00:00.000Z');
  });

  it('builds the grid from calendar days, Sunday first', () => {
    expect(weekDays('2026-10-14')).toEqual([
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
    ]);
    const grid = monthGrid('2026-10-20');
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe('2026-09-27');
    expect(grid[4]).toBe('2026-10-01');
    // Across the night the clocks go back, the grid still walks one day at a time.
    expect(grid).toContain('2026-10-25');
    expect(grid).toContain('2026-10-26');
    expect(stepCursor('2026-10-01', 'month', 1)).toBe('2026-11-01');
    expect(stepCursor('2026-01-01', 'month', -1)).toBe('2025-12-01');
    expect(stepCursor('2026-10-14', 'week', 1)).toBe('2026-10-18');
  });

  it('names a day without moving it', () => {
    expect(dayLabel('2026-10-11')).toBe('Sunday, October 11');
    expect(rangeLabel('month', '2026-10-01')).toBe('October 2026');
    expect(rangeLabel('week', '2026-10-11')).toBe('Oct 11 – Oct 17, 2026');
  });
});

describe('the schedule box on her clock', () => {
  it('stores 08:30 typed in London as 07:30Z in October and 08:30Z in December', () => {
    expect(wallClockToIso('2026-10-15T08:30', LONDON)).toBe('2026-10-15T07:30:00.000Z');
    expect(wallClockToIso('2026-12-15T08:30', LONDON)).toBe('2026-12-15T08:30:00.000Z');
    expect(isoToWallClock('2026-10-15T07:30:00.000Z', LONDON)).toBe('2026-10-15T08:30');
  });

  it('asks "still to come" of the instant, not this computer’s wall clock', () => {
    // 10:00 in London: 09:30 typed for London is gone, whatever a laptop in LA says.
    const now = Date.parse('2026-10-15T09:00:00.000Z');
    expect(futureInstant('2026-10-15T09:30', LONDON, now)).toBeNull();
    expect(futureInstant('2026-10-15T10:30', LONDON, now)).toBe('2026-10-15T09:30:00.000Z');
  });

  it('opens a free posting time at the hour that was clicked', () => {
    expect(seedForInstant(NINE_LONDON, LONDON)).toBe('2026-10-11T09:00');
  });
});

describe('dragging a post to another day', () => {
  const now = Date.parse('2026-10-01T12:00:00.000Z');

  it('keeps its time of day on her clock', () => {
    // 09:00 London on Oct 11 moved to Dec 15 is still 09:00 London, now GMT.
    expect(rescheduleOn(NINE_LONDON, '2026-12-15', LONDON, now)).toBe('2026-12-15T09:00:00.000Z');
  });

  it('puts a draft at 9am on her clock', () => {
    expect(rescheduleOn(null, '2026-10-20', LONDON, now)).toBe('2026-10-20T08:00:00.000Z');
    expect(rescheduleOn(null, '2026-10-20', LA, now)).toBe('2026-10-20T16:00:00.000Z');
  });

  it('does nothing when dropped back on its own day', () => {
    expect(rescheduleOn(NINE_LONDON, '2026-10-11', LONDON, now)).toBeNull();
  });

  it('nudges a time already gone to an hour from now', () => {
    expect(rescheduleOn(null, '2026-09-30', LONDON, now)).toBe('2026-10-01T13:00:00.000Z');
  });
});
