import { describe, expect, it } from 'vitest';

import {
  clockLabel,
  localMinuteToUtc,
  ordinal,
  scheduleLine,
  utcMinuteToLocal,
  zoneOffsetMinutes,
  type DailySchedule,
} from './schedule-clock';

/** Two instants either side of the US clock change, so daylight saving is a
 *  tested fact rather than a hope. */
const WINTER = new Date('2026-01-15T12:00:00.000Z');
const SUMMER = new Date('2026-07-15T12:00:00.000Z');

const DEVICE = 'America/Chicago';

describe('zoneOffsetMinutes', () => {
  it('reads a zone behind UTC as negative', () => {
    expect(zoneOffsetMinutes('America/New_York', WINTER)).toBe(-300);
  });

  it('follows daylight saving rather than a fixed table', () => {
    expect(zoneOffsetMinutes('America/New_York', SUMMER)).toBe(-240);
  });

  it('reads a zone ahead of UTC as positive, including a half-hour one', () => {
    expect(zoneOffsetMinutes('Asia/Kolkata', WINTER)).toBe(330);
  });

  it('is zero for UTC itself', () => {
    expect(zoneOffsetMinutes('UTC', WINTER)).toBe(0);
  });

  it('falls back to UTC rather than throwing inside a table cell', () => {
    expect(zoneOffsetMinutes('Not/AZone', WINTER)).toBe(0);
  });
});

describe('utcMinuteToLocal', () => {
  it('is the line the automations list got wrong', () => {
    // "Every day at 00:00 UTC" over a shop in New York is 7pm the day before.
    expect(clockLabel(utcMinuteToLocal(0, 'America/New_York', WINTER))).toBe('7:00pm');
  });

  it('wraps backwards past midnight instead of going negative', () => {
    expect(utcMinuteToLocal(0, 'America/New_York', WINTER)).toBe(19 * 60);
  });

  it('wraps forwards past midnight', () => {
    // 23:00 UTC in Kolkata (+5:30) is 4:30am the next day.
    expect(utcMinuteToLocal(23 * 60, 'Asia/Kolkata', WINTER)).toBe(4 * 60 + 30);
  });

  it('round-trips with localMinuteToUtc', () => {
    for (const minute of [0, 1, 570, 719, 720, 1439]) {
      expect(
        localMinuteToUtc(utcMinuteToLocal(minute, 'Asia/Kolkata', WINTER), 'Asia/Kolkata', WINTER)
      ).toBe(minute);
    }
  });
});

describe('clockLabel', () => {
  it('names midnight and noon rather than printing 12', () => {
    expect(clockLabel(0)).toBe('midnight');
    expect(clockLabel(720)).toBe('noon');
  });

  it('reads the way a person says a time', () => {
    expect(clockLabel(9 * 60)).toBe('9:00am');
    expect(clockLabel(13 * 60 + 5)).toBe('1:05pm');
    expect(clockLabel(23 * 60 + 59)).toBe('11:59pm');
  });

  it('never prints a 24-hour figure or the letters UTC', () => {
    for (let minute = 0; minute < 1440; minute += 7) {
      const label = clockLabel(minute);
      expect(label).not.toContain('UTC');
      expect(label).not.toMatch(/^(1[3-9]|2[0-3]):/);
    }
  });
});

describe('ordinal', () => {
  it('handles the teens, which is where the naive version breaks', () => {
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(12)).toBe('12th');
    expect(ordinal(13)).toBe('13th');
  });

  it('handles the ones that take a suffix', () => {
    expect(['1st', '2nd', '3rd', '21st', '22nd', '23rd']).toEqual(
      [1, 2, 3, 21, 22, 23].map(ordinal)
    );
  });
});

describe('scheduleLine', () => {
  const daily: DailySchedule = { cadence: 'daily', atMinuteUtc: 0 };

  it('says the time on the reader s own clock, and never says UTC', () => {
    const line = scheduleLine(daily, { zone: 'America/New_York', device: DEVICE }, WINTER);
    expect(line).toBe('Every day at 7:00pm');
    expect(line).not.toContain('UTC');
    expect(line).not.toContain('00:00');
  });

  it('moves with the clocks, because a UTC-stored schedule does', () => {
    expect(scheduleLine(daily, { zone: 'America/New_York', device: DEVICE }, SUMMER)).toBe(
      'Every day at 8:00pm'
    );
  });

  it('says WHOSE clock when the business has not set one', () => {
    // An unset value that reads like a chosen one is issue 178.
    const line = scheduleLine(daily, { zone: null, device: 'America/New_York' }, WINTER);
    expect(line).toContain('7:00pm');
    expect(line).toContain('this computer');
  });

  it('holds rather than guessing while the zone is still loading', () => {
    expect(scheduleLine(daily, { zone: undefined, device: DEVICE }, WINTER)).not.toContain(
      'midnight'
    );
  });

  it('names the weekday', () => {
    const weekly: DailySchedule = { cadence: 'weekly', atMinuteUtc: 14 * 60, dayOfWeek: 2 };
    expect(scheduleLine(weekly, { zone: 'UTC', device: DEVICE }, WINTER)).toBe(
      'Every Tuesday at 2:00pm'
    );
  });

  it('says the 3rd of the month, not day 3', () => {
    const monthly: DailySchedule = { cadence: 'monthly', atMinuteUtc: 9 * 60, dayOfMonth: 3 };
    expect(scheduleLine(monthly, { zone: 'UTC', device: DEVICE }, WINTER)).toBe(
      'On the 3rd of the month at 9:00am'
    );
  });

  it('says every hour rather than every 60 minutes', () => {
    const hourly: DailySchedule = { cadence: 'interval', atMinuteUtc: 0, everyMinutes: 60 };
    expect(scheduleLine(hourly, { zone: 'UTC', device: DEVICE }, WINTER)).toBe('Every hour');
    const sixHourly: DailySchedule = { cadence: 'interval', atMinuteUtc: 0, everyMinutes: 360 };
    expect(scheduleLine(sixHourly, { zone: 'UTC', device: DEVICE }, WINTER)).toBe('Every 6 hours');
  });

  it('needs no zone at all for an interval, so it answers before one loads', () => {
    const every15: DailySchedule = { cadence: 'interval', atMinuteUtc: 0, everyMinutes: 15 };
    expect(scheduleLine(every15, { zone: undefined, device: DEVICE }, WINTER)).toBe(
      'Every 15 minutes'
    );
  });

  it('puts a one-off on a date in her own zone', () => {
    const once: DailySchedule = {
      cadence: 'once',
      atMinuteUtc: 0,
      at: '2026-01-16T02:30:00.000Z',
    };
    // 02:30 UTC on the 16th is 9:30pm on the 15th in New York.
    expect(scheduleLine(once, { zone: 'America/New_York', device: DEVICE }, WINTER)).toBe(
      'Once, on Jan 15 at 9:30pm'
    );
  });
});
