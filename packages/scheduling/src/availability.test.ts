// Pure-core availability tests (docs/79 §7.2) — no DB, fixed instants, fully
// deterministic. Verifies slot generation, buffers/lead, busy subtraction, and
// the multi-role intersection that makes a slot offered only when every required
// role has a free resource.

import { describe, expect, it } from 'vitest';

import { computeSlots, resourceFreeIntervals, type ResourceAvailability } from './availability';
import { subtractIntervals } from './time';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// A concrete day; derive its weekday so the window matches regardless of zone.
const DATE_UTC = Date.UTC(2030, 0, 7); // 2030-01-07, midnight UTC
const WEEKDAY = new Date(DATE_UTC).getUTCDay();
const NOW = Date.UTC(2030, 0, 1); // well before the day under test

function utcResource(busy: [number, number][] = []): ResourceAvailability {
  return {
    resourceId: 'r1',
    timezone: 'UTC',
    windows: [
      {
        dayOfWeek: WEEKDAY,
        startMinute: 9 * 60,
        endMinute: 17 * 60,
        validFrom: null,
        validTo: null,
      },
    ],
    busy: busy.map(([s, e]) => ({ start: s, end: e })),
  };
}

const baseInput = {
  fromUtc: DATE_UTC,
  toUtc: DATE_UTC + DAY,
  nowUtc: NOW,
  durationMs: HOUR,
  bufferBeforeMs: 0,
  bufferAfterMs: 0,
  slotIntervalMs: HOUR,
  minLeadMs: 0,
  maxAdvanceMs: 365 * DAY,
};

describe('subtractIntervals', () => {
  it('removes a middle cut, leaving two segments', () => {
    const out = subtractIntervals([{ start: 0, end: 100 }], [{ start: 40, end: 60 }]);
    expect(out).toEqual([
      { start: 0, end: 40 },
      { start: 60, end: 100 },
    ]);
  });

  it('treats adjacency as non-overlapping ([) half-open)', () => {
    const out = subtractIntervals([{ start: 0, end: 100 }], [{ start: 100, end: 200 }]);
    expect(out).toEqual([{ start: 0, end: 100 }]);
  });
});

describe('resourceFreeIntervals', () => {
  it('expands a 9-5 window and subtracts a busy block', () => {
    const free = resourceFreeIntervals(
      utcResource([[DATE_UTC + 12 * HOUR, DATE_UTC + 13 * HOUR]]),
      DATE_UTC,
      DATE_UTC + DAY
    );
    expect(free).toEqual([
      { start: DATE_UTC + 9 * HOUR, end: DATE_UTC + 12 * HOUR },
      { start: DATE_UTC + 13 * HOUR, end: DATE_UTC + 17 * HOUR },
    ]);
  });
});

describe('resourceFreeIntervals — custom_hours overrides', () => {
  // A custom-hours override for the whole day under test: 10:00–13:00 local.
  const override = (startMin: number, endMin: number) => ({
    start: DATE_UTC,
    end: DATE_UTC + DAY,
    startMinute: startMin,
    endMinute: endMin,
  });

  it('(a) opens the custom hours INSTEAD of the weekly hours', () => {
    // Weekly is 9–17; the override makes the day 10:00–13:00. The result is exactly
    // the custom hours — the weekly 9–10 and 13–17 stretches are gone.
    const free = resourceFreeIntervals(
      { ...utcResource(), overrides: [override(10 * 60, 13 * 60)] },
      DATE_UTC,
      DATE_UTC + DAY
    );
    expect(free).toEqual([{ start: DATE_UTC + 10 * HOUR, end: DATE_UTC + 13 * HOUR }]);
  });

  it('(b-widen) a wider custom window adds capacity beyond the weekly hours', () => {
    // Override 07:00–20:00 is wider than the 9–17 weekly window → 13h, not 8h.
    const free = resourceFreeIntervals(
      { ...utcResource(), overrides: [override(7 * 60, 20 * 60)] },
      DATE_UTC,
      DATE_UTC + DAY
    );
    expect(free).toEqual([{ start: DATE_UTC + 7 * HOUR, end: DATE_UTC + 20 * HOUR }]);
  });

  it('(b-narrow) a narrower custom window removes capacity', () => {
    const free = resourceFreeIntervals(
      { ...utcResource(), overrides: [override(11 * 60, 12 * 60)] },
      DATE_UTC,
      DATE_UTC + DAY
    );
    expect(free).toEqual([{ start: DATE_UTC + 11 * HOUR, end: DATE_UTC + 12 * HOUR }]);
    const minutes = free.reduce((sum, iv) => sum + (iv.end - iv.start), 0) / MIN;
    expect(minutes).toBe(60); // vs 480 weekly
  });

  it('(c) a closure still subtracts from a custom-hours day', () => {
    // Custom 10:00–16:00, with a busy closure carved 12:00–13:00 out of it.
    const res = {
      ...utcResource([[DATE_UTC + 12 * HOUR, DATE_UTC + 13 * HOUR]]),
      overrides: [override(10 * 60, 16 * 60)],
    };
    const free = resourceFreeIntervals(res, DATE_UTC, DATE_UTC + DAY);
    expect(free).toEqual([
      { start: DATE_UTC + 10 * HOUR, end: DATE_UTC + 12 * HOUR },
      { start: DATE_UTC + 13 * HOUR, end: DATE_UTC + 16 * HOUR },
    ]);
  });

  it('(c-multi-day) the override only reshapes the days it touches', () => {
    // A two-day resource, override covers ONLY the first day (10–14). The weekly
    // 9–17 must remain untouched on the second day.
    const res: ResourceAvailability = {
      ...utcResource(),
      windows: [
        {
          dayOfWeek: WEEKDAY,
          startMinute: 9 * 60,
          endMinute: 17 * 60,
          validFrom: null,
          validTo: null,
        },
        {
          dayOfWeek: (WEEKDAY + 1) % 7,
          startMinute: 9 * 60,
          endMinute: 17 * 60,
          validFrom: null,
          validTo: null,
        },
      ],
      overrides: [
        { start: DATE_UTC, end: DATE_UTC + DAY, startMinute: 10 * 60, endMinute: 14 * 60 },
      ],
    };
    const free = resourceFreeIntervals(res, DATE_UTC, DATE_UTC + 2 * DAY);
    expect(free).toEqual([
      { start: DATE_UTC + 10 * HOUR, end: DATE_UTC + 14 * HOUR }, // day 1: custom
      { start: DATE_UTC + DAY + 9 * HOUR, end: DATE_UTC + DAY + 17 * HOUR }, // day 2: weekly
    ]);
  });

  it('(d) no overrides = identical to the plain weekly behaviour (regression guard)', () => {
    const busy: [number, number][] = [[DATE_UTC + 12 * HOUR, DATE_UTC + 13 * HOUR]];
    const plain = resourceFreeIntervals(utcResource(busy), DATE_UTC, DATE_UTC + DAY);
    const withEmpty = resourceFreeIntervals(
      { ...utcResource(busy), overrides: [] },
      DATE_UTC,
      DATE_UTC + DAY
    );
    expect(withEmpty).toEqual(plain);
  });

  it('skips a day with no weekly window but honours a custom-hours override on it', () => {
    // Resource closed on WEEKDAY+1 normally; a custom-hours override opens it 9–12.
    const openDay = DATE_UTC + DAY;
    const res: ResourceAvailability = {
      ...utcResource(),
      overrides: [{ start: openDay, end: openDay + DAY, startMinute: 9 * 60, endMinute: 12 * 60 }],
    };
    const free = resourceFreeIntervals(res, openDay, openDay + DAY);
    expect(free).toEqual([{ start: openDay + 9 * HOUR, end: openDay + 12 * HOUR }]);
  });

  it('(e) DST boundary — custom minutes are local wall-clock, not raw UTC math', () => {
    // US spring-forward 2030-03-10 in America/Denver: 02:00 → 03:00 local, the day
    // is 23h long. A custom 09:00–13:00 must resolve to the correct wall clock via
    // localWallToUtc, so 09:00 MDT = 15:00 UTC, 13:00 MDT = 19:00 UTC.
    const tz = 'America/Denver';
    const dstDayLocalMidnightUtc = Date.UTC(2030, 2, 10, 7); // 2030-03-10 00:00 MST = 07:00 UTC
    const res: ResourceAvailability = {
      resourceId: 'r1',
      timezone: tz,
      windows: [],
      busy: [],
      overrides: [
        {
          start: dstDayLocalMidnightUtc,
          end: dstDayLocalMidnightUtc + DAY,
          startMinute: 9 * 60,
          endMinute: 13 * 60,
        },
      ],
    };
    const free = resourceFreeIntervals(res, dstDayLocalMidnightUtc, dstDayLocalMidnightUtc + DAY);
    // 09:00 MDT (UTC-6) = 15:00 UTC; 13:00 MDT = 19:00 UTC.
    const nineMdtUtc = Date.UTC(2030, 2, 10, 15);
    const oneMdtUtc = Date.UTC(2030, 2, 10, 19);
    expect(free).toEqual([{ start: nineMdtUtc, end: oneMdtUtc }]);
  });
});

describe('computeSlots', () => {
  it('produces hourly slots across a 9-5 window', () => {
    const slots = computeSlots({
      ...baseInput,
      roles: [{ role: 'staff', resources: [utcResource()] }],
    });
    expect(slots).toHaveLength(8); // 9,10,11,12,13,14,15,16
    expect(slots[0]!.startAtUtc).toBe(DATE_UTC + 9 * HOUR);
    expect(slots[7]!.startAtUtc).toBe(DATE_UTC + 16 * HOUR);
    expect(slots[0]!.candidatesByRole.staff).toEqual(['r1']);
  });

  it('drops the slot covered by a busy block', () => {
    const slots = computeSlots({
      ...baseInput,
      roles: [
        { role: 'staff', resources: [utcResource([[DATE_UTC + 12 * HOUR, DATE_UTC + 13 * HOUR]])] },
      ],
    });
    expect(slots).toHaveLength(7);
    expect(slots.some((s) => s.startAtUtc === DATE_UTC + 12 * HOUR)).toBe(false);
  });

  it('honors buffers — a 30m buffer each side shrinks the bookable edges', () => {
    const slots = computeSlots({
      ...baseInput,
      bufferBeforeMs: 30 * MIN,
      bufferAfterMs: 30 * MIN,
      roles: [{ role: 'staff', resources: [utcResource()] }],
    });
    // occupied = [start-30m, start+90m] must fit in [9:00,17:00] → first start 9:30,
    // last start 15:30; on the 60m grid that's 10:00..15:00 = 6 slots.
    expect(slots[0]!.startAtUtc).toBe(DATE_UTC + 10 * HOUR);
    expect(slots[slots.length - 1]!.startAtUtc).toBe(DATE_UTC + 15 * HOUR);
  });

  it('offers a slot only when EVERY role has a free resource', () => {
    const freeRole = { role: 'stylist', resources: [utcResource()] };
    const blockedRole = {
      role: 'chair',
      resources: [
        {
          ...utcResource([[DATE_UTC + 9 * HOUR, DATE_UTC + 17 * HOUR]]),
          resourceId: 'chair1',
        },
      ],
    };
    expect(computeSlots({ ...baseInput, roles: [freeRole, blockedRole] })).toHaveLength(0);
  });

  it('offers slots for the custom hours and none outside them', () => {
    // Weekly 9–17, override narrows the day to 10:00–13:00 → hourly starts at
    // 10, 11, 12 only (a 1h service). The 9:00 and 13:00+ weekly slots are gone.
    const res: ResourceAvailability = {
      ...utcResource(),
      overrides: [
        { start: DATE_UTC, end: DATE_UTC + DAY, startMinute: 10 * 60, endMinute: 13 * 60 },
      ],
    };
    const slots = computeSlots({
      ...baseInput,
      roles: [{ role: 'staff', resources: [res] }],
    });
    expect(slots.map((s) => s.startAtUtc)).toEqual([
      DATE_UTC + 10 * HOUR,
      DATE_UTC + 11 * HOUR,
      DATE_UTC + 12 * HOUR,
    ]);
    expect(slots.some((s) => s.startAtUtc === DATE_UTC + 9 * HOUR)).toBe(false);
  });

  it('respects min lead time', () => {
    const slots = computeSlots({
      ...baseInput,
      nowUtc: DATE_UTC + 11 * HOUR, // "now" is mid-day
      minLeadMs: 2 * HOUR, // earliest bookable = 13:00
      roles: [{ role: 'staff', resources: [utcResource()] }],
    });
    expect(slots[0]!.startAtUtc).toBe(DATE_UTC + 13 * HOUR);
  });
});
