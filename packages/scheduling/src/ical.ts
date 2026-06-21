// RFC 5545 (iCalendar) generation for calendar sync (docs/79 §8.1) — the outbound
// layer every tenant gets with zero setup. PURE: no DB, no clock, no env, fully
// unit-tested. Two shapes share one serializer:
//   · buildIcsEvent — one VEVENT in a VCALENDAR (the per-booking `.ics` download +
//     the "Add to Apple/Outlook-desktop" attachment).
//   · buildIcsFeed  — a VCALENDAR of many events (a resource's subscribe-to feed:
//     the staff member adds the signed URL once and their sparx bookings appear).
// Plus Google/Outlook-web "Add to calendar" deep links (the `.ics` covers everyone
// else). docs/79 §8.1 calls out that subscribed feeds are provider-cached (Google
// ~12h, Outlook ~24h) — that's a feed limitation, surfaced in the UI copy, never a
// correctness claim; the DB-level no-overlap constraint (§7.4) is the real guard.
//
// Instants are emitted as UTC (`…Z`) so no VTIMEZONE component is needed: a booking
// is a fixed instant, and every client renders that instant in the viewer's own
// zone — which is exactly right. The booking's own `timezone` only matters for the
// human-readable copy we build elsewhere (email-data `inZone`), not the machine event.

export type IcsStatus = 'confirmed' | 'tentative' | 'cancelled';

export interface IcsEvent {
  /** Stable + globally unique for the lifetime of the event (e.g. `<bookingId>@sparx.works`).
   *  Clients key updates off the UID, so it MUST be identical across reschedules. */
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  status?: IcsStatus;
  organizerName?: string;
  organizerEmail?: string;
  /** Bumped on every change (reschedule / status flip) so clients refresh rather
   *  than treat it as a duplicate. Defaults to 0. */
  sequence?: number;
  /** DTSTAMP / last-touched instant — pass the booking's `updatedAt` (else `createdAt`). */
  stamp: Date;
}

export interface IcsCalendarMeta {
  /** X-WR-CALNAME — the feed's display name in the subscriber's calendar list. */
  calName?: string;
  method?: 'PUBLISH' | 'REQUEST';
  /** Refresh hint for subscribed feeds (ISO-8601 duration, e.g. `PT12H`). */
  ttl?: string;
}

const PRODID = '-//WizeWorks//sparx Scheduling//EN';

const STATUS_KEYWORD: Record<IcsStatus, string> = {
  confirmed: 'CONFIRMED',
  tentative: 'TENTATIVE',
  cancelled: 'CANCELLED',
};

/** `YYYYMMDDTHHMMSSZ` — the RFC 5545 UTC date-time form. */
export function formatIcsUtc(d: Date): string {
  const iso = d.toISOString(); // 2026-06-20T15:30:00.000Z
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Escape a TEXT value (RFC 5545 §3.3.11): backslash, newline, comma, semicolon. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/** Fold a content line to ≤75 octets (RFC 5545 §3.1) without splitting a UTF-8
 *  multibyte sequence; continuation lines start with a single space. */
function foldLine(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let offset = 0;
  let limit = 75; // first line: 75 octets; continuations reserve 1 octet for the leading space
  while (offset < bytes.length) {
    let end = Math.min(offset + limit, bytes.length);
    // Back off a cut that would land inside a multibyte char (continuation byte = 10xxxxxx).
    if (end < bytes.length) {
      while (end > offset && (bytes[end]! & 0xc0) === 0x80) end -= 1;
    }
    const chunk = bytes.subarray(offset, end).toString('utf8');
    parts.push(parts.length === 0 ? chunk : ` ${chunk}`);
    offset = end;
    limit = 74;
  }
  return parts.join('\r\n');
}

/** A folded `NAME:escaped-value` content line. */
function prop(name: string, value: string): string {
  return foldLine(`${name}:${escapeIcsText(value)}`);
}

/** A folded line whose value is already in canonical form (dates, keywords). */
function propRaw(name: string, value: string): string {
  return foldLine(`${name}:${value}`);
}

function veventLines(event: IcsEvent): string[] {
  const lines = [
    'BEGIN:VEVENT',
    prop('UID', event.uid),
    propRaw('DTSTAMP', formatIcsUtc(event.stamp)),
    propRaw('DTSTART', formatIcsUtc(event.start)),
    propRaw('DTEND', formatIcsUtc(event.end)),
    prop('SUMMARY', event.summary),
  ];
  if (event.description) lines.push(prop('DESCRIPTION', event.description));
  if (event.location) lines.push(prop('LOCATION', event.location));
  if (event.url) lines.push(prop('URL', event.url));
  lines.push(propRaw('STATUS', STATUS_KEYWORD[event.status ?? 'confirmed']));
  lines.push(propRaw('SEQUENCE', String(event.sequence ?? 0)));
  if (event.organizerEmail) {
    // CN param value is always quoted so a name with `:;,` can't break the line.
    const cn = event.organizerName ? `;CN="${event.organizerName.replace(/"/g, '')}"` : '';
    lines.push(foldLine(`ORGANIZER${cn}:mailto:${event.organizerEmail}`));
  }
  lines.push('END:VEVENT');
  return lines;
}

function serialize(events: IcsEvent[], meta: IcsCalendarMeta): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    propRaw('PRODID', PRODID),
    'CALSCALE:GREGORIAN',
    propRaw('METHOD', meta.method ?? 'PUBLISH'),
  ];
  if (meta.calName) lines.push(prop('X-WR-CALNAME', meta.calName));
  if (meta.ttl) {
    lines.push(propRaw('X-PUBLISHED-TTL', meta.ttl));
    lines.push(propRaw('REFRESH-INTERVAL;VALUE=DURATION', meta.ttl));
  }
  for (const event of events) lines.push(...veventLines(event));
  lines.push('END:VCALENDAR');
  // RFC 5545: CRLF line breaks, trailing CRLF.
  return `${lines.join('\r\n')}\r\n`;
}

/** A single-event VCALENDAR — the per-booking `.ics` download / email attachment. */
export function buildIcsEvent(event: IcsEvent, meta: IcsCalendarMeta = {}): string {
  return serialize([event], meta);
}

/** A multi-event VCALENDAR — a resource's subscribe-to feed. */
export function buildIcsFeed(events: IcsEvent[], meta: IcsCalendarMeta): string {
  return serialize(events, meta);
}

// ── "Add to calendar" web deep links ────────────────────────────────────────
// These open a pre-filled "new event" composer in the provider's web UI — the
// one-click path from a confirmation/portal page for users who don't subscribe.

function calDates(start: Date, end: Date): string {
  return `${formatIcsUtc(start)}/${formatIcsUtc(end)}`;
}

/** Google Calendar "create event" template URL. */
export function googleCalendarUrl(
  event: Pick<IcsEvent, 'start' | 'end' | 'summary' | 'description' | 'location'>
): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.summary,
    dates: calDates(event.start, event.end),
  });
  if (event.description) params.set('details', event.description);
  if (event.location) params.set('location', event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Outlook (web) "compose event" deep link. */
export function outlookCalendarUrl(
  event: Pick<IcsEvent, 'start' | 'end' | 'summary' | 'description' | 'location'>
): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.summary,
    startdt: event.start.toISOString(),
    enddt: event.end.toISOString(),
  });
  if (event.description) params.set('body', event.description);
  if (event.location) params.set('location', event.location);
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}
