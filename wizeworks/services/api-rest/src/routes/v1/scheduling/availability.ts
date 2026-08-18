// Scheduling availability — recurring weekly windows per resource, one-off
// exceptions, and the bookable-slot query the booking surfaces call.
//
//   GET    /v1/scheduling/resources/:id/availability  → list weekly windows
//   PUT    /v1/scheduling/resources/:id/availability  → replace the week
//   GET    /v1/scheduling/exceptions                  → list exceptions
//   POST   /v1/scheduling/exceptions                  → create exception
//   DELETE /v1/scheduling/exceptions/:id              → delete exception
//   GET    /v1/scheduling/availability                → bookable slots for a service

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { AvailabilityException, AvailabilityWindow } from '@wizeworks/db';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { AvailabilityExceptionInput, AvailabilityWindowInput } from '@wizeworks/scheduling-schemas';
import {
  setAvailabilityWindows,
  listAvailabilityWindows,
  createAvailabilityException,
  listAvailabilityExceptions,
  deleteAvailabilityException,
  getAvailability,
  type ComputedSlot,
} from '@wizeworks/scheduling';
import { requireSchedulingModule, toSchedulingContext } from '../../../lib/scheduling-context.js';

const PathId = z.object({ id: z.string().uuid() });
const SetWindowsBody = z.object({
  windows: z.array(AvailabilityWindowInput.omit({ resourceId: true })).max(100),
});
const ExceptionListQuery = z.object({
  resourceId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
const SlotQuery = z.object({
  serviceId: z.string().uuid(),
  from: z.string().datetime(),
  to: z.string().datetime(),
  resourceId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  partySize: z.coerce.number().int().min(1).max(100000).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; route registration is sync.
const schedulingAvailabilityRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/scheduling/resources/:id/availability', async (request) => {
    await requireSchedulingModule(request);
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    const rows = await listAvailabilityWindows(tenantId, id);
    return ok(rows.map(windowView));
  });

  app.put('/v1/scheduling/resources/:id/availability', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    const body = SetWindowsBody.parse(request.body);
    const rows = await setAvailabilityWindows(tenantId, { resourceId: id, windows: body.windows });
    return ok(rows.map(windowView));
  });

  app.get('/v1/scheduling/exceptions', async (request) => {
    await requireSchedulingModule(request);
    const { tenantId } = toSchedulingContext(request);
    const query = ExceptionListQuery.parse(request.query);
    const rows = await listAvailabilityExceptions(tenantId, query);
    return ok(rows.map(exceptionView));
  });

  app.post('/v1/scheduling/exceptions', async (request, reply) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toSchedulingContext(request);
    const input = AvailabilityExceptionInput.parse(request.body);
    const row = await createAvailabilityException(tenantId, input);
    return reply.code(201).send(ok(exceptionView(row)));
  });

  app.delete('/v1/scheduling/exceptions/:id', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    await deleteAvailabilityException(tenantId, id);
    return ok({ id, deleted: true });
  });

  app.get('/v1/scheduling/availability', async (request) => {
    await requireSchedulingModule(request);
    const { tenantId } = toSchedulingContext(request);
    const query = SlotQuery.parse(request.query);
    const slots = await getAvailability(tenantId, query, Date.now());
    return ok(slots.map(slotView));
  });
};

function windowView(w: AvailabilityWindow) {
  return {
    id: w.id,
    resourceId: w.resourceId,
    dayOfWeek: w.dayOfWeek,
    startMinute: w.startMinute,
    endMinute: w.endMinute,
    validFrom: w.validFrom ? w.validFrom.toISOString().slice(0, 10) : null,
    validTo: w.validTo ? w.validTo.toISOString().slice(0, 10) : null,
  };
}

function exceptionView(e: AvailabilityException) {
  return {
    id: e.id,
    resourceId: e.resourceId,
    locationId: e.locationId,
    kind: e.kind,
    startAt: e.startAt.toISOString(),
    endAt: e.endAt.toISOString(),
    reason: e.reason,
    meta: e.meta,
  };
}

function slotView(s: ComputedSlot) {
  const counts = Object.values(s.candidatesByRole).map((ids) => ids.length);
  return {
    startAt: new Date(s.startAtUtc).toISOString(),
    endAt: new Date(s.endAtUtc).toISOString(),
    candidatesByRole: s.candidatesByRole,
    remaining: counts.length ? Math.min(...counts) : 0,
  };
}

export default schedulingAvailabilityRoutes;
