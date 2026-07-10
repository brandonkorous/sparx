// Recurring booking series (docs/79 §7.6) — create a series (materializes child
// bookings now + rolls a horizon forward via the api-rest tick), inspect it, and
// cancel it. Each materialized occurrence is a normal booking, so it shows up in
// the bookings list / calendar and flows through the usual lifecycle.
//
//   GET    /v1/scheduling/series          → list (with occurrence counts)
//   POST   /v1/scheduling/series          → create + materialize
//   GET    /v1/scheduling/series/:id       → get one (with its bookings)
//   POST   /v1/scheduling/series/:id/cancel → cancel future (or all) occurrences

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Booking, BookingSeries } from '@sparx/db';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { CancelBookingSeriesInput, CreateBookingSeriesInput } from '@sparx/scheduling-schemas';
import {
  cancelBookingSeries,
  createBookingSeries,
  getBookingSeries,
  listBookingSeries,
  type BookingSeriesDetail,
  type BookingSeriesSummary,
} from '@sparx/scheduling';

import { requireSchedulingModule, toSchedulingContext } from '../../../lib/scheduling-context.js';
import { publishBookingEvent } from '../../../lib/scheduling-events.js';

const PathId = z.object({ id: z.string().uuid() });
const ListQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  status: z.string().max(20).optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

function seriesView(s: BookingSeries) {
  return {
    id: s.id,
    serviceId: s.serviceId,
    rrule: s.rrule,
    status: s.status,
    customerId: s.customerId,
    resourceIds: s.resourceIds,
    materializedThrough: s.materializedThrough?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

function summaryView(s: BookingSeriesSummary) {
  return {
    ...seriesView(s.series),
    serviceName: s.serviceName,
    totalBookings: s.totalBookings,
    upcomingBookings: s.upcomingBookings,
  };
}

/** Compact occurrence row (the detail view lists many; no relations needed). */
function occurrenceView(b: Booking) {
  return {
    id: b.id,
    status: b.status,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
  };
}

function detailView(d: BookingSeriesDetail) {
  return { ...summaryView(d), bookings: d.bookings.map(occurrenceView) };
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; route registration is sync.
const schedulingSeriesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/scheduling/series', async (request) => {
    await requireSchedulingModule(request);
    const { tenantId } = toSchedulingContext(request);
    const query = ListQuery.parse(request.query);
    const { items, total } = await listBookingSeries(tenantId, query);
    return paged(items.map(summaryView), { total, per_page: query.take ?? 50 });
  });

  app.post('/v1/scheduling/series', async (request, reply) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId, userId } = toSchedulingContext(request);
    const input = CreateBookingSeriesInput.parse(request.body);
    const result = await createBookingSeries(tenantId, input, userId);
    // Publish a created event per occurrence so downstream consumers (calendar
    // push, analytics) treat them like any other booking.
    for (const booking of result.created) {
      await publishBookingEvent('booking.created', tenantId, userId, {
        bookingId: booking.id,
        serviceId: input.serviceId,
        source: 'dashboard',
        seriesId: result.series.id,
      });
    }
    return reply.code(201).send(
      ok({
        series: seriesView(result.series),
        created: result.created.map(occurrenceView),
        skipped: result.skipped,
      })
    );
  });

  app.get('/v1/scheduling/series/:id', async (request) => {
    await requireSchedulingModule(request);
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    return ok(detailView(await getBookingSeries(tenantId, id)));
  });

  app.post('/v1/scheduling/series/:id/cancel', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    const input = CancelBookingSeriesInput.parse({ ...(request.body as object), id });
    const result = await cancelBookingSeries(tenantId, input);
    return ok(result);
  });
};

export default schedulingSeriesRoutes;
