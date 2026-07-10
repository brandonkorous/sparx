// Scheduling bookings — the central record across appointment / class /
// reservation / rental, plus the staff lifecycle actions. The no-overlap
// guarantee is enforced in the engine at the DB tier (a lost race surfaces as
// SLOT_UNAVAILABLE → 409 via the scheduling error mapper).
//
//   GET    /v1/scheduling/bookings                  → list (filters + paging)
//   GET    /v1/scheduling/bookings/calendar         → calendar events in a range
//   POST   /v1/scheduling/bookings                  → create
//   GET    /v1/scheduling/bookings/:id              → get one (with relations)
//   GET    /v1/scheduling/bookings/:id/timeline     → lifecycle history (audit trail)
//   PATCH  /v1/scheduling/bookings/:id              → staff edits (notes/parts/asset)
//   POST   /v1/scheduling/bookings/:id/confirm      → approve a requested booking
//   POST   /v1/scheduling/bookings/:id/cancel       → cancel + release the slot
//   POST   /v1/scheduling/bookings/:id/reschedule   → move in time (re-checks overlap)
//   POST   /v1/scheduling/bookings/:id/check-in     → mark in-progress / check attendee in
//   POST   /v1/scheduling/bookings/:id/complete     → mark completed
//   POST   /v1/scheduling/bookings/:id/no-show      → mark no-show + release the slot
//   GET    /v1/scheduling/customers/:customerId/booking-stats → per-customer reliability

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import {
  CancelBookingInput,
  CheckInInput,
  CreateBookingInput,
  NoShowBookingInput,
  RescheduleBookingInput,
  UpdateBookingInput,
} from '@sparx/scheduling-schemas';
import {
  createBooking,
  updateBooking,
  confirmBooking,
  cancelBooking,
  rescheduleBooking,
  checkInBooking,
  completeBooking,
  noShowBooking,
  getBooking,
  getBookingTimeline,
  getCustomerBookingStats,
  listBookings,
  getCalendar,
  type BookingWithRelations,
} from '@sparx/scheduling';
import { requireSchedulingModule, toSchedulingContext } from '../../../lib/scheduling-context.js';
import { publishBookingEvent } from '../../../lib/scheduling-events.js';
import { settleBookingPayment } from '../../../lib/scheduling-payments.js';

const PathId = z.object({ id: z.string().uuid() });
const ListQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  status: z.string().max(20).optional(),
  bookingType: z.enum(['appointment', 'class', 'reservation', 'rental']).optional(),
  serviceId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  b2bAccountId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
  take: z.coerce.number().int().min(1).max(250).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});
const CalendarQuery = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  resourceId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  includeReleased: z.coerce.boolean().optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; route registration is sync.
const schedulingBookingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/scheduling/bookings', async (request) => {
    await requireSchedulingModule(request);
    const { tenantId } = toSchedulingContext(request);
    const q = ListQuery.parse(request.query);
    const { rows, total } = await listBookings(tenantId, q);
    return paged(rows.map(bookingView), {
      page: Math.floor(q.skip / q.take) + 1,
      per_page: q.take,
      total,
      total_pages: Math.max(1, Math.ceil(total / q.take)),
    });
  });

  app.get('/v1/scheduling/bookings/calendar', async (request) => {
    await requireSchedulingModule(request);
    const { tenantId } = toSchedulingContext(request);
    const q = CalendarQuery.parse(request.query);
    return ok(await getCalendar(tenantId, q));
  });

  // Per-customer reliability ("problematic clients") — completed / no-show /
  // cancelled counts computed on read from this customer's row-owned bookings.
  app.get('/v1/scheduling/customers/:customerId/booking-stats', async (request) => {
    await requireSchedulingModule(request);
    const { tenantId } = toSchedulingContext(request);
    const { customerId } = z.object({ customerId: z.string().uuid() }).parse(request.params);
    return ok(await getCustomerBookingStats(tenantId, customerId));
  });

  app.post('/v1/scheduling/bookings', async (request, reply) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId, userId } = toSchedulingContext(request);
    const input = CreateBookingInput.parse(request.body);
    const created = await createBooking(tenantId, input, userId);
    await publishBookingEvent('booking.created', tenantId, userId, {
      bookingId: created.booking.id,
      serviceId: input.serviceId,
      source: input.source,
    });
    return reply.code(201).send(ok(bookingView(await getBooking(tenantId, created.booking.id))));
  });

  app.get('/v1/scheduling/bookings/:id', async (request) => {
    await requireSchedulingModule(request);
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    return ok(bookingView(await getBooking(tenantId, id)));
  });

  // The booking's lifecycle trail (audit_logs, oldest first) — created, confirmed,
  // rescheduled (with old→new times), cancelled, etc., with actor attribution.
  app.get('/v1/scheduling/bookings/:id/timeline', async (request) => {
    await requireSchedulingModule(request);
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    return ok(await getBookingTimeline(tenantId, id));
  });

  app.patch('/v1/scheduling/bookings/:id', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    const input = UpdateBookingInput.parse({ ...(request.body as object), id });
    await updateBooking(tenantId, input);
    return ok(bookingView(await getBooking(tenantId, id)));
  });

  app.post('/v1/scheduling/bookings/:id/confirm', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId, userId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    await confirmBooking(tenantId, id, userId);
    await publishBookingEvent('booking.confirmed', tenantId, userId, { bookingId: id });
    return ok(bookingView(await getBooking(tenantId, id)));
  });

  app.post('/v1/scheduling/bookings/:id/cancel', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId, userId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    const input = CancelBookingInput.parse({ ...(request.body as object), id });
    await cancelBooking(tenantId, input, userId);
    // Settle the deposit/hold per policy (release, refund, or capture a late fee).
    await settleBookingPayment(request.log, tenantId, id, 'cancel');
    await publishBookingEvent('booking.cancelled', tenantId, userId, {
      bookingId: id,
      reason: input.reason ?? null,
    });
    return ok(bookingView(await getBooking(tenantId, id)));
  });

  app.post('/v1/scheduling/bookings/:id/reschedule', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId, userId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    const input = RescheduleBookingInput.parse({ ...(request.body as object), id });
    await rescheduleBooking(tenantId, input, userId);
    await publishBookingEvent('booking.rescheduled', tenantId, userId, {
      bookingId: id,
      startAt: input.startAt,
    });
    return ok(bookingView(await getBooking(tenantId, id)));
  });

  app.post('/v1/scheduling/bookings/:id/check-in', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId, userId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    const input = CheckInInput.parse({ ...(request.body as object), bookingId: id });
    await checkInBooking(tenantId, input, userId);
    return ok(bookingView(await getBooking(tenantId, id)));
  });

  app.post('/v1/scheduling/bookings/:id/complete', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId, userId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    await completeBooking(tenantId, id, userId);
    // Service happened: release a card hold (the deposit/prepay charge is kept).
    await settleBookingPayment(request.log, tenantId, id, 'complete');
    await publishBookingEvent('booking.completed', tenantId, userId, { bookingId: id });
    return ok(bookingView(await getBooking(tenantId, id)));
  });

  app.post('/v1/scheduling/bookings/:id/no-show', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId, userId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    const input = NoShowBookingInput.parse({ ...(request.body as object), id });
    await noShowBooking(tenantId, input, userId);
    // No-show: capture the policy's no-show fee from the hold (or forfeit a deposit).
    await settleBookingPayment(request.log, tenantId, id, 'no_show');
    await publishBookingEvent('booking.no_show', tenantId, userId, { bookingId: id });
    return ok(bookingView(await getBooking(tenantId, id)));
  });
};

function bookingView(b: BookingWithRelations) {
  return {
    id: b.id,
    serviceId: b.serviceId,
    bookingType: b.bookingType,
    seriesId: b.seriesId,
    locationId: b.locationId,
    status: b.status,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    timezone: b.timezone,
    capacity: b.capacity,
    partySize: b.partySize,
    customerId: b.customerId,
    b2bAccountId: b.b2bAccountId,
    assetRef: b.assetRef,
    partsLinked: b.partsLinked,
    workOrderId: b.workOrderId,
    source: b.source,
    policyId: b.policyId,
    depositStatus: b.depositStatus,
    paymentIntentId: b.paymentIntentId,
    intakeSubmissionId: b.intakeSubmissionId,
    notes: b.notes,
    staffNotes: b.staffNotes,
    confirmedAt: b.confirmedAt?.toISOString() ?? null,
    checkedInAt: b.checkedInAt?.toISOString() ?? null,
    completedAt: b.completedAt?.toISOString() ?? null,
    cancelledAt: b.cancelledAt?.toISOString() ?? null,
    cancellationReason: b.cancellationReason,
    noShowAt: b.noShowAt?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    service: b.service,
    resources: b.resources.map((r) => ({
      id: r.id,
      role: r.role,
      status: r.status,
      startAt: r.startAt.toISOString(),
      endAt: r.endAt.toISOString(),
      resource: r.resource,
    })),
    attendees: b.attendees,
  };
}

export default schedulingBookingRoutes;
