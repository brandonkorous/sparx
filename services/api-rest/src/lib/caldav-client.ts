// CalDAV client for inbound busy import (docs/79 §8.3) — the network half of the
// CalDAV path; the parsing half is the pure @sparx/scheduling caldav-xml reader.
// Owns its own SSRF-guarded transport (we re-validate every redirect hop) rather
// than delegate to a CalDAV library — iCloud 301-redirects from caldav.icloud.com
// to a partition host, and a third-party client's fetch would bypass the guard.
//
// Flow (RFC 4791): PROPFIND current-user-principal → PROPFIND calendar-home-set →
// PROPFIND Depth:1 the home for calendar collections → REPORT calendar-query each
// with a VEVENT time-range, collecting calendar-data ICS. Apple uses Basic auth
// with an app-specific password; the same flow serves generic CalDAV (Fastmail,
// Nextcloud, …) when the tenant supplies the server URL.

import {
  formatIcsUtc,
  parseCalendarCollections,
  parseCalendarData,
  parseCalendarHomeHref,
  parsePrincipalHref,
} from '@sparx/scheduling';

import { assertPublicHttpsUrl } from './scheduling-url-guard.js';

/** Default Apple iCloud CalDAV entry point (discovery redirects to a partition host). */
export const APPLE_ICLOUD_CALDAV = 'https://caldav.icloud.com';

const TIMEOUT_MS = 12_000;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const USER_AGENT = 'sparx-calendar-sync/1';

/** A user-facing CalDAV error — lands in the connection's `last_error`. */
export class CalDavError extends Error {}

export interface CalDavAuth {
  username: string;
  password: string;
}

const PROPFIND_PRINCIPAL = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>`;

const PROPFIND_HOME = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-home-set/></d:prop></d:propfind>`;

const PROPFIND_CALENDARS = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:resourcetype/><d:displayname/><c:supported-calendar-component-set/></d:prop></d:propfind>`;

function calendarQueryBody(windowStart: number, windowEnd: number): string {
  const start = formatIcsUtc(new Date(windowStart));
  const end = formatIcsUtc(new Date(windowEnd));
  return `<?xml version="1.0" encoding="utf-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><c:calendar-data/></d:prop>
  <c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT">
    <c:time-range start="${start}" end="${end}"/>
  </c:comp-filter></c:comp-filter></c:filter>
</c:calendar-query>`;
}

function authHeader(auth: CalDavAuth): string {
  return `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString('base64')}`;
}

/** eTLD+1-ish (last two labels) — good enough to keep Basic creds within one
 *  provider across a redirect (caldav.icloud.com → p52-caldav.icloud.com). */
function registrable(host: string): string {
  return host.toLowerCase().split('.').slice(-2).join('.');
}

interface CalDavResponse {
  status: number;
  body: string;
  finalUrl: URL;
}

interface CalDavRequest {
  auth: CalDavAuth;
  depth?: '0' | '1';
  body?: string;
}

/** One CalDAV request with SSRF guard, timeout, size cap, and per-hop redirect
 *  re-validation. Basic auth is only re-sent across a redirect that stays within
 *  the same provider, so creds never leak to an attacker-controlled host. */
async function caldavFetch(
  method: 'PROPFIND' | 'REPORT',
  rawUrl: string,
  { auth, depth, body }: CalDavRequest
): Promise<CalDavResponse> {
  let url = await assertPublicHttpsUrl(rawUrl);
  const originHost = url.hostname.toLowerCase();

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const sendAuth = registrable(originHost) === registrable(url.hostname);
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          ...(sendAuth ? { Authorization: authHeader(auth) } : {}),
          ...(depth ? { Depth: depth } : {}),
          ...(body !== undefined ? { 'Content-Type': 'application/xml; charset=utf-8' } : {}),
          Accept: 'application/xml, text/xml;q=0.9',
          'User-Agent': USER_AGENT,
        },
        body,
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new CalDavError(`CalDAV redirect without a location (${res.status}).`);
      url = await assertPublicHttpsUrl(new URL(location, url).toString());
      continue;
    }
    if (res.status === 401 || res.status === 403) {
      throw new CalDavError('The calendar server rejected the username or app-specific password.');
    }
    // CalDAV success is 207 Multi-Status; tolerate a plain 200 from lenient servers.
    if (res.status !== 207 && !res.ok) {
      throw new CalDavError(`The calendar server responded ${res.status}.`);
    }
    const declared = Number(res.headers.get('content-length') ?? '0');
    if (declared > MAX_BYTES) throw new CalDavError('The calendar server response is too large.');
    const text = await res.text();
    if (text.length > MAX_BYTES)
      throw new CalDavError('The calendar server response is too large.');
    return { status: res.status, body: text, finalUrl: url };
  }
  throw new CalDavError('The calendar server redirected too many times.');
}

/** Resolve the account's calendar-home-set URL (two PROPFINDs). */
export async function discoverCalendarHome(serverUrl: string, auth: CalDavAuth): Promise<string> {
  const principalRes = await caldavFetch('PROPFIND', serverUrl, {
    auth,
    depth: '0',
    body: PROPFIND_PRINCIPAL,
  });
  const principalHref = parsePrincipalHref(principalRes.body);
  if (!principalHref) throw new CalDavError('Could not find the calendar account (no principal).');
  const principalUrl = new URL(principalHref, principalRes.finalUrl).toString();

  const homeRes = await caldavFetch('PROPFIND', principalUrl, {
    auth,
    depth: '0',
    body: PROPFIND_HOME,
  });
  const homeHref = parseCalendarHomeHref(homeRes.body);
  if (!homeHref) throw new CalDavError('Could not find the calendar home for this account.');
  return new URL(homeHref, homeRes.finalUrl).toString();
}

interface ResolvedCalendar {
  url: string;
  displayName: string | null;
  supportsVevent: boolean;
}

/** List the calendar collections under the home, with absolute URLs. */
export async function listCalendars(
  homeUrl: string,
  auth: CalDavAuth
): Promise<ResolvedCalendar[]> {
  const res = await caldavFetch('PROPFIND', homeUrl, {
    auth,
    depth: '1',
    body: PROPFIND_CALENDARS,
  });
  return parseCalendarCollections(res.body).map((c) => ({
    url: new URL(c.href, res.finalUrl).toString(),
    displayName: c.displayName,
    supportsVevent: c.supportsVevent,
  }));
}

export interface CalDavBusyResult {
  /** Concatenated ICS of every matching VEVENT — feed to parseBusyIntervals. */
  ics: string;
  /** Count of VEVENT-capable calendars queried (for the dashboard). */
  calendars: number;
}

export interface FetchCalDavBusyOptions {
  serverUrl: string;
  auth: CalDavAuth;
  windowStart: number;
  windowEnd: number;
}

/** Discover the account, query each VEVENT calendar over the window, and return
 *  the concatenated busy ICS. */
export async function fetchCalDavBusyIcs(opts: FetchCalDavBusyOptions): Promise<CalDavBusyResult> {
  const { serverUrl, auth, windowStart, windowEnd } = opts;
  const home = await discoverCalendarHome(serverUrl, auth);
  const calendars = (await listCalendars(home, auth)).filter((c) => c.supportsVevent);
  if (calendars.length === 0) return { ics: '', calendars: 0 };

  const body = calendarQueryBody(windowStart, windowEnd);
  const blobs: string[] = [];
  for (const cal of calendars) {
    const res = await caldavFetch('REPORT', cal.url, { auth, depth: '1', body });
    blobs.push(...parseCalendarData(res.body));
  }
  return { ics: blobs.join('\r\n'), calendars: calendars.length };
}
