// The business's calendar day (sparx persona issue 174), measured across a
// month edge in Denver: UTC−6 in October, UTC−7 in December.

import { describe, expect, it } from 'vitest';

import {
  businessDateKey,
  businessDayKeyer,
  businessDayRange,
  businessDayStart,
  calendarZone,
  rangeDayKey,
  shiftDateKey,
} from './business-day';

const DENVER = 'America/Denver';
const at = (iso: string) => new Date(iso);

describe('businessDateKey', () => {
  it("files a Denver sale at 11:30pm on Oct 31 under Oct 31, not UTC's Nov 1", () => {
    expect(businessDateKey(at('2026-11-01T05:30:00Z'), DENVER)).toBe('2026-10-31');
  });

  it('files the winter evening of Dec 31 under Dec 31, a year before UTC says', () => {
    // 11:30pm MST is 06:30 UTC on Jan 1.
    expect(businessDateKey(at('2027-01-01T06:30:00Z'), DENVER)).toBe('2026-12-31');
  });

  it('keeps the UTC day for a business that has not said where it is', () => {
    expect(businessDateKey(at('2026-11-01T05:30:00Z'), null)).toBe('2026-11-01');
    expect(businessDateKey(at('2026-11-01T05:30:00Z'), '  ')).toBe('2026-11-01');
  });

  it('keeps the UTC day for a zone the runtime does not know, rather than throwing', () => {
    expect(calendarZone('Mars/Olympus_Mons')).toBe('UTC');
    expect(businessDateKey(at('2026-11-01T05:30:00Z'), 'Mars/Olympus_Mons')).toBe('2026-11-01');
  });
});

describe('businessDayKeyer', () => {
  it('answers what businessDateKey answers, on both sides of midnight and the clock change', () => {
    const keyOf = businessDayKeyer(DENVER);
    for (const iso of [
      '2026-11-01T05:59:59.999Z', // 11:59pm Oct 31 MDT
      '2026-11-01T06:00:00.000Z', // midnight Nov 1 MDT
      '2026-11-01T07:59:59.999Z', // 1:59am MDT, the hour before the clocks go back
      '2026-11-01T08:00:00.000Z', // 1:00am MST, the repeated hour
      '2026-11-02T06:59:59.999Z', // 11:59pm Nov 1 MST
      '2026-11-02T07:00:00.000Z', // midnight Nov 2 MST
    ]) {
      expect(keyOf(at(iso))).toBe(businessDateKey(at(iso), DENVER));
    }
    expect(keyOf(at('2026-11-02T06:59:59.999Z'))).toBe('2026-11-01');
    expect(keyOf(at('2026-11-02T07:00:00.000Z'))).toBe('2026-11-02');
  });
});

describe('businessDayRange', () => {
  it("is Denver's midnight to midnight, as moments", () => {
    const { start, end } = businessDayRange('2026-10-31', DENVER);
    expect(start.toISOString()).toBe('2026-10-31T06:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-01T06:00:00.000Z');
  });

  it('is 25 hours on the day the clocks go back', () => {
    const { start, end } = businessDayRange('2026-11-01', DENVER);
    expect(start.toISOString()).toBe('2026-11-01T06:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-02T07:00:00.000Z');
  });

  it('reads a midnight-UTC date as that date, not the day before', () => {
    expect(businessDayStart(at('2026-10-01T00:00:00Z'), DENVER).toISOString()).toBe(
      '2026-10-01T06:00:00.000Z'
    );
  });

  it('is the UTC day without a zone', () => {
    const { start, end } = businessDayRange('2026-10-31', null);
    expect(start.toISOString()).toBe('2026-10-31T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });
});

describe('rangeDayKey', () => {
  it('takes a date as written', () => {
    expect(rangeDayKey('2026-10-01', DENVER)).toBe('2026-10-01');
    expect(rangeDayKey('2026-10-01T00:00:00.000Z', DENVER)).toBe('2026-10-01');
  });

  it("takes a moment as the business's day: 9pm in Denver is still today", () => {
    expect(rangeDayKey('2026-10-10T03:00:00.000Z', DENVER)).toBe('2026-10-09');
  });
});

describe('shiftDateKey', () => {
  it('crosses month and year ends', () => {
    expect(shiftDateKey('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftDateKey('2027-01-01', -1)).toBe('2026-12-31');
  });
});
