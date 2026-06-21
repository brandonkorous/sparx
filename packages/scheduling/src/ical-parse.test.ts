import { describe, expect, it } from 'vitest';

import { parseBusyIntervals, parseIcsDuration } from './ical-parse';
import { expandRecurrence, parseIcsInstant, parseRRule } from './rrule';

const ms = (iso: string): number => Date.parse(iso);

function ics(...vevents: string[]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', ...vevents, 'END:VCALENDAR'].join('\r\n');
}

function vevent(body: string): string {
  return `BEGIN:VEVENT\r\n${body}\r\nEND:VEVENT`;
}

describe('parseRRule', () => {
  it('parses freq + interval + count + byday', () => {
    expect(parseRRule('FREQ=WEEKLY;INTERVAL=2;COUNT=5;BYDAY=MO,WE')).toEqual({
      freq: 'WEEKLY',
      interval: 2,
      count: 5,
      until: undefined,
      byDay: [1, 3],
    });
  });

  it('parses UNTIL into an instant and strips a leading RRULE:', () => {
    const r = parseRRule('RRULE:FREQ=DAILY;UNTIL=20260701T000000Z');
    expect(r?.freq).toBe('DAILY');
    expect(r?.until).toBe(Date.UTC(2026, 6, 1, 0, 0, 0));
  });

  it('returns null without a recognized FREQ', () => {
    expect(parseRRule('INTERVAL=2')).toBeNull();
  });
});

describe('parseIcsInstant', () => {
  it('parses date-only and date-time forms', () => {
    expect(parseIcsInstant('20260620')).toBe(Date.UTC(2026, 5, 20));
    expect(parseIcsInstant('20260620T153000Z')).toBe(Date.UTC(2026, 5, 20, 15, 30, 0));
  });
});

describe('expandRecurrence', () => {
  it('expands a daily rule bounded by the window', () => {
    const start = ms('2026-06-01T09:00:00Z');
    const out = expandRecurrence(
      start,
      3600_000,
      { freq: 'DAILY', interval: 1, byDay: [] },
      ms('2026-06-01T00:00:00Z'),
      ms('2026-06-04T00:00:00Z')
    );
    expect(out.map((i) => new Date(i.start).toISOString())).toEqual([
      '2026-06-01T09:00:00.000Z',
      '2026-06-02T09:00:00.000Z',
      '2026-06-03T09:00:00.000Z',
    ]);
  });

  it('honors COUNT', () => {
    const start = ms('2026-06-01T09:00:00Z');
    const out = expandRecurrence(
      start,
      3600_000,
      { freq: 'DAILY', interval: 1, count: 2, byDay: [] },
      start,
      ms('2026-07-01T00:00:00Z')
    );
    expect(out).toHaveLength(2);
  });

  it('expands weekly BYDAY across an interval and skips pre-DTSTART days', () => {
    // DTSTART is a Wednesday; rule is every week on Mon+Wed.
    const start = ms('2026-06-03T09:00:00Z'); // Wed 2026-06-03
    const out = expandRecurrence(
      start,
      3600_000,
      { freq: 'WEEKLY', interval: 1, byDay: [1, 3] },
      start,
      ms('2026-06-16T00:00:00Z')
    ).map((i) => new Date(i.start).toISOString().slice(0, 10));
    // Week 1: only Wed 06-03 (Mon 06-01 precedes DTSTART). Week 2: Mon 06-08, Wed 06-10. Week 3: Mon 06-15.
    expect(out).toEqual(['2026-06-03', '2026-06-08', '2026-06-10', '2026-06-15']);
  });

  it('drops EXDATE instances', () => {
    const start = ms('2026-06-01T09:00:00Z');
    const exclude = new Set([ms('2026-06-02T09:00:00Z')]);
    const out = expandRecurrence(
      start,
      3600_000,
      { freq: 'DAILY', interval: 1, byDay: [] },
      start,
      ms('2026-06-04T00:00:00Z'),
      exclude
    ).map((i) => new Date(i.start).toISOString().slice(0, 10));
    expect(out).toEqual(['2026-06-01', '2026-06-03']);
  });

  it('steps months with day clamping', () => {
    const start = ms('2026-01-31T12:00:00Z');
    const out = expandRecurrence(
      start,
      3600_000,
      { freq: 'MONTHLY', interval: 1, count: 3, byDay: [] },
      start,
      ms('2026-12-31T00:00:00Z')
    ).map((i) => new Date(i.start).toISOString().slice(0, 10));
    expect(out).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });
});

describe('parseIcsDuration', () => {
  it('parses common durations', () => {
    expect(parseIcsDuration('PT1H')).toBe(3600_000);
    expect(parseIcsDuration('PT1H30M')).toBe(5400_000);
    expect(parseIcsDuration('P2D')).toBe(2 * 86_400_000);
    expect(parseIcsDuration('PT0S')).toBe(0);
  });
});

describe('parseBusyIntervals', () => {
  const window = { windowStart: ms('2026-06-01T00:00:00Z'), windowEnd: ms('2026-06-30T00:00:00Z') };

  it('reads a simple timed VEVENT', () => {
    const doc = ics(
      vevent('UID:1\r\nDTSTART:20260610T150000Z\r\nDTEND:20260610T160000Z\r\nSUMMARY:Busy')
    );
    expect(parseBusyIntervals(doc, window)).toEqual([
      { start: ms('2026-06-10T15:00:00Z'), end: ms('2026-06-10T16:00:00Z') },
    ]);
  });

  it('uses DURATION when DTEND is absent', () => {
    const doc = ics(vevent('UID:2\r\nDTSTART:20260610T150000Z\r\nDURATION:PT30M'));
    expect(parseBusyIntervals(doc, window)).toEqual([
      { start: ms('2026-06-10T15:00:00Z'), end: ms('2026-06-10T15:30:00Z') },
    ]);
  });

  it('treats an all-day VALUE=DATE event as a full UTC day', () => {
    const doc = ics(vevent('UID:3\r\nDTSTART;VALUE=DATE:20260612\r\nDTEND;VALUE=DATE:20260613'));
    expect(parseBusyIntervals(doc, window)).toEqual([
      { start: ms('2026-06-12T00:00:00Z'), end: ms('2026-06-13T00:00:00Z') },
    ]);
  });

  it('skips CANCELLED and TRANSPARENT events', () => {
    const doc = ics(
      vevent('UID:4\r\nDTSTART:20260610T150000Z\r\nDTEND:20260610T160000Z\r\nSTATUS:CANCELLED'),
      vevent('UID:5\r\nDTSTART:20260611T150000Z\r\nDTEND:20260611T160000Z\r\nTRANSP:TRANSPARENT')
    );
    expect(parseBusyIntervals(doc, window)).toEqual([]);
  });

  it('expands a recurring VEVENT and merges overlaps', () => {
    const doc = ics(
      vevent(
        'UID:6\r\nDTSTART:20260601T090000Z\r\nDTEND:20260601T100000Z\r\nRRULE:FREQ=DAILY;COUNT=3'
      )
    );
    const out = parseBusyIntervals(doc, window).map((i) =>
      new Date(i.start).toISOString().slice(0, 10)
    );
    expect(out).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
  });

  it('resolves a TZID wall time to the correct UTC instant', () => {
    // 9am America/Denver on 2026-06-10 is 15:00Z (MDT, UTC-6 in June).
    const doc = ics(
      vevent('UID:7\r\nDTSTART;TZID=America/Denver:20260610T090000\r\nDURATION:PT1H')
    );
    expect(parseBusyIntervals(doc, window)).toEqual([
      { start: ms('2026-06-10T15:00:00Z'), end: ms('2026-06-10T16:00:00Z') },
    ]);
  });

  it('unfolds folded lines', () => {
    // RFC 5545 fold: a CRLF followed by a leading space continues the line.
    const folded =
      'BEGIN:VEVENT\r\nUID:8\r\nDTSTART:20260610T150\r\n 000Z\r\nDURATION:PT1H\r\nEND:VEVENT';
    const doc = ics(folded);
    expect(parseBusyIntervals(doc, window)).toEqual([
      { start: ms('2026-06-10T15:00:00Z'), end: ms('2026-06-10T16:00:00Z') },
    ]);
  });
});
