// The customer-facing half of e-sign and meeting links (docs/144 §12).
//
//   GET  /v1/public/documents/sign/:token   ?tenant=<slug>  → what am I signing
//   POST /v1/public/documents/sign          ?tenant=<slug>  → sign it
//   POST /v1/public/documents/decline       ?tenant=<slug>  → say no, with a reason
//   GET  /v1/public/meet/:slug              ?tenant=<slug>  → a rep's booking link
//   POST /v1/public/meet/:slug/booked       ?tenant=<slug>  → attach a booking to it
//
// UNAUTHENTICATED, and deliberately in its own file. Mixing these with the staff
// routes is how an auth check gets forgotten on exactly the endpoints that most
// need one — so the file that has no `requireRole` in it says so at the top.
//
// The tenant comes from the SITE, resolved by slug the same way every other
// public route resolves it. The token then only has to identify one row inside
// that tenant, which means a token from one business is not even a candidate key
// in another's, and RLS stays the boundary rather than being stepped around.

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { meetingLinkService, signatureService } from '@sparx/crm';
import { ok } from '@sparx/api-core/envelope';
import { badRequest, notFound } from '@sparx/api-core/errors';
import { prisma, withTenant } from '@sparx/db';

import { resolvePublicPropertyId } from '../../../lib/property.js';

const TenantQuery = z.object({ tenant: z.string().min(1).max(120) });
const TokenPath = z.object({ token: z.string().min(20).max(200) });
const SlugPath = z.object({ slug: z.string().min(1).max(63) });

/** The optional `?site=` a multi-site tenant's storefront sends, so a booking
 *  link resolves against the business the visitor is actually on. */
function siteSlug(request: FastifyRequest): string | null {
  const site = (request.query as { site?: string } | undefined)?.site;
  return typeof site === 'string' && site.length > 0 ? site : null;
}

/** Slug → tenant id. Tenants are the one non-RLS table, so this lookup is safe
 *  without a context — the same resolution the storefront's other public reads
 *  use, and the only thing that establishes WHOSE data the token addresses. */
async function tenantFromSlug(request: FastifyRequest): Promise<string> {
  const { tenant: slug } = TenantQuery.parse(request.query);
  const row = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!row) throw notFound('Site', slug);
  return row.id;
}

/** The caller's address, for the signature record. Behind Caddy the socket is
 *  the ingress, so the forwarded header is the real one — first hop only, since
 *  everything after it is client-supplied and worth nothing. */
function callerIp(request: FastifyRequest): string | undefined {
  const forwarded = request.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  // `??` would be wrong: a header present but blank must fall through to the
  // socket address, and nullish-coalescing would keep the empty string.
  const hop = first?.split(',')[0]?.trim();
  return hop !== undefined && hop !== '' ? hop : request.ip;
}

const publicDocumentRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/public/documents/sign/:token', async (request) => {
    const tenantId = await tenantFromSlug(request);
    const { token } = TokenPath.parse(request.params);
    // Every non-signable state — expired, revoked, already signed, declined —
    // comes back as a 200 with a status rather than an error, because the page
    // has something worth saying for each of them and an error code renders as
    // "something went wrong".
    return ok(await signatureService.viewByToken({ tenantId }, token));
  });

  app.post('/v1/public/documents/sign', async (request) => {
    const tenantId = await tenantFromSlug(request);
    const result = await signatureService.signByToken({ tenantId }, request.body, {
      ip: callerIp(request),
      userAgent: request.headers['user-agent'],
    });
    return ok(result);
  });

  app.post('/v1/public/documents/decline', async (request) => {
    const tenantId = await tenantFromSlug(request);
    return ok(await signatureService.declineByToken({ tenantId }, request.body));
  });

  app.get('/v1/public/meet/:slug', async (request) => {
    const tenantId = await tenantFromSlug(request);
    const { slug } = SlugPath.parse(request.params);
    const propertyId = await resolvePublicPropertyId(tenantId, siteSlug(request));
    const link = await meetingLinkService.bySlug({ tenantId }, slug, propertyId);
    if (!link) throw notFound('MeetingLink', slug);
    // An inactive link still returns 200 with `active: false`. A 404 tells the
    // person clicking a link from an old email nothing they can act on; "this
    // booking link is no longer in use" tells them to reply to the email.
    return ok(link);
  });

  // Called by the booking widget AFTER scheduling has taken the booking. It does
  // not create anything — it says "that booking came through this link", which
  // is what puts the meeting on the contact's timeline instead of only in a
  // calendar.
  app.post('/v1/public/meet/:slug/booked', async (request) => {
    const tenantId = await tenantFromSlug(request);
    const { slug } = SlugPath.parse(request.params);
    const body = z.object({ bookingId: z.string().uuid() }).parse(request.body);

    const propertyId = await resolvePublicPropertyId(tenantId, siteSlug(request));
    const link = await meetingLinkService.bySlug({ tenantId }, slug, propertyId);
    if (!link?.active) throw notFound('MeetingLink', slug);

    // Tenant-scoped, not the bare client: bookings are FORCE-RLS, so a read
    // without a tenant context returns nothing at all and this route would 404
    // every real booking.
    const booking = await withTenant({ tenantId }, (tx) =>
      tx.booking.findUnique({
        where: { id: body.bookingId },
        select: { id: true, customerId: true, startAt: true, serviceId: true, meetingLinkId: true },
      })
    );
    if (!booking) throw notFound('Booking', body.bookingId);
    // The booking has to be for the SERVICE this link offers. Without that check
    // any booking id could be attributed to any link, which would make the
    // meeting counter and the contact timeline say things that never happened.
    if (booking.serviceId !== link.serviceId) {
      throw badRequest('That booking is not for this meeting link.');
    }
    // Idempotent: a widget that retries must not double-count or write the
    // activity twice.
    if (booking.meetingLinkId === link.id) return ok({ linked: true });

    await meetingLinkService.recordBooking(
      { tenantId },
      {
        linkId: link.id,
        bookingId: booking.id,
        customerId: booking.customerId,
        startAt: booking.startAt,
      }
    );
    return ok({ linked: true });
  });

  return Promise.resolve();
};

export default publicDocumentRoutes;
