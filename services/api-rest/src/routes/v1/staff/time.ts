// Time — what actually happened (docs/149 §3, §5 Timesheets).
//
//   GET    /v1/staff/time            → entries, filtered
//   POST   /v1/staff/time            → a typed duration
//   PATCH  /v1/staff/time/:id        → correct one (409 once approved)
//   DELETE /v1/staff/time/:id        → remove one (409 once approved)
//   GET    /v1/staff/time/open       → who is on the clock right now
//   POST   /v1/staff/time/clock-in
//   POST   /v1/staff/time/clock-out
//   POST   /v1/staff/time/approve    → releases the labour deriver
//   POST   /v1/staff/time/reject
//   POST   /v1/staff/time/reopen
//
// A time entry is not a shift and not a booking. See 90-staff.prisma — collapsing
// any two of the three is how "scheduled hours" and "paid hours" become one wrong
// number.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import {
  approveTimeEntries,
  clockIn,
  clockOut,
  createTimeEntry,
  deleteTimeEntry,
  listTimeEntries,
  openEntries,
  rejectTimeEntries,
  reopenTimeEntries,
  updateTimeEntry,
} from '@sparx/staff';
import {
  approveTimeSchema,
  clockInSchema,
  clockOutSchema,
  jobTypeSchema,
  timeEntryCreateSchema,
  timeEntryStatusSchema,
  timeEntryUpdateSchema,
} from '@sparx/staff/schemas';
import { requireStaffModule } from '../../../lib/staff-context.js';
import { publishStaffEvent } from '../../../lib/staff-events.js';
import { displayName } from './views.js';

const PathId = z.object({ id: z.string().uuid() });

const ListQuery = z.object({
  staffMemberId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  status: timeEntryStatusSchema.optional(),
  propertyId: z.string().uuid().optional(),
  jobType: jobTypeSchema.optional(),
  jobId: z.string().uuid().optional(),
});

const IdsBody = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });

function entryView(row: {
  id: string;
  staffMemberId: string;
  propertyId: string | null;
  workedOn: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  minutes: number;
  breakMinutes: number;
  jobType: string | null;
  jobId: string | null;
  source: string;
  status: string;
  approvedAt: Date | null;
  approvedBy: string | null;
  note: string | null;
  staffMember?: { firstName: string; lastName: string | null };
}) {
  return {
    id: row.id,
    staffMemberId: row.staffMemberId,
    staffMemberName: row.staffMember ? displayName(row.staffMember) : null,
    propertyId: row.propertyId,
    workedOn: row.workedOn,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    minutes: row.minutes,
    breakMinutes: row.breakMinutes,
    jobType: row.jobType,
    jobId: row.jobId,
    source: row.source,
    status: row.status,
    approvedAt: row.approvedAt,
    approvedBy: row.approvedBy,
    note: row.note,
    // Approved time is locked; the surface uses this to decide whether the row
    // is editable at all, rather than offering a field that 409s on save.
    editable: row.status !== 'approved',
  };
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; route registration is sync.
const staffTimeRoutes: FastifyPluginAsync = async (app) => {
  // Static before parametric, so `/time/open` is never read as an entry id.
  app.get('/v1/staff/time/open', async (request) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'viewer');
    const rows = await openEntries(auth.tenantId);
    return ok({ items: rows.map(entryView) });
  });

  app.get('/v1/staff/time', async (request) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'viewer');
    const query = ListQuery.parse(request.query);
    const rows = await listTimeEntries(auth.tenantId, query);
    return ok({
      items: rows.map(entryView),
      totalMinutes: rows.reduce((sum, row) => sum + row.minutes, 0),
    });
  });

  app.post('/v1/staff/time', async (request, reply) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'editor');
    const input = timeEntryCreateSchema.parse(request.body);
    const row = await createTimeEntry(auth.tenantId, input);
    return reply.code(201).send(ok(entryView(row)));
  });

  app.patch('/v1/staff/time/:id', async (request) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const input = timeEntryUpdateSchema.parse(request.body);
    return ok(entryView(await updateTimeEntry(auth.tenantId, id, input)));
  });

  app.delete('/v1/staff/time/:id', async (request, reply) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    await deleteTimeEntry(auth.tenantId, id);
    return reply.code(204).send();
  });

  app.post('/v1/staff/time/clock-in', async (request, reply) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'editor');
    const input = clockInSchema.parse(request.body);
    // The clock reads the SERVER's now unless a time is given. A phone with a
    // wrong clock would otherwise write a shift that started tomorrow.
    const row = await clockIn(auth.tenantId, { ...input, at: input.at ?? new Date() });
    return reply.code(201).send(ok(entryView(row)));
  });

  app.post('/v1/staff/time/clock-out', async (request) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'editor');
    const input = clockOutSchema.parse(request.body);
    const row = await clockOut(auth.tenantId, { ...input, at: input.at ?? new Date() });
    return ok(entryView(row));
  });

  /**
   * Approval — the act that releases the labour deriver, so it is `admin`.
   *
   * The published event carries what was ACTUALLY moved, never what was asked
   * for: re-approving an already-approved timesheet would otherwise re-derive
   * the whole month for no change. `skippedOpen` comes back so the surface can
   * say "two people are still clocked in" instead of silently approving less
   * than the button implied.
   */
  app.post('/v1/staff/time/approve', async (request) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'admin');
    const { ids } = approveTimeSchema.parse(request.body);
    const result = await approveTimeEntries(auth.tenantId, ids, auth.actorId, new Date());

    // One event per person, each carrying the span their approved days cover.
    // The deriver works on a PERIOD — a per-entry event would make it write a
    // partial figure for the same person several times over, and each write
    // would land on the same idempotency key, so the last partial one would win.
    for (const staffMemberId of result.staffMemberIds) {
      const times = result.approved
        .filter((e) => e.staffMemberId === staffMemberId)
        .map((e) => e.workedOn.getTime());
      if (times.length === 0) continue;
      await publishStaffEvent('staff.time.approved', auth.tenantId, auth.actorId, {
        staffMemberId,
        from: new Date(Math.min(...times)).toISOString(),
        to: new Date(Math.max(...times)).toISOString(),
      });
    }

    if (result.approvedIds.length > 0) {
      request.log.info(
        {
          tenantId: auth.tenantId,
          approved: result.approvedIds.length,
          people: result.staffMemberIds.length,
        },
        'staff time approved'
      );
    }

    return ok({
      approvedIds: result.approvedIds,
      staffMemberIds: result.staffMemberIds,
      skippedOpen: result.skippedOpen,
    });
  });

  app.post('/v1/staff/time/reject', async (request) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'admin');
    const { ids } = IdsBody.parse(request.body);
    return ok({ ids: await rejectTimeEntries(auth.tenantId, ids) });
  });

  // Reopening does NOT delete the wage expense already derived from this time —
  // re-deriving after the correction updates it in place, and blanking it in the
  // meantime would empty the month for anyone reading profit right now.
  app.post('/v1/staff/time/reopen', async (request) => {
    await requireStaffModule(request);
    const auth = requireRole(request, 'admin');
    const { ids } = IdsBody.parse(request.body);
    return ok({ ids: await reopenTimeEntries(auth.tenantId, ids) });
  });
};

export default staffTimeRoutes;
