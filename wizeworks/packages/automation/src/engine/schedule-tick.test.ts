// A scheduled rule runs once per BUSINESS day, at the time its screen shows
// (sparx persona issue 140).
//
// MEASURED 2026-10-06 on Gillett Diesel (America/Denver): the scheduler keyed
// "once a day" on the UTC date and ran any time after the rule's UTC minute,
// while the reminder rules count "7 days late" on Denver's calendar. One Denver
// day spans two UTC dates, so a bill 7 days late was sent its notice at
// midnight in Denver and again at 6pm. The screen said "Every day at 6:00pm".
//
// The walk below ticks the way the worker does and keeps the engine's
// once-per-window rule (a key already used is skipped), then reads back when
// each run happened on the business's clock.

import type { ScheduleSpec } from '@wizeworks/automation-schemas';
import { describe, expect, it } from 'vitest';

import { businessClockAt, isScheduleDue, scheduleWindowKey } from './schedule-tick';

const DENVER = 'America/Denver';

/** An instant as a wall clock in `zone` reads it, `YYYY-MM-DD HH:mm`. Read here
 *  with `Intl` rather than through the engine's clock, so a wrong engine clock
 *  cannot also be the ruler it is measured with. */
function wall(at: Date, zone: string | null): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone ?? 'UTC',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

/** Every run the scheduler would make between two instants, ticking every
 *  `stepMin` minutes, as the business's `YYYY-MM-DD HH:mm` reading. */
function runsBetween(
  schedule: ScheduleSpec,
  zone: string | null,
  fromIso: string,
  toIso: string,
  stepMin = 30
): string[] {
  const seen = new Set<string>();
  const runs: string[] = [];
  for (let t = Date.parse(fromIso); t < Date.parse(toIso); t += stepMin * 60_000) {
    const now = new Date(t);
    const clock = businessClockAt(now, zone);
    if (!isScheduleDue(schedule, now, clock)) continue;
    const key = scheduleWindowKey(schedule, clock);
    if (seen.has(key)) continue;
    seen.add(key);
    runs.push(wall(now, zone));
  }
  return runs;
}

describe('a daily rule on a Denver business', () => {
  // Minute 0 of the UTC day: what every seeded reminder stores, and what the
  // screen shows as "Every day at 6:00pm" in Denver in October.
  const daily: ScheduleSpec = { cadence: 'daily', atMinuteUtc: 0 };

  it('runs once per Denver day, at 6:00pm, not at midnight and again at 6pm', () => {
    expect(runsBetween(daily, DENVER, '2026-10-06T06:00:00Z', '2026-10-09T06:00:00Z')).toEqual([
      '2026-10-06 18:00',
      '2026-10-07 18:00',
      '2026-10-08 18:00',
    ]);
  });

  it('keeps one run a day across the clocks going back (Nov 1, 2026)', () => {
    // MDT → MST: minute 0 UTC is 6:00pm before and 5:00pm after, as the
    // screen says on each of those days (issue 613).
    expect(runsBetween(daily, DENVER, '2026-10-31T06:00:00Z', '2026-11-03T07:00:00Z')).toEqual([
      '2026-10-31 18:00',
      '2026-11-01 17:00',
      '2026-11-02 17:00',
    ]);
  });
});

describe('a weekly rule on a Denver business', () => {
  it('runs on the weekday the owner picked, on her calendar', () => {
    // "Every Tuesday at 6:00pm". Oct 13, 2026 is a Tuesday.
    const weekly: ScheduleSpec = { cadence: 'weekly', dayOfWeek: 2, atMinuteUtc: 0 };
    expect(runsBetween(weekly, DENVER, '2026-10-11T06:00:00Z', '2026-10-18T06:00:00Z')).toEqual([
      '2026-10-13 18:00',
    ]);
  });
});

describe('a business with no time zone', () => {
  it('runs on the UTC day, exactly as before', () => {
    const nineAm: ScheduleSpec = { cadence: 'daily', atMinuteUtc: 9 * 60 };
    expect(runsBetween(nineAm, null, '2026-10-06T00:00:00Z', '2026-10-08T00:00:00Z')).toEqual([
      '2026-10-06 09:00',
      '2026-10-07 09:00',
    ]);
  });

  it('treats a zone the runtime does not know as UTC rather than stopping', () => {
    const clock = businessClockAt(new Date('2026-10-06T23:30:00Z'), 'Mars/Olympus_Mons');
    expect(clock).toMatchObject({ date: '2026-10-06', minute: 23 * 60 + 30, offsetMinutes: 0 });
  });
});
