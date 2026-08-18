import { describe, expect, it } from 'vitest';

import {
  bookingICalUid,
  buildGoogleImportEvent,
  googleItemsFrom,
  googleNextPageTokenFrom,
  googleSyncTokenFrom,
  microsoftDeltaLinkFrom,
  microsoftNextLinkFrom,
  microsoftValueFrom,
  parseGoogleBusy,
  parseMicrosoftBusy,
  type BusyWindow,
} from './calendar-events';

const ms = (iso: string): number => Date.parse(iso);

const window: BusyWindow = {
  windowStart: ms('2026-06-01T00:00:00Z'),
  windowEnd: ms('2026-07-01T00:00:00Z'),
  defaultDurationMs: 60 * 60 * 1000,
};

describe('parseGoogleBusy', () => {
  it('reads timed events as busy intervals', () => {
    const out = parseGoogleBusy(
      [
        {
          status: 'confirmed',
          start: { dateTime: '2026-06-10T15:00:00Z' },
          end: { dateTime: '2026-06-10T16:30:00Z' },
        },
      ],
      window
    );
    expect(out).toEqual([{ start: ms('2026-06-10T15:00:00Z'), end: ms('2026-06-10T16:30:00Z') }]);
  });

  it('skips cancelled and transparent (free) events', () => {
    const out = parseGoogleBusy(
      [
        {
          status: 'cancelled',
          start: { dateTime: '2026-06-10T15:00:00Z' },
          end: { dateTime: '2026-06-10T16:00:00Z' },
        },
        {
          transparency: 'transparent',
          start: { dateTime: '2026-06-11T15:00:00Z' },
          end: { dateTime: '2026-06-11T16:00:00Z' },
        },
      ],
      window
    );
    expect(out).toEqual([]);
  });

  it('defaults the end when an event has only a start', () => {
    const out = parseGoogleBusy([{ start: { dateTime: '2026-06-10T15:00:00Z' }, end: {} }], window);
    expect(out).toEqual([{ start: ms('2026-06-10T15:00:00Z'), end: ms('2026-06-10T16:00:00Z') }]);
  });

  it('handles all-day events (exclusive end date)', () => {
    const out = parseGoogleBusy(
      [{ start: { date: '2026-06-10' }, end: { date: '2026-06-11' } }],
      window
    );
    expect(out).toEqual([{ start: ms('2026-06-10T00:00:00Z'), end: ms('2026-06-11T00:00:00Z') }]);
  });

  it('clips events to the busy window and drops out-of-window ones', () => {
    const out = parseGoogleBusy(
      [
        // straddles the window start → clipped
        { start: { dateTime: '2026-05-31T23:00:00Z' }, end: { dateTime: '2026-06-01T01:00:00Z' } },
        // entirely before the window → dropped
        { start: { dateTime: '2026-05-01T10:00:00Z' }, end: { dateTime: '2026-05-01T11:00:00Z' } },
      ],
      window
    );
    expect(out).toEqual([{ start: ms('2026-06-01T00:00:00Z'), end: ms('2026-06-01T01:00:00Z') }]);
  });

  it('pulls sync/page tokens + items from a page response', () => {
    const page = { items: [{ id: 'a' }], nextPageToken: 'pg', nextSyncToken: undefined };
    expect(googleItemsFrom(page)).toHaveLength(1);
    expect(googleNextPageTokenFrom(page)).toBe('pg');
    expect(googleSyncTokenFrom(page)).toBeNull();
    expect(googleSyncTokenFrom({ nextSyncToken: 'sync-123' })).toBe('sync-123');
  });
});

describe('parseMicrosoftBusy', () => {
  it('parses Graph UTC wall-times (no offset suffix) as UTC', () => {
    const out = parseMicrosoftBusy(
      [
        {
          isCancelled: false,
          showAs: 'busy',
          start: { dateTime: '2026-06-10T15:00:00.0000000', timeZone: 'UTC' },
          end: { dateTime: '2026-06-10T16:00:00.0000000', timeZone: 'UTC' },
        },
      ],
      window
    );
    expect(out).toEqual([{ start: ms('2026-06-10T15:00:00Z'), end: ms('2026-06-10T16:00:00Z') }]);
  });

  it('skips cancelled, free, and @removed delta tombstones', () => {
    const out = parseMicrosoftBusy(
      [
        {
          isCancelled: true,
          start: { dateTime: '2026-06-10T15:00:00' },
          end: { dateTime: '2026-06-10T16:00:00' },
        },
        {
          showAs: 'free',
          start: { dateTime: '2026-06-11T15:00:00' },
          end: { dateTime: '2026-06-11T16:00:00' },
        },
        { '@removed': { reason: 'deleted' }, id: 'gone' },
      ],
      window
    );
    expect(out).toEqual([]);
  });

  it('pulls delta/next links + value from a page response', () => {
    const paging = { value: [{ id: 'x' }], '@odata.nextLink': 'https://graph/next' };
    expect(microsoftValueFrom(paging)).toHaveLength(1);
    expect(microsoftNextLinkFrom(paging)).toBe('https://graph/next');
    expect(microsoftDeltaLinkFrom(paging)).toBeNull();
    expect(microsoftDeltaLinkFrom({ '@odata.deltaLink': 'https://graph/delta' })).toBe(
      'https://graph/delta'
    );
  });
});

describe('buildGoogleImportEvent', () => {
  const base = {
    bookingId: 'bk_123',
    start: new Date('2026-06-10T15:00:00Z'),
    end: new Date('2026-06-10T16:00:00Z'),
    summary: 'Oil change',
    cancelled: false,
  };

  it('keys on the stable booking iCalUID (idempotent re-import)', () => {
    const ev = buildGoogleImportEvent(base);
    expect(ev.iCalUID).toBe('bk_123@sparx.works');
    expect(bookingICalUid('bk_123')).toBe('bk_123@sparx.works');
    expect(ev.start).toEqual({ dateTime: '2026-06-10T15:00:00.000Z' });
    expect(ev.status).toBe('confirmed');
    expect(
      (ev.extendedProperties as { private: { sparxBookingId: string } }).private.sparxBookingId
    ).toBe('bk_123');
  });

  it('imports a cancelled booking as a cancelled event', () => {
    expect(buildGoogleImportEvent({ ...base, cancelled: true }).status).toBe('cancelled');
  });

  it('omits empty description/location', () => {
    const ev = buildGoogleImportEvent({ ...base, description: null, location: '' });
    expect(ev.description).toBeUndefined();
    expect(ev.location).toBeUndefined();
    const ev2 = buildGoogleImportEvent({ ...base, description: 'Bay 2', location: 'Shop' });
    expect(ev2.description).toBe('Bay 2');
    expect(ev2.location).toBe('Shop');
  });
});
