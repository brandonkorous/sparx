// SSRF guard for tenant-supplied calendar endpoints (docs/79 §8.2/§8.3) — shared
// by the inbound iCal feed sync and the CalDAV client. A tenant can point us at any
// URL (iCal feed, CalDAV server), so before we fetch we must prove it resolves to a
// PUBLIC https host: no localhost, no private/loopback/link-local ranges, no
// cloud-metadata (169.254.169.254), and the DNS name's resolved addresses are all
// public (defeats DNS-rebinding). Redirects are re-validated per hop by the callers.

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/** A user-facing feed/connection error — the message lands in `last_error` + the
 *  dashboard, so keep it human-readable. */
export class CalendarFeedError extends Error {}

export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === undefined || b === undefined) return true;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local incl. cloud metadata 169.254.169.254
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA fc00::/7
  if (lower.startsWith('fe80')) return true; // link-local
  if (lower.startsWith('::ffff:')) return isPrivateAddress(lower.slice('::ffff:'.length));
  return false;
}

/** Validate a URL is a public HTTPS endpoint (defeats SSRF: localhost, private
 *  ranges, cloud-metadata, DNS-rebinding). `webcal://` is normalized to https. */
export async function assertPublicHttpsUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new CalendarFeedError('That does not look like a valid calendar URL.');
  }
  if (url.protocol === 'webcal:') url.protocol = 'https:';
  if (url.protocol !== 'https:') throw new CalendarFeedError('Calendar URLs must use https.');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new CalendarFeedError('That calendar URL is not allowed.');
  }
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (addresses.length === 0) throw new CalendarFeedError('That calendar host could not be found.');
  for (const addr of addresses) {
    if (isPrivateAddress(addr)) throw new CalendarFeedError('That calendar URL is not allowed.');
  }
  return url;
}
