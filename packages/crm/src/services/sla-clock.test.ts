// The support clock (docs/144 §7.3).
//
// Every case here is a promise a real business made and a moment where naive
// arithmetic would report the wrong answer: after hours, over a weekend,
// through a public holiday, and across both daylight-saving boundaries.

import { describe, expect, it } from 'vitest';

import {
  addBusinessMinutes,
  businessMinutesBetween,
  computeDueDates,
  isOpenAt,
  readClock,
  type BusinessCalendar,
} from './sla-clock';

/** Monday–Friday, 9am to 5pm, in Denver. The default a support desk gets. */
const WEEKDAYS_9_5: BusinessCalendar = {
  timezone: 'America/Denver',
  windows: [1, 2, 3, 4, 5].map((day) => ({ day, startMinute: 540, endMinute: 1020 })),
  holidays: [],
};

const ALWAYS_OPEN: BusinessCalendar = { timezone: 'America/Denver', windows: [], holidays: [] };

/** A local wall time in Denver, as a UTC instant. MST is UTC-7, MDT is UTC-6. */
function denver(iso: string): Date {
  return new Date(iso);
}

describe('addBusinessMinutes', () => {
  it('counts forward inside one open window', () => {
    // Tuesday 2026-08-11, 10:00 MDT (16:00Z) + 2h → 12:00 MDT.
    const from = denver('2026-08-11T16:00:00Z');
    expect(addBusinessMinutes(from, 120, WEEKDAYS_9_5).toISOString()).toBe(
      '2026-08-11T18:00:00.000Z'
    );
  });

  it('spills into the next working morning rather than running overnight', () => {
    // THE CASE THE WHOLE THING EXISTS FOR. Tuesday 16:45 MDT with a one-hour
    // promise: 15 minutes are left in the day, so it is due at 09:45 Wednesday
    // — not 17:45 Tuesday, when nobody is there.
    const from = denver('2026-08-11T22:45:00Z'); // 16:45 MDT
    expect(addBusinessMinutes(from, 60, WEEKDAYS_9_5).toISOString()).toBe(
      '2026-08-12T15:45:00.000Z' // 09:45 MDT Wednesday
    );
  });

  it('starts the clock at opening time for a request that arrives overnight', () => {
    // Sunday 03:00 MDT. A customer emailing at 3am on a Sunday is not already
    // an hour late by 4am; the first business minute is Monday at 9.
    const from = denver('2026-08-09T09:00:00Z');
    expect(addBusinessMinutes(from, 60, WEEKDAYS_9_5).toISOString()).toBe(
      '2026-08-10T16:00:00.000Z' // 10:00 MDT Monday
    );
  });

  it('skips the whole weekend', () => {
    // Friday 16:00 MDT + 2 business hours → Monday 10:00 MDT.
    const from = denver('2026-08-07T22:00:00Z');
    expect(addBusinessMinutes(from, 120, WEEKDAYS_9_5).toISOString()).toBe(
      '2026-08-10T16:00:00.000Z'
    );
  });

  it('skips a declared holiday even though it is a weekday', () => {
    // 2026-09-07 is a Monday. With it declared shut, a Friday-afternoon request
    // lands on the Tuesday.
    const withLabor: BusinessCalendar = { ...WEEKDAYS_9_5, holidays: ['2026-09-07'] };
    const from = denver('2026-09-04T22:00:00Z'); // Friday 16:00 MDT
    expect(addBusinessMinutes(from, 120, withLabor).toISOString()).toBe(
      '2026-09-08T16:00:00.000Z' // Tuesday 10:00 MDT
    );
  });

  it('treats an empty weekly pattern as 24/7', () => {
    const from = denver('2026-08-09T09:00:00Z'); // Sunday 03:00 MDT
    expect(addBusinessMinutes(from, 120, ALWAYS_OPEN).toISOString()).toBe(
      '2026-08-09T11:00:00.000Z'
    );
  });

  it('still shuts on a holiday when the pattern is 24/7', () => {
    // Open around the clock and closed on Christmas are independent facts.
    const closedXmas: BusinessCalendar = { ...ALWAYS_OPEN, holidays: ['2026-12-25'] };
    const from = denver('2026-12-24T21:00:00Z'); // 14:00 MST on the 24th
    // 10 hours of the 24th remain; the 25th is shut; the balance lands on the 26th.
    expect(addBusinessMinutes(from, 12 * 60, closedXmas).toISOString()).toBe(
      '2026-12-26T09:00:00.000Z' // 02:00 MST on the 26th
    );
  });

  it('measures real elapsed time across the spring-forward boundary', () => {
    // 2027-03-14 02:00 MST → 03:00 MDT. A 24/7 desk loses an hour of wall clock
    // that night, so 24 business hours from Saturday noon is 11:00, not 12:00.
    const from = denver('2027-03-13T19:00:00Z'); // Saturday 12:00 MST
    expect(addBusinessMinutes(from, 24 * 60, ALWAYS_OPEN).toISOString()).toBe(
      '2027-03-14T19:00:00.000Z' // Sunday 13:00 MDT — 24 REAL hours later
    );
  });

  it('measures real elapsed time across the fall-back boundary', () => {
    // 2026-11-01 02:00 MDT → 01:00 MST: the night is 25 hours long.
    const from = denver('2026-10-31T18:00:00Z'); // Saturday 12:00 MDT
    expect(addBusinessMinutes(from, 24 * 60, ALWAYS_OPEN).toISOString()).toBe(
      '2026-11-01T18:00:00.000Z' // Sunday 11:00 MST — 24 REAL hours later
    );
  });

  it('handles a promise longer than a single working day', () => {
    // Monday 09:00 MDT + 1440 business minutes. Three full working days are
    // exhausted at 17:00 on WEDNESDAY, not on Thursday morning — the budget runs
    // out the instant the desk shuts, and rolling it to the next opening would
    // hand the business an extra sixteen hours it never promised.
    const from = denver('2026-08-10T15:00:00Z');
    expect(addBusinessMinutes(from, 3 * 480, WEEKDAYS_9_5).toISOString()).toBe(
      '2026-08-12T23:00:00.000Z'
    );
  });

  it('lands exactly on closing time when the budget fills the day', () => {
    const from = denver('2026-08-11T15:00:00Z'); // Tuesday 09:00 MDT
    expect(addBusinessMinutes(from, 480, WEEKDAYS_9_5).toISOString()).toBe(
      '2026-08-11T23:00:00.000Z' // 17:00 MDT
    );
  });

  it('counts two windows on one day as one budget', () => {
    // A desk that shuts for lunch: 9–12 and 13–17.
    const lunch: BusinessCalendar = {
      timezone: 'America/Denver',
      windows: [
        { day: 2, startMinute: 540, endMinute: 720 },
        { day: 2, startMinute: 780, endMinute: 1020 },
      ],
      holidays: [],
    };
    // Tuesday 11:00 MDT + 2h: one hour before lunch, one after → 14:00.
    const from = denver('2026-08-11T17:00:00Z');
    expect(addBusinessMinutes(from, 120, lunch).toISOString()).toBe('2026-08-11T20:00:00.000Z');
  });

  it('returns the start instant for a non-positive budget', () => {
    const from = denver('2026-08-11T16:00:00Z');
    expect(addBusinessMinutes(from, 0, WEEKDAYS_9_5).getTime()).toBe(from.getTime());
  });

  it('fails loudly on a calendar that is never open', () => {
    const never: BusinessCalendar = {
      timezone: 'UTC',
      // A window that ends before it starts is filtered out, leaving nothing —
      // the shape the schema refuses, reaching the clock only through a direct
      // caller. Better a clear error than a request that hangs.
      windows: [{ day: 0, startMinute: 600, endMinute: 600 }],
      holidays: [],
    };
    expect(() => addBusinessMinutes(new Date('2026-08-11T16:00:00Z'), 60, never)).toThrow(
      /no open hours/
    );
  });
});

describe('businessMinutesBetween', () => {
  it('ignores the hours the desk was shut', () => {
    // Tuesday 16:00 MDT to Wednesday 10:00 MDT: one hour Tuesday + one Wednesday.
    const from = denver('2026-08-11T22:00:00Z');
    const to = denver('2026-08-12T16:00:00Z');
    expect(businessMinutesBetween(from, to, WEEKDAYS_9_5)).toBe(120);
  });

  it('returns 0 for an interval entirely outside business hours', () => {
    const from = denver('2026-08-09T09:00:00Z'); // Sunday 03:00
    const to = denver('2026-08-09T13:00:00Z'); // Sunday 07:00
    expect(businessMinutesBetween(from, to, WEEKDAYS_9_5)).toBe(0);
  });

  it('returns 0 when the end is at or before the start', () => {
    const at = denver('2026-08-11T16:00:00Z');
    expect(businessMinutesBetween(at, at, WEEKDAYS_9_5)).toBe(0);
    expect(businessMinutesBetween(at, denver('2026-08-11T15:00:00Z'), WEEKDAYS_9_5)).toBe(0);
  });

  it('round-trips against addBusinessMinutes across a weekend', () => {
    const from = denver('2026-08-07T22:00:00Z'); // Friday 16:00 MDT
    const due = addBusinessMinutes(from, 300, WEEKDAYS_9_5);
    expect(businessMinutesBetween(from, due, WEEKDAYS_9_5)).toBe(300);
  });
});

describe('isOpenAt', () => {
  it('knows when the desk is staffed', () => {
    expect(isOpenAt(denver('2026-08-11T16:00:00Z'), WEEKDAYS_9_5)).toBe(true); // Tue 10:00
    expect(isOpenAt(denver('2026-08-11T23:30:00Z'), WEEKDAYS_9_5)).toBe(false); // Tue 17:30
    expect(isOpenAt(denver('2026-08-09T18:00:00Z'), WEEKDAYS_9_5)).toBe(false); // Sunday
  });

  it('treats closing time as shut', () => {
    // endMinute is exclusive: 17:00 sharp is the first minute of being closed.
    expect(isOpenAt(denver('2026-08-11T23:00:00Z'), WEEKDAYS_9_5)).toBe(false);
    expect(isOpenAt(denver('2026-08-11T22:59:00Z'), WEEKDAYS_9_5)).toBe(true);
  });

  it('is always open with no declared pattern, except on a holiday', () => {
    expect(isOpenAt(denver('2026-08-09T09:00:00Z'), ALWAYS_OPEN)).toBe(true);
    const closedXmas: BusinessCalendar = { ...ALWAYS_OPEN, holidays: ['2026-12-25'] };
    expect(isOpenAt(denver('2026-12-25T19:00:00Z'), closedXmas)).toBe(false);
  });
});

describe('computeDueDates', () => {
  const policy = {
    timezone: 'America/Denver',
    windows: WEEKDAYS_9_5.windows,
    holidays: [],
    warnAtPercent: 80,
    targets: [
      { priority: 'urgent', firstResponseMinutes: 60, resolutionMinutes: 480 },
      { priority: 'low', firstResponseMinutes: null, resolutionMinutes: null },
    ],
  };

  it('sets the warn mark at the percentage of the BUDGET, not of the wall clock', () => {
    // Tuesday 09:00 MDT, one-hour promise, warn at 80% → 09:48, due 10:00.
    const opened = denver('2026-08-11T15:00:00Z');
    const dates = computeDueDates(opened, 'urgent', policy);
    expect(dates.firstResponseWarnAt?.toISOString()).toBe('2026-08-11T15:48:00.000Z');
    expect(dates.firstResponseDueAt?.toISOString()).toBe('2026-08-11T16:00:00.000Z');
  });

  it('walks the warn mark over the closed hours too', () => {
    // Tuesday 16:45 MDT. 48 business minutes lands at 09:33 Wednesday, and the
    // full hour at 09:45 — both on the far side of a night the desk was shut.
    const opened = denver('2026-08-11T22:45:00Z');
    const dates = computeDueDates(opened, 'urgent', policy);
    expect(dates.firstResponseWarnAt?.toISOString()).toBe('2026-08-12T15:33:00.000Z');
    expect(dates.firstResponseDueAt?.toISOString()).toBe('2026-08-12T15:45:00.000Z');
  });

  it('promises nothing when the priority has no target', () => {
    const dates = computeDueDates(denver('2026-08-11T15:00:00Z'), 'low', policy);
    expect(dates).toEqual({
      firstResponseDueAt: null,
      firstResponseWarnAt: null,
      resolutionDueAt: null,
      resolutionWarnAt: null,
    });
  });

  it('promises nothing when the priority is not in the policy at all', () => {
    const dates = computeDueDates(denver('2026-08-11T15:00:00Z'), 'medium', policy);
    expect(dates.firstResponseDueAt).toBeNull();
  });

  it('promises nothing with no policy', () => {
    const dates = computeDueDates(denver('2026-08-11T15:00:00Z'), 'urgent', null);
    expect(dates.resolutionDueAt).toBeNull();
  });

  it('never puts the warn mark at zero minutes', () => {
    // A 1-minute promise at 80% floors to 0, which would mark every new ticket
    // amber the instant it was created.
    const tiny = {
      ...policy,
      targets: [{ priority: 'urgent', firstResponseMinutes: 1, resolutionMinutes: null }],
    };
    const opened = denver('2026-08-11T15:00:00Z');
    const dates = computeDueDates(opened, 'urgent', tiny);
    expect(dates.firstResponseWarnAt?.getTime()).toBeGreaterThan(opened.getTime());
  });
});

describe('readClock', () => {
  const due = denver('2026-08-11T16:00:00Z');
  const warn = denver('2026-08-11T15:48:00Z');

  it('says nothing when nothing was promised', () => {
    expect(readClock(denver('2026-08-11T15:00:00Z'), null, null, null).state).toBe('none');
  });

  it('runs green, then amber, then red', () => {
    expect(readClock(denver('2026-08-11T15:00:00Z'), due, warn, null).state).toBe('ok');
    expect(readClock(denver('2026-08-11T15:50:00Z'), due, warn, null).state).toBe('warning');
    expect(readClock(denver('2026-08-11T16:01:00Z'), due, warn, null).state).toBe('breached');
  });

  it('breaches exactly at the due instant, not a minute later', () => {
    expect(readClock(due, due, warn, null).state).toBe('breached');
  });

  it('reports a promise that was kept LATE as met, not as permanently breached', () => {
    // Otherwise every request answered late stays red on the queue forever and
    // buries the ones still waiting. The breach is on the row for reporting.
    const settled = denver('2026-08-11T16:30:00Z');
    expect(readClock(denver('2026-08-12T16:00:00Z'), due, warn, settled).state).toBe('met');
  });

  it('counts remaining minutes down through zero', () => {
    expect(readClock(denver('2026-08-11T15:30:00Z'), due, warn, null).minutesRemaining).toBe(30);
    expect(readClock(denver('2026-08-11T16:30:00Z'), due, warn, null).minutesRemaining).toBe(-30);
  });
});
