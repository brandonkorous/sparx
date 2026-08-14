// Business locations — the physical places a business serves customers from.
//
//   GET    /v1/scheduling/locations         → list (scoped to the active site)
//   POST   /v1/scheduling/locations         → create
//   GET    /v1/scheduling/locations/:id     → get one
//   PATCH  /v1/scheduling/locations/:id     → update
//   DELETE /v1/scheduling/locations/:id     → remove (refused if bookings use it)

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { queryBool } from '@sparx/api-core/query';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import {
  createLocation,
  deleteLocation,
  getLocation,
  listLocations,
  updateLocation,
} from '@sparx/scheduling';
import { requireSchedulingModule, toSchedulingContext } from '../../../lib/scheduling-context.js';
import { resolveListScopeIds } from '../../../lib/property.js';

const PathId = z.object({ id: z.string().uuid() });
const ListQuery = z.object({
  activeOnly: queryBool.optional(),
  // Absent ⇒ the active site (`x-sparx-property-id`); `all` ⇒ every site this
  // member may reach. One business's premises list should not show the other's.
  property: z.string().optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; route registration is sync.
const schedulingLocationRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/scheduling/locations', async (request) => {
    await requireSchedulingModule(request);
    const auth = requireRole(request, 'viewer');
    const { tenantId } = toSchedulingContext(request);
    const query = ListQuery.parse(request.query);
    const propertyIds = await resolveListScopeIds(
      auth,
      query.property,
      request.headers['x-sparx-property-id']
    );
    return ok(await listLocations(tenantId, { ...query, propertyIds }));
  });

  app.post('/v1/scheduling/locations', async (request, reply) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toSchedulingContext(request);
    return reply.code(201).send(ok(await createLocation(tenantId, request.body)));
  });

  app.get('/v1/scheduling/locations/:id', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'viewer');
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    return ok(await getLocation(tenantId, id));
  });

  app.patch('/v1/scheduling/locations/:id', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    return ok(await updateLocation(tenantId, { ...(request.body as object), id }));
  });

  app.delete('/v1/scheduling/locations/:id', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    await deleteLocation(tenantId, id);
    return ok({ id, deleted: true });
  });
};

export default schedulingLocationRoutes;
