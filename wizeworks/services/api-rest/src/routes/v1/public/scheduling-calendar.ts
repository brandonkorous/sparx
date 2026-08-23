// Public outbound-iCal endpoints for calendar sync (docs/79 §8.1). The signed
// token IS the auth, so these live under /v1/public/ (the auth plugin treats the
// prefix as unauthenticated) — same as the one-click unsubscribe link.
//
//   GET /v1/public/scheduling/calendar/booking.ics?t=…  → one booking, as a
//        downloadable `.ics` (Add to Apple/Outlook-desktop/any client).
//   GET /v1/public/scheduling/calendar/feed.ics?t=…     → a resource's bookings as
//        a subscribe-to feed (the staff member adds the URL to their calendar once).
//
// Both verify the HMAC token (→ tenantId + id), confirm the `scheduling` module is
// enabled for that tenant, then serve `text/calendar`. Any tamper / wrong scope /
// missing record → 404 with no body (never leak which ids exist).

import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import { isModuleEnabled } from '@wizeworks/auth';

import { loadBookingIcs, loadResourceFeed } from '../../../lib/scheduling-ical.js';
import { readSchedulingToken } from '../../../lib/scheduling-token.js';

const Query = z.object({ t: z.string().min(1).max(2048) });

function notFound(reply: FastifyReply): FastifyReply {
  return reply.code(404).type('text/plain').send('Not found');
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; route registration is sync.
const schedulingCalendarRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/public/scheduling/calendar/booking.ics', async (request, reply) => {
    const { t } = Query.parse(request.query);
    const decoded = readSchedulingToken(t, 'b');
    if (!decoded) return notFound(reply);
    if (!(await isModuleEnabled(decoded.tenantId, 'scheduling'))) return notFound(reply);

    const ics = await loadBookingIcs(decoded.tenantId, decoded.id);
    if (!ics) return notFound(reply);
    return reply
      .type('text/calendar; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${ics.filename}"`)
      .header('Cache-Control', 'private, no-store')
      .send(ics.body);
  });

  app.get('/v1/public/scheduling/calendar/feed.ics', async (request, reply) => {
    const { t } = Query.parse(request.query);
    const decoded = readSchedulingToken(t, 'f');
    if (!decoded) return notFound(reply);
    if (!(await isModuleEnabled(decoded.tenantId, 'scheduling'))) return notFound(reply);

    const feed = await loadResourceFeed(decoded.tenantId, decoded.id, Date.now());
    if (!feed) return notFound(reply);
    // Subscribers poll this; a short cache eases load without hiding fresh bookings
    // longer than the provider's own (12–24h) cache already does.
    return reply
      .type('text/calendar; charset=utf-8')
      .header('Content-Disposition', `inline; filename="${feed.filename}"`)
      .header('Cache-Control', 'private, max-age=300')
      .send(feed.body);
  });
};

export default schedulingCalendarRoutes;
