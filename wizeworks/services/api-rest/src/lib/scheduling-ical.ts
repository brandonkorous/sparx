// Outbound iCal for calendar sync (docs/79 §8.1) — token signing, data loading,
// and URL builders behind the two public `.ics` endpoints:
//   · per-booking download  — the customer's own event (attached to / linked from a
//     confirmation), an "Add to Apple/Outlook-desktop" file.
//   · per-resource feed     — the staff member subscribes once to a signed URL and
//     their sparx bookings appear in Google/Outlook/Apple automatically.
//
// The signed token IS the auth (no session), so the routes live under /v1/public/
// exactly like the one-click unsubscribe link (lib/email-unsubscribe.ts), whose
// HMAC scheme this mirrors. Subscribed-feed staleness (provider cache ~12–24h,
// docs/79 §8.1) is a feed limitation surfaced in the UI copy — the DB-level
// no-overlap constraint (§7.4) remains the authoritative double-booking guard.

import crypto from 'node:crypto';

import { withTenant } from '@wizeworks/db';
import {
  buildIcsEvent,
  buildIcsFeed,
  findBookingPlace,
  googleCalendarUrl,
  joinNames,
  outlookCalendarUrl,
  listBookings,
  type IcsEvent,
  type IcsStatus,
} from '@wizeworks/scheduling';

import { resolveActivePropertyName } from './property.js';

// A dedicated secret; falls back to the shared internal secret, then a dev default
// (a rotated secret simply invalidates outstanding feed URLs — the staff member
// re-copies the link; acceptable for a read-only calendar feed).
const SECRET =
  process.env.SPARX_CALENDAR_FEED_SECRET ??
  process.env.SPARX_INTERNAL_SHARED_SECRET ??
  'dev-calendar-feed-secret';

// Public api-rest origin — the feed URL must be reachable by external calendar apps
// (Google/Outlook poll it), so this is the same public base the email links use.
const API_BASE =
  process.env.SPARX_PUBLIC_API_REST_URL ??
  process.env.SPARX_API_REST_URL ??
  'http://localhost:3100';

// Storefront base for the event's manage link (best-effort; omitted when unset).
const SITE_BASE = process.env.SPARX_SITE_BASE ?? '';

const FEED_PAST_MS = 31 * 24 * 60 * 60 * 1000; // show ~1 month of recent history
const FEED_FUTURE_MS = 180 * 24 * 60 * 60 * 1000; // and ~6 months ahead

/** `b` = a single booking download, `f` = a resource subscription feed. */
export type CalendarTokenScope = 'b' | 'f';

function hmac(data: string): string {
  return crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
}

/** `base64url(scope:tenantId:id).hmac` — opaque, tamper-evident, self-describing
 *  (the endpoint needs no `?tenant=`; the token carries the tenant). */
export function signCalendarToken(scope: CalendarTokenScope, tenantId: string, id: string): string {
  const data = Buffer.from(`${scope}:${tenantId}:${id}`).toString('base64url');
  return `${data}.${hmac(data)}`;
}

export function verifyCalendarToken(
  token: string
): { scope: CalendarTokenScope; tenantId: string; id: string } | null {
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmac(data);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  const payload = Buffer.from(data, 'base64url').toString('utf8');
  const parts = payload.split(':');
  if (parts.length !== 3) return null;
  const [scope, tenantId, id] = parts;
  if ((scope !== 'b' && scope !== 'f') || !tenantId || !id) return null;
  return { scope, tenantId, id };
}

export function bookingIcsUrl(tenantId: string, bookingId: string): string {
  return `${API_BASE}/v1/public/scheduling/calendar/booking.ics?t=${signCalendarToken('b', tenantId, bookingId)}`;
}

export function resourceFeedUrl(tenantId: string, resourceId: string): string {
  return `${API_BASE}/v1/public/scheduling/calendar/feed.ics?t=${signCalendarToken('f', tenantId, resourceId)}`;
}

function siteLink(slug: string, path: string): string {
  if (!SITE_BASE) return '';
  return `${SITE_BASE.replace('{slug}', slug)}${path}`;
}

/** Map a booking status to the iCal STATUS keyword: a pending/waitlisted booking is
 *  TENTATIVE, a cancelled/no-show booking is CANCELLED, everything live is CONFIRMED. */
function toIcsStatus(status: string): IcsStatus {
  if (status === 'cancelled' || status === 'no_show') return 'cancelled';
  if (status === 'requested' || status === 'waitlisted') return 'tentative';
  return 'confirmed';
}

/** SEQUENCE must increase on every change to a UID so clients refresh; seconds
 *  since the booking was created is a deterministic, monotonic stand-in. */
function sequenceOf(createdAt: Date, updatedAt: Date): number {
  return Math.max(0, Math.floor((updatedAt.getTime() - createdAt.getTime()) / 1000));
}

function uidFor(bookingId: string): string {
  return `${bookingId}@sparx.works`;
}

/** The Google/Outlook "Add to calendar" deep links + the per-booking `.ics` URL —
 *  what a confirmation page / portal row / email offers for one booking. */
export function bookingCalendarLinks(
  tenantId: string,
  bookingId: string,
  event: { summary: string; start: Date; end: Date; description?: string; location?: string }
): { ics: string; google: string; outlook: string } {
  return {
    ics: bookingIcsUrl(tenantId, bookingId),
    google: googleCalendarUrl(event),
    outlook: outlookCalendarUrl(event),
  };
}

/** Load a booking and render its single-event `.ics`. Null when the booking is
 *  missing (deleted / wrong tenant) so the route can 404 without leaking. */
export async function loadBookingIcs(
  tenantId: string,
  bookingId: string
): Promise<{ filename: string; body: string } | null> {
  const b = await withTenant({ tenantId }, (tx) =>
    tx.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      select: {
        startAt: true,
        endAt: true,
        status: true,
        partySize: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        locationId: true,
        serviceId: true,
        service: { select: { name: true } },
        resources: { select: { resource: { select: { name: true, kind: true } } } },
      },
    })
  );
  if (!b) return null;

  const [siteName, tenant, place] = await Promise.all([
    resolveActivePropertyName(tenantId, null),
    withTenant({ tenantId }, (tx) =>
      tx.tenant.findUnique({ where: { id: tenantId }, select: { slug: true, email: true } })
    ),
    // The NAME of a place is not a place. LOCATION is the field a phone shows on
    // the day and the field a maps app routes on, so it carries the address
    // (issue 107) — and it resolves through the service and the business's only
    // premises, because a one-chair business never sets a location on anything.
    findBookingPlace(tenantId, { locationId: b.locationId, serviceId: b.serviceId }),
  ]);

  const staff = b.resources
    .map((r) => r.resource)
    .filter((r) => r.kind === 'staff')
    .map((r) => r.name);
  const descriptionLines = [
    staff.length ? `With ${joinNames(staff)}` : '',
    b.partySize ? `Party of ${b.partySize}` : '',
    b.notes ?? '',
  ].filter(Boolean);

  const event: IcsEvent = {
    uid: uidFor(bookingId),
    start: b.startAt,
    end: b.endAt,
    summary: b.service?.name ?? 'Booking',
    description: descriptionLines.join('\n') || undefined,
    location: place?.line ?? undefined,
    url: siteLink(tenant?.slug ?? '', '/account/bookings') || undefined,
    status: toIcsStatus(b.status),
    organizerName: siteName || undefined,
    organizerEmail: tenant?.email ?? undefined,
    sequence: sequenceOf(b.createdAt, b.updatedAt),
    stamp: b.updatedAt,
  };
  return { filename: 'booking.ics', body: buildIcsEvent(event, { method: 'PUBLISH' }) };
}

/** Load a resource's bookings over the feed window and render the subscribe-to
 *  `.ics` feed. Null when the resource is missing. */
export async function loadResourceFeed(
  tenantId: string,
  resourceId: string,
  nowMs: number
): Promise<{ filename: string; calName: string; body: string } | null> {
  const [resource, siteName, tenant] = await Promise.all([
    withTenant({ tenantId }, (tx) =>
      tx.schedulingResource.findFirst({
        where: { id: resourceId, deletedAt: null },
        select: { name: true },
      })
    ),
    resolveActivePropertyName(tenantId, null),
    withTenant({ tenantId }, (tx) =>
      tx.tenant.findUnique({ where: { id: tenantId }, select: { email: true } })
    ),
  ]);
  if (!resource) return null;

  const { rows } = await listBookings(tenantId, {
    resourceId,
    statusIn: ['requested', 'confirmed', 'in_progress', 'completed'],
    from: new Date(nowMs - FEED_PAST_MS).toISOString(),
    to: new Date(nowMs + FEED_FUTURE_MS).toISOString(),
    order: 'asc',
    take: 250,
  });

  const events: IcsEvent[] = rows.map((b) => {
    // Staff feed: the customer's name helps the staff member read their day.
    const guest = b.attendees.find((a) => a.guestName)?.guestName ?? '';
    return {
      uid: uidFor(b.id),
      start: b.startAt,
      end: b.endAt,
      summary: guest ? `${b.service.name} — ${guest}` : b.service.name,
      location: undefined,
      status: toIcsStatus(b.status),
      organizerName: siteName || undefined,
      organizerEmail: tenant?.email ?? undefined,
      sequence: sequenceOf(b.createdAt, b.updatedAt),
      stamp: b.updatedAt,
    };
  });

  const calName = siteName ? `${resource.name} — ${siteName}` : `${resource.name} — Bookings`;
  return {
    filename: `${resourceId}.ics`,
    calName,
    body: buildIcsFeed(events, { calName, ttl: 'PT12H' }),
  };
}
