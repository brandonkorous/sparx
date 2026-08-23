// Signed, session-less links to one booking (docs/79 §8.1, §15) — the HMAC
// scheme behind the per-booking `.ics` download, the staff calendar feed, and
// the customer's "change or cancel" page.
//
// THE TOKEN IS THE AUTH. It is sent to the address the customer typed into the
// booking form and nowhere else, which is the same trust model as the one-click
// unsubscribe link (lib/email-unsubscribe.ts) and as every "manage your booking"
// link in the trade. A guest who booked a haircut has no account and should not
// need one to move it (issue 153).
//
// SCOPE IS PART OF THE SIGNATURE, so the three links are not interchangeable: a
// calendar file that leaked into a shared family calendar can be read, and can
// never cancel anything. Widening a link's powers means minting a new scope, not
// reusing an old token.

import crypto from 'node:crypto';

// A dedicated secret; falls back to the shared internal secret, then a dev
// default. Rotating it invalidates outstanding links — a staff member re-copies
// their feed URL, and a customer uses the link in her most recent email.
const SECRET =
  process.env.SPARX_CALENDAR_FEED_SECRET ??
  process.env.SPARX_INTERNAL_SHARED_SECRET ??
  'dev-calendar-feed-secret';

/** `b` = one booking's `.ics`, `f` = a resource's subscription feed,
 *  `m` = a customer managing one booking (read + reschedule + cancel). */
export type SchedulingTokenScope = 'b' | 'f' | 'm';

const SCOPES = new Set<string>(['b', 'f', 'm']);

function hmac(data: string): string {
  return crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
}

/** `base64url(scope:tenantId:id).hmac` — opaque, tamper-evident, self-describing
 *  (the endpoint needs no `?tenant=`; the token carries the tenant). */
export function signSchedulingToken(
  scope: SchedulingTokenScope,
  tenantId: string,
  id: string
): string {
  const data = Buffer.from(`${scope}:${tenantId}:${id}`).toString('base64url');
  return `${data}.${hmac(data)}`;
}

export function verifySchedulingToken(
  token: string
): { scope: SchedulingTokenScope; tenantId: string; id: string } | null {
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(hmac(data));
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  const parts = Buffer.from(data, 'base64url').toString('utf8').split(':');
  if (parts.length !== 3) return null;
  const [scope, tenantId, id] = parts;
  if (!scope || !SCOPES.has(scope) || !tenantId || !id) return null;
  return { scope: scope as SchedulingTokenScope, tenantId, id };
}

/** Verify a token AND require a particular scope — the shape every route wants,
 *  so no caller can forget the second half of the check. */
export function readSchedulingToken(
  token: string,
  scope: SchedulingTokenScope
): { tenantId: string; id: string } | null {
  const decoded = verifySchedulingToken(token);
  if (!decoded || decoded.scope !== scope) return null;
  return { tenantId: decoded.tenantId, id: decoded.id };
}

/** Where a customer manages one booking, as a SITE-relative path. Callers that
 *  need an absolute URL (an email) prefix their own site base; the booking
 *  confirmation is already on the site, so it uses this as-is. */
export function bookingManagePath(tenantId: string, bookingId: string): string {
  return `/booking/${signSchedulingToken('m', tenantId, bookingId)}`;
}
