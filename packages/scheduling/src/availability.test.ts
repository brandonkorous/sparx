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
