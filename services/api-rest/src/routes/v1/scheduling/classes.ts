// Class sessions + roster (docs/79 §7.2) — the staff surface. A class is one
// session booking with many attendee seats; capacity is enforced in the engine
// (overflow → waitlisted, auto-promoted when a seat frees). Each booked seat gets
// its own confirmation (sent directly — the ledger is per-booking).
//
//   GET   /v1/scheduling/sessions                     → class sessions in a range
//   GET   /v1/scheduling/sessions/:id/attendees        → the roster
//   POST  /v1/scheduling/sessions/:id/attendees        → add a seat
//   PATCH /v1/scheduling/attendees/:id                 → check in / cancel / resize

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { queryBool } from '@sparx/api-core/query';
import type { BookingAttendee } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { JoinSessionInput, UpdateAttendeeInput } from '@sparx/scheduling-schemas';
import {
  bookClassSeat,
  listClassSessions,
  listSessionAttendees,
  updateAttendee,
  type ClassSessionSummary,
} from '@sparx/scheduling';

import { requireSchedulingModule, toSchedulingContext } from '../../../lib/scheduling-context.js';
import { notifyPromotedAttendees, sendSeatConfirmation } from '../../../lib/scheduling-classes.js';

const PathId = z.object({ id: z.string().uuid() });
const SessionsQuery = z.object({
  serviceId: z.string().uuid().optional(),
  from: z.string().datetime(),
  to: z.string().datetime(),
  openOnly: queryBool.optional(),
});

function sessionView(s: ClassSessionSummary) {
  return {
    bookingId: s.bookingId,
    serviceId: s.serviceId,
    serviceName: s.serviceName,
    startAt: s.startAt.toISOString(),
    endAt: s.endAt.toISOString(),
    capacity: s.capacity,
    booked: s.booked,
    remaining: s.remaining,
    waitlisted: s.waitlisted,
    status: s.status,
  };
}

function attendeeView(a: BookingAttendee) {
  return {
    id: a.id,
    bookingId: a.bookingId,
    customerId: a.customerId,
    guestName: a.guestName,
    partySize: a.partySize,
    status: a.status,
    waitlistPosition: a.waitlistPosition,
  };
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; route registration is sync.
const schedulingClassRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/scheduling/sessions', async (request) => {
    await requireSchedulingModule(request);
    const { tenantId } = toSchedulingContext(request);
    const q = SessionsQuery.parse(request.query);
    const sessions = await listClassSessions(tenantId, q);
    return ok(sessions.map(sessionView));
  });

  app.get('/v1/scheduling/sessions/:id/attendees', async (request) => {
    await requireSchedulingModule(request);
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    const roster = await listSessionAttendees(tenantId, id);
    return ok(roster.map(attendeeView));
  });

  app.post('/v1/scheduling/sessions/:id/attendees', async (request, reply) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    const input = JoinSessionInput.parse({ ...(request.body as object), bookingId: id });
    const seat = await bookClassSeat(tenantId, input);
    if (!seat.waitlisted) {
      await sendSeatConfirmation(request.log, tenantId, id, seat.attendee);
    }
    return reply
      .code(201)
      .send(ok({ ...attendeeView(seat.attendee), waitlisted: seat.waitlisted }));
  });

  app.patch('/v1/scheduling/attendees/:id', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    const input = UpdateAttendeeInput.parse({ ...(request.body as object), id });
    const result = await updateAttendee(tenantId, input);
    // Anyone promoted off the waitlist into a freed seat gets a confirmation.
    if (result.promoted.length > 0) {
      await notifyPromotedAttendees(
        request.log,
        tenantId,
        result.attendee.bookingId,
        result.promoted
      );
    }
    return ok({
      attendee: attendeeView(result.attendee),
      promoted: result.promoted.map(attendeeView),
    });
  });
};

export default schedulingClassRoutes;
