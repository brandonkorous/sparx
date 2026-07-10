// Scheduling services — the bookable things (appointment / class / reservation /
// rental). Setup CRUD; the booking + availability engine reads these.
//
//   GET    /v1/scheduling/services          → list
//   POST   /v1/scheduling/services          → create
//   GET    /v1/scheduling/services/:id      → get one
//   PATCH  /v1/scheduling/services/:id      → update
//   DELETE /v1/scheduling/services/:id      → soft-delete

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import type { SchedulingService } from '@sparx/db';
import { CreateServiceInput, UpdateServiceInput } from '@sparx/scheduling-schemas';
import {
  createService,
  updateService,
  getService,
  listServicesPaged,
  deleteService,
} from '@sparx/scheduling';
import { requireSchedulingModule, toSchedulingContext } from '../../../lib/scheduling-context.js';

const PathId = z.object({ id: z.string().uuid() });
const ListQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  bookingType: z.enum(['appointment', 'class', 'reservation', 'rental']).optional(),
  activeOnly: z.coerce.boolean().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; route registration is sync.
const schedulingServiceRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/scheduling/services', async (request) => {
    await requireSchedulingModule(request);
    const { tenantId } = toSchedulingContext(request);
    const query = ListQuery.parse(request.query);
    const { items, total } = await listServicesPaged(tenantId, query);
    return paged(items.map(serviceView), { total, per_page: query.take ?? 50 });
  });

  app.post('/v1/scheduling/services', async (request, reply) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toSchedulingContext(request);
    const input = CreateServiceInput.parse(request.body);
    const row = await createService(tenantId, input);
    return reply.code(201).send(ok(serviceView(row)));
  });

  app.get('/v1/scheduling/services/:id', async (request) => {
    await requireSchedulingModule(request);
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    return ok(serviceView(await getService(tenantId, id)));
  });

  app.patch('/v1/scheduling/services/:id', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    const input = UpdateServiceInput.parse({ ...(request.body as object), id });
    return ok(serviceView(await updateService(tenantId, input)));
  });

  app.delete('/v1/scheduling/services/:id', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    await deleteService(tenantId, id);
    return ok({ id, deleted: true });
  });
};

function serviceView(s: SchedulingService) {
  return {
    id: s.id,
    bookingType: s.bookingType,
    name: s.name,
    description: s.description,
    durationMinutes: s.durationMinutes,
    bufferBeforeMin: s.bufferBeforeMin,
    bufferAfterMin: s.bufferAfterMin,
    priceCents: s.priceCents,
    currency: s.currency,
    capacity: s.capacity,
    assignmentStrategy: s.assignmentStrategy,
    resourceRequirements: s.resourceRequirements,
    policyId: s.policyId,
    intakeFormId: s.intakeFormId,
    locationId: s.locationId,
    minLeadMinutes: s.minLeadMinutes,
    maxAdvanceDays: s.maxAdvanceDays,
    slotIntervalMin: s.slotIntervalMin,
    color: s.color,
    imageUrl: s.imageUrl,
    bookableOnline: s.bookableOnline,
    requiresApproval: s.requiresApproval,
    isActive: s.isActive,
    requiresAsset: s.requiresAsset,
    settings: s.settings,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export default schedulingServiceRoutes;
