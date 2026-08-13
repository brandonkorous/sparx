// The rota and the leave queue (docs/149 §5 — Schedule, Time off).
//
//   GET    /v1/staff/shifts
//   POST   /v1/staff/shifts
//   PATCH  /v1/staff/shifts/:id
//   DELETE /v1/staff/shifts/:id
//   POST   /v1/staff/shifts/publish       → draft rota → the team can see it
//   GET    /v1/staff/time-off
//   POST   /v1/staff/time-off
//   POST   /v1/staff/time-off/:id/decision
//   POST   /v1/staff/time-off/:id/cancel
//
// Nothing here reaches the ledger. Nobody is paid for a shift — they are paid for
// the time entry that happened during it — so this file is the only part of the
// module with no money in it, and it is `editor` throughout.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@sparx/api-core/envelope';
import { badRequest } from '@sparx/api-core/errors';
import { requireRole } from '@sparx/api-core/auth';
import {
  cancelTimeOff,
  createShift,
  decideTimeOff,
  deleteShift,
  listShifts,
  listTimeOff,
  publishShifts,
  requestTimeOff,
  updateShift,
} from '@sparx/staff';
import {
  shiftSchema,
  shiftStatusSchema,
  timeOffDecisionSchema,
  timeOffSchema,
  timeOffStatusSchema,
} from '@sparx/staff/schemas';
import { requireStaffModule } from '../../../lib/staff-context.js';
import { publishStaffEvent } from '../../../lib/staff-events.js';
import { displayName } from './views.js';

const PathId = z.object({ id: z.string().uuid() });

const ShiftQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  staffMemberId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
});

const TimeOffQuery = z.object({
  status: timeOffStatusSchema.optional(),
  staffMemberId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const IdsBody = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });

// Spelled out rather than `shiftSchema.partial()`: the create schema's
// ends-after-starts refinement cannot fire on a patch that moves only one of the
// two, so `updateShift` re-reads the row and validates the PAIR — raising
// STAFF_SHIFT_WINDOW_INVALID (422) instead of letting the table's CHECK answer.
const ShiftUpdate = z.object({
  staffMemberId: z.string().uuid().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  propertyId: z.string().uuid().nullish(),
  label: z.string().trim().max(120).nullish(),
  status: shiftStatusSchema.optional(),
  notes: z.string().max(2000).nullish(),
});

function shiftView(row: {
  id: string;
  staffMemberId: string;
  propertyId: string | null;
  startsAt: Date;
  endsAt: Date;
  label: string | null;
  status: string;
  notes: string | null;
  staffMember?: { firstName: string; lastName: string | null; color: string | null };
}) {
  return {
    id: row.id,
    staffMemberId: row.staffMemberId,
    staffMemberName: row.staffMember ? displayName(row.staffMember) : null,
    // Null means nobody has picked one — the schedule assigns from the palette on
    // first render, which is why this is not defaulted to a colour here.
    color: row.staffMember?.color ?? null,
    propertyId: row.propertyId,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    label: row.label,
    status: row.status,
    notes: row.notes,
  };
}

function timeOffView(row: {
  id: string;
  staffMemberId: string;
  kind: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  reason: string | null;
  status: string;
  decidedAt: Date | null;
  decidedBy: string | null;
  decisionNote: string | null;
  availabilityExceptionId: string | null;
  staffMember?: { firstName: string; lastName: string | null };
}) {
  return {
    id: row.id,
    staffMemberId: row.staffMemberId,
    staffMemberName: row.staffMember ? displayName(row.staffMember) : null,
    kind: row.kind,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    allDay: row.allDay,
    reason: row.reason,
    status: row.status,
    decidedAt: row.decidedAt,
    decidedBy: row.decidedBy,
    decisionNote: row.decisionNote,
    // Non-null means approval actually blocked them in the booking engine. The
    // surface uses it to distinguish "approved and they are unbookable" from
    // "approved, but they were never bookable in the first place" — which is the
    // ordinary case for anyone without a scheduling resource.
    blocksBookings: row.availabilityExceptionId !== null,
  };
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; route registration is sync.
const staffScheduleRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/staff/shifts', async (request) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'viewer');
    const query = ShiftQuery.parse(request.query);
    const rows = await listShifts(auth.tenantId, query);
    return ok({ items: rows.map(shiftView) });
  });

  app.post('/v1/staff/shifts', async (request, reply) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'editor');
    const input = shiftSchema.parse(request.body);
    return reply.code(201).send(ok(shiftView(await createShift(auth.tenantId, input))));
  });

  // Static before parametric — `/shifts/publish` must not be read as a shift id.
  app.post('/v1/staff/shifts/publish', async (request) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'editor');
    const { ids } = IdsBody.parse(request.body);
    const published = await publishShifts(auth.tenantId, ids);
    return ok({ published });
  });

  app.patch('/v1/staff/shifts/:id', async (request) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const input = ShiftUpdate.parse(request.body);
    return ok(shiftView(await updateShift(auth.tenantId, id, input)));
  });

  app.delete('/v1/staff/shifts/:id', async (request, reply) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    await deleteShift(auth.tenantId, id);
    return reply.code(204).send();
  });

  app.get('/v1/staff/time-off', async (request) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'viewer');
    const query = TimeOffQuery.parse(request.query);
    const rows = await listTimeOff(auth.tenantId, query);
    return ok({
      items: rows.map(timeOffView),
      // The queue's badge count. Sent rather than counted client-side because a
      // filtered list would otherwise report "0 waiting" whenever someone had
      // narrowed it to approved requests.
      requestedCount: rows.filter((row) => row.status === 'requested').length,
    });
  });

  app.post('/v1/staff/time-off', async (request, reply) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'editor');
    const input = timeOffSchema.parse(request.body);
    const row = await requestTimeOff(auth.tenantId, input);
    await publishStaffEvent('staff.timeoff.requested', auth.tenantId, auth.actorId, {
      timeOffRequestId: row.id,
      staffMemberId: row.staffMemberId,
      kind: row.kind,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
    });
    return reply.code(201).send(ok(timeOffView(row)));
  });

  // Approving writes an availability blackout against the person's scheduling
  // resource, when they have one — so this is a decision that reaches another
  // module, and it is `admin` rather than `editor`.
  app.post('/v1/staff/time-off/:id/decision', async (request) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'admin');
    const { id } = PathId.parse(request.params);
    const decision = timeOffDecisionSchema.parse(request.body);
    const row = await decideTimeOff(auth.tenantId, id, {
      status: decision.status,
      decidedBy: auth.actorId,
      note: decision.note,
      at: new Date(),
    });
    await publishStaffEvent('staff.timeoff.decided', auth.tenantId, auth.actorId, {
      timeOffRequestId: row.id,
      staffMemberId: row.staffMemberId,
      status: row.status,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
    });
    return ok(timeOffView(row));
  });

  app.post('/v1/staff/time-off/:id/cancel', async (request) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const row = await cancelTimeOff(auth.tenantId, id);
    if (row.status !== 'cancelled') {
      // Defensive: a cancellation that reports success while the request is
      // still live would leave someone believing they are back on the rota.
      throw badRequest('That request could not be cancelled.');
    }
    return ok(timeOffView(row));
  });
};

export default staffScheduleRoutes;
