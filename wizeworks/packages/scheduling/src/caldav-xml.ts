// CalDAV multistatus (WebDAV) XML readers for inbound calendar sync (docs/79 §8.3).
// PURE: no network, no DB, no clock — the api-rest CalDAV client does the
// SSRF-guarded PROPFIND/REPORT requests and feeds the responses here. Isolating
// the parsing keeps the fragile bit unit-tested (like ical-parse.ts), and keeps
// the engine dependency-free (no XML library — CalDAV responses are a small,
// machine-generated set of well-known elements).
//
// Namespace tolerance: servers prefix the DAV: / caldav: namespaces inconsistently
// (`<d:href>`, `<D:href>`, default-namespace `<href>`). Every matcher accepts an
// optional `prefix:` and matches the element's LOCAL name, so it reads iCloud,
// Fastmail, Google, Nextcloud, and friends without per-vendor branches.

/** A calendar collection discovered under the calendar-home-set. */
export interface CalDavCalendar {
  /** Collection href, exactly as returned (may be a path or absolute URL — the
   *  client resolves it against the request URL). */
  href: string;
  displayName: string | null;
  /** Whether the collection advertises VEVENT support. Defaults to true when the
   *  server omits supported-calendar-component-set (many do). */
  supportsVevent: boolean;
}

/** Build the inner-content matcher for an element by LOCAL name (prefix-agnostic). */
function elementRe(local: string, flags: string): RegExp {
  return new RegExp(
    `<(?:[A-Za-z0-9_.-]+:)?${local}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[A-Za-z0-9_.-]+:)?${local}>`,
    flags
  );
}

/** All inner-content fragments of `<local>…</local>` occurrences (prefix-agnostic). */
export function extractElements(xml: string, local: string): string[] {
  const re = elementRe(local, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1] ?? '');
  return out;
}

/** The first `<local>…</local>` inner content, or null. */
export function extractFirst(xml: string, local: string): string | null {
  return elementRe(local, 'i').exec(xml)?.[1] ?? null;
}

/** Whether an element with this LOCAL name appears (open or self-closing). The
 *  boundary check (whitespace / `/` / `>` after the name) keeps `calendar` from
 *  matching `calendar-data` or `calendar-home-set`. */
export function elementPresent(xml: string, local: string): boolean {
  return new RegExp(`<(?:[A-Za-z0-9_.-]+:)?${local}(?:\\s[^>]*)?/?>`, 'i').test(xml);
}

/** Decode the XML entities CalDAV servers use in text/attr content. */
export function xmlUnescape(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}

/** First `<href>` text inside a fragment, trimmed + unescaped (or null). */
export function extractHref(fragment: string): string | null {
  const raw = extractFirst(fragment, 'href');
  if (raw == null) return null;
  const href = xmlUnescape(raw.trim());
  return href.length > 0 ? href : null;
}

/** The `<current-user-principal>` href from a PROPFIND response. */
export function parsePrincipalHref(xml: string): string | null {
  const el = extractFirst(xml, 'current-user-principal');
  return el ? extractHref(el) : null;
}

/** The `<calendar-home-set>` href from a PROPFIND response. */
export function parseCalendarHomeHref(xml: string): string | null {
  const el = extractFirst(xml, 'calendar-home-set');
  return el ? extractHref(el) : null;
}

/** Calendar collections from a Depth:1 PROPFIND of the calendar-home-set. Only
 *  rows whose resourcetype is a `<calendar>` are returned (the home itself,
 *  inbox/outbox, and address books are skipped). */
export function parseCalendarCollections(xml: string): CalDavCalendar[] {
  const out: CalDavCalendar[] = [];
  for (const block of extractElements(xml, 'response')) {
    const resourceType = extractFirst(block, 'resourcetype') ?? '';
    if (!elementPresent(resourceType, 'calendar')) continue; // not a calendar collection
    const href = extractHref(block);
    if (!href) continue;
    const displayTrimmed = extractFirst(block, 'displayname')?.trim();
    const displayName = displayTrimmed ? xmlUnescape(displayTrimmed) : null;
    const compSet = extractFirst(block, 'supported-calendar-component-set');
    const supportsVevent = compSet == null ? true : /name\s*=\s*"VEVENT"/i.test(compSet);
    out.push({ href, displayName, supportsVevent });
  }
  return out;
}

/** Every `<calendar-data>` ICS blob from a calendar-query REPORT (CDATA-aware,
 *  unescaped), keeping only blobs that actually carry a VEVENT. */
export function parseCalendarData(xml: string): string[] {
  const out: string[] = [];
  for (const raw of extractElements(xml, 'calendar-data')) {
    const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(raw);
    const blob = (cdata ? cdata[1]! : xmlUnescape(raw)).trim();
    if (blob.includes('BEGIN:VEVENT')) out.push(blob);
  }
  return out;
}
