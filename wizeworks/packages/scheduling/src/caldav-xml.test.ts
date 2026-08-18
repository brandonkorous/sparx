import { describe, expect, it } from 'vitest';

import {
  elementPresent,
  extractElements,
  extractHref,
  parseCalendarCollections,
  parseCalendarData,
  parseCalendarHomeHref,
  parsePrincipalHref,
  xmlUnescape,
} from './caldav-xml';
import { parseBusyIntervals } from './ical-parse';

describe('caldav-xml low-level extractors', () => {
  it('extracts elements regardless of namespace prefix', () => {
    const xml = '<d:href>/a/</d:href><href>/b/</href><D:href>/c/</D:href>';
    expect(extractElements(xml, 'href')).toEqual(['/a/', '/b/', '/c/']);
  });

  it('xmlUnescape decodes named, decimal, and hex entities (amp last)', () => {
    expect(xmlUnescape('Work &amp; Travel &lt;1&gt; &#13;&#x0A;&quot;x&quot;')).toBe(
      'Work & Travel <1> \r\n"x"'
    );
  });

  it('elementPresent respects local-name boundaries', () => {
    expect(elementPresent('<C:calendar/>', 'calendar')).toBe(true);
    expect(elementPresent('<d:collection/>', 'calendar')).toBe(false);
    // must NOT match the longer names that share the prefix
    expect(elementPresent('<C:calendar-data>x</C:calendar-data>', 'calendar')).toBe(false);
    expect(elementPresent('<c:calendar-home-set/>', 'calendar')).toBe(false);
  });

  it('extractHref trims, unescapes, and returns null when empty', () => {
    expect(extractHref('<x><d:href> /p/&amp;q/ </d:href></x>')).toBe('/p/&q/');
    expect(extractHref('<x><href></href></x>')).toBeNull();
    expect(extractHref('<x>nope</x>')).toBeNull();
  });
});

describe('parsePrincipalHref / parseCalendarHomeHref', () => {
  it('reads the current-user-principal href (default namespace)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<multistatus xmlns="DAV:"><response><href>/</href><propstat><prop>
  <current-user-principal><href>/146/principal/</href></current-user-principal>
</prop><status>HTTP/1.1 200 OK</status></propstat></response></multistatus>`;
    expect(parsePrincipalHref(xml)).toBe('/146/principal/');
  });

  it('reads the calendar-home-set href (prefixed namespace)', () => {
    const xml = `<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
<d:response><d:href>/146/principal/</d:href><d:propstat><d:prop>
  <c:calendar-home-set><d:href>https://p52-caldav.icloud.com/146/calendars/</d:href></c:calendar-home-set>
</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`;
    expect(parseCalendarHomeHref(xml)).toBe('https://p52-caldav.icloud.com/146/calendars/');
  });

  it('returns null when the property is absent', () => {
    expect(parsePrincipalHref('<multistatus xmlns="DAV:"></multistatus>')).toBeNull();
    expect(parseCalendarHomeHref('<multistatus xmlns="DAV:"></multistatus>')).toBeNull();
  });
});

describe('parseCalendarCollections', () => {
  const xml = `<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:response>
    <d:href>/146/calendars/</d:href>
    <d:propstat><d:prop>
      <d:resourcetype><d:collection/></d:resourcetype>
      <d:displayname></d:displayname>
    </d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>
  </d:response>
  <d:response>
    <d:href>/146/calendars/work/</d:href>
    <d:propstat><d:prop>
      <d:resourcetype><d:collection/><c:calendar/></d:resourcetype>
      <d:displayname>Work &amp; Travel</d:displayname>
      <c:supported-calendar-component-set><c:comp name="VEVENT"/><c:comp name="VTODO"/></c:supported-calendar-component-set>
    </d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>
  </d:response>
  <d:response>
    <d:href>/146/calendars/reminders/</d:href>
    <d:propstat><d:prop>
      <d:resourcetype><d:collection/><c:calendar/></d:resourcetype>
      <d:displayname>Reminders</d:displayname>
      <c:supported-calendar-component-set><c:comp name="VTODO"/></c:supported-calendar-component-set>
    </d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>
  </d:response>
  <d:response>
    <d:href>/146/calendars/inbox/</d:href>
    <d:propstat><d:prop>
      <d:resourcetype><d:collection/><c:schedule-inbox/></d:resourcetype>
      <d:displayname>inbox</d:displayname>
    </d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>
  </d:response>
</d:multistatus>`;

  it('returns only calendar collections (home, inbox, address books excluded)', () => {
    const cals = parseCalendarCollections(xml);
    expect(cals.map((c) => c.href)).toEqual(['/146/calendars/work/', '/146/calendars/reminders/']);
  });

  it('unescapes the display name and reads VEVENT support', () => {
    const cals = parseCalendarCollections(xml);
    const work = cals.find((c) => c.href === '/146/calendars/work/')!;
    const reminders = cals.find((c) => c.href === '/146/calendars/reminders/')!;
    expect(work.displayName).toBe('Work & Travel');
    expect(work.supportsVevent).toBe(true);
    expect(reminders.supportsVevent).toBe(false); // VTODO only
  });

  it('defaults supportsVevent to true when the component-set is omitted', () => {
    const minimal = `<multistatus xmlns="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
      <response><href>/cal/</href><propstat><prop>
        <resourcetype><collection/><c:calendar/></resourcetype>
      </prop></propstat></response></multistatus>`;
    expect(parseCalendarCollections(minimal)[0]?.supportsVevent).toBe(true);
  });
});

describe('parseCalendarData', () => {
  it('extracts entity-escaped ICS blobs and parses to busy intervals', () => {
    const report = `<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:response>
    <d:href>/146/calendars/work/a.ics</d:href>
    <d:propstat><d:prop>
      <c:calendar-data>BEGIN:VCALENDAR&#13;
VERSION:2.0&#13;
BEGIN:VEVENT&#13;
UID:a&#13;
DTSTART:20260620T150000Z&#13;
DTEND:20260620T160000Z&#13;
END:VEVENT&#13;
END:VCALENDAR</c:calendar-data>
    </d:prop></d:propstat>
  </d:response>
</d:multistatus>`;
    const blobs = parseCalendarData(report);
    expect(blobs).toHaveLength(1);
    const busy = parseBusyIntervals(blobs.join('\r\n'), {
      windowStart: Date.UTC(2026, 5, 1),
      windowEnd: Date.UTC(2026, 6, 1),
    });
    expect(busy).toEqual([{ start: Date.UTC(2026, 5, 20, 15), end: Date.UTC(2026, 5, 20, 16) }]);
  });

  it('handles CDATA-wrapped calendar-data and skips VEVENT-less blobs', () => {
    const report = `<multistatus xmlns="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <response><href>/c/b.ics</href><propstat><prop>
    <c:calendar-data><![CDATA[BEGIN:VCALENDAR\r
BEGIN:VEVENT\r
UID:b\r
DTSTART:20260621T090000Z\r
DTEND:20260621T093000Z\r
END:VEVENT\r
END:VCALENDAR]]></c:calendar-data>
  </prop></propstat></response>
  <response><href>/c/empty.ics</href><propstat><prop>
    <c:calendar-data>BEGIN:VCALENDAR&#13;
END:VCALENDAR</c:calendar-data>
  </prop></propstat></response>
</multistatus>`;
    expect(parseCalendarData(report)).toHaveLength(1);
  });
});
