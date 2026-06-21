import { describe, expect, it } from 'vitest';

import {
  buildIcsEvent,
  buildIcsFeed,
  escapeIcsText,
  formatIcsUtc,
  googleCalendarUrl,
  outlookCalendarUrl,
  type IcsEvent,
} from './ical';

const event: IcsEvent = {
  uid: 'booking-1@sparx.works',
  start: new Date('2026-06-20T15:30:00.000Z'),
  end: new Date('2026-06-20T16:30:00.000Z'),
  summary: 'Haircut',
  description: 'With Alex',
  location: 'Main location',
  status: 'confirmed',
  stamp: new Date('2026-06-19T12:00:00.000Z'),
};

/** Unfold an .ics back into logical lines (CRLF + leading space = continuation). */
function unfold(ics: string): string[] {
  return ics.replace(/\r\n[ \t]/g, '').split('\r\n');
}

describe('formatIcsUtc', () => {
  it('emits the RFC 5545 UTC date-time form', () => {
    expect(formatIcsUtc(new Date('2026-06-20T15:30:00.000Z'))).toBe('20260620T153000Z');
  });
});

describe('escapeIcsText', () => {
  it('escapes backslash, newline, comma, semicolon', () => {
    expect(escapeIcsText('a, b; c\\d\ne')).toBe('a\\, b\\; c\\\\d\\ne');
  });
});

describe('buildIcsEvent', () => {
  const ics = buildIcsEvent(event, { method: 'PUBLISH' });
  const lines = unfold(ics);

  it('uses CRLF line endings and a trailing CRLF', () => {
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('\r\n');
    expect(ics).not.toMatch(/[^\r]\n/); // every LF is preceded by CR
  });

  it('wraps one VEVENT in a VCALENDAR', () => {
    expect(lines).toContain('BEGIN:VCALENDAR');
    expect(lines).toContain('VERSION:2.0');
    expect(lines).toContain('PRODID:-//WizeWorks//sparx Scheduling//EN');
    expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
    expect(lines).toContain('END:VEVENT');
    expect(lines).toContain('END:VCALENDAR');
  });

  it('carries the event fields', () => {
    expect(lines).toContain('UID:booking-1@sparx.works');
    expect(lines).toContain('DTSTART:20260620T153000Z');
    expect(lines).toContain('DTEND:20260620T163000Z');
    expect(lines).toContain('DTSTAMP:20260619T120000Z');
    expect(lines).toContain('SUMMARY:Haircut');
    expect(lines).toContain('DESCRIPTION:With Alex');
    expect(lines).toContain('LOCATION:Main location');
    expect(lines).toContain('STATUS:CONFIRMED');
    expect(lines).toContain('SEQUENCE:0');
  });

  it('maps tentative + cancelled status and bumps sequence', () => {
    const cancelled = unfold(buildIcsEvent({ ...event, status: 'cancelled', sequence: 2 }));
    expect(cancelled).toContain('STATUS:CANCELLED');
    expect(cancelled).toContain('SEQUENCE:2');
  });

  it('emits a quoted ORGANIZER when an email is present', () => {
    const withOrg = unfold(
      buildIcsEvent({ ...event, organizerName: 'Bert; Salon', organizerEmail: 'hi@salon.test' })
    );
    expect(withOrg).toContain('ORGANIZER;CN="Bert; Salon":mailto:hi@salon.test');
  });

  it('omits optional lines when absent', () => {
    const bare = unfold(buildIcsEvent({ ...event, description: undefined, location: undefined }));
    expect(bare.some((l) => l.startsWith('DESCRIPTION'))).toBe(false);
    expect(bare.some((l) => l.startsWith('LOCATION'))).toBe(false);
  });

  it('folds long lines to ≤75 octets and round-trips on unfold', () => {
    const long = buildIcsEvent({ ...event, summary: 'X'.repeat(300) });
    for (const raw of long.split('\r\n')) {
      expect(Buffer.from(raw, 'utf8').length).toBeLessThanOrEqual(75);
    }
    expect(unfold(long)).toContain(`SUMMARY:${'X'.repeat(300)}`);
  });

  it('never splits a multibyte char across a fold boundary', () => {
    const emoji = buildIcsEvent({ ...event, summary: '💈'.repeat(40) });
    // If a fold split a 4-byte sequence, unfolding would not reproduce the input.
    expect(unfold(emoji)).toContain(`SUMMARY:${'💈'.repeat(40)}`);
  });
});

describe('buildIcsFeed', () => {
  it('serializes many events with feed metadata', () => {
    const feed = buildIcsFeed([event, { ...event, uid: 'booking-2@sparx.works' }], {
      calName: 'Alex — Bookings',
      ttl: 'PT12H',
    });
    const lines = unfold(feed);
    expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(2);
    expect(lines).toContain('X-WR-CALNAME:Alex — Bookings');
    expect(lines).toContain('X-PUBLISHED-TTL:PT12H');
    expect(lines).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT12H');
  });

  it('produces an empty but valid calendar with no events', () => {
    const lines = unfold(buildIcsFeed([], { calName: 'Empty' }));
    expect(lines).toContain('BEGIN:VCALENDAR');
    expect(lines).toContain('END:VCALENDAR');
    expect(lines.some((l) => l === 'BEGIN:VEVENT')).toBe(false);
  });
});

describe('add-to-calendar deep links', () => {
  it('builds a Google template URL with dates + details', () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.hostname).toBe('calendar.google.com');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('Haircut');
    expect(url.searchParams.get('dates')).toBe('20260620T153000Z/20260620T163000Z');
    expect(url.searchParams.get('location')).toBe('Main location');
  });

  it('builds an Outlook compose URL with ISO instants', () => {
    const url = new URL(outlookCalendarUrl(event));
    expect(url.hostname).toBe('outlook.office.com');
    expect(url.searchParams.get('subject')).toBe('Haircut');
    expect(url.searchParams.get('startdt')).toBe('2026-06-20T15:30:00.000Z');
    expect(url.searchParams.get('rru')).toBe('addevent');
  });
});
