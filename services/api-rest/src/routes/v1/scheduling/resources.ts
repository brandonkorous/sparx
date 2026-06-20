// Scheduling resources — staff, assets, tables, spaces, equipment. Anything whose
// time a booking consumes; availability is computed per resource.
//
//   GET    /v1/scheduling/resources         → list
//   POST   /v1/scheduling/resources         → create
//   GET    /v1/scheduling/resources/:id     → get one
//   PATCH  /v1/scheduling/resources/:id     → update
//   DELETE /v1/scheduling/resources/:id     → soft-delete

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { SchedulingResource } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { CreateResourceInput, UpdateResourceInput } from '@sparx/scheduling-schemas';
import {
  createResource,
  updateResource,
  getResource,
  listResources,
  deleteResource,
} from '@sparx/scheduling';
import { requireSchedulingModule, toSchedulingContext } from '../../../lib/scheduling-context.js';

const PathId = z.object({ id: z.string().uuid() });
const ListQuery = z.object({
  kind: z.enum(['staff', 'asset', 'table', 'space', 'equipment']).optional(),
  locationId: z.string().uuid().optional(),
  activeOnly: z.coerce.boolean().optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; route registration is sync.
const schedulingResourceRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/scheduling/resources', async (request) => {
    await requireSchedulingModule(request);
    const { tenantId } = toSchedulingContext(request);
    const query = ListQuery.parse(request.query);
    const rows = await listResources(tenantId, query);
    return ok(rows.map(resourceView));
  });

  app.post('/v1/scheduling/resources', async (request, reply) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toSchedulingContext(request);
    const input = CreateResourceInput.parse(request.body);
    const row = await createResource(tenantId, input);
    return reply.code(201).send(ok(resourceView(row)));
  });

  app.get('/v1/scheduling/resources/:id', async (request) => {
    await requireSchedulingModule(request);
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    return ok(resourceView(await getResource(tenantId, id)));
  });

  app.patch('/v1/scheduling/resources/:id', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    const input = UpdateResourceInput.parse({ ...(request.body as object), id });
    return ok(resourceView(await updateResource(tenantId, input)));
  });

  app.delete('/v1/scheduling/resources/:id', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    await deleteResource(tenantId, id);
    return ok({ id, deleted: true });
  });
};

function resourceView(r: SchedulingResource) {
  return {
    id: r.id,
    kind: r.kind,
    userId: r.userId,
    locationId: r.locationId,
    name: r.name,
    description: r.description,
    imageUrl: r.imageUrl,
    color: r.color,
    timezone: r.timezone,
    exclusive: r.exclusive,
    capacity: r.capacity,
    capacityMin: r.capacityMin,
    capacityMax: r.capacityMax,
    skillTags: r.skillTags,
    bookableOnline: r.bookableOnline,
    isActive: r.isActive,
    settings: r.settings,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export default schedulingResourceRoutes;
