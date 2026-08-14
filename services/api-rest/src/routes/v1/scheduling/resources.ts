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
import { queryBool } from '@sparx/api-core/query';
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
  getResourcePropertyIds,
  getResourcePropertyIdsFor,
} from '@sparx/scheduling';
import { requireSchedulingModule, toSchedulingContext } from '../../../lib/scheduling-context.js';
import { resolveListScopeIds } from '../../../lib/property.js';
import { resourceFeedUrl } from '../../../lib/scheduling-ical.js';

const PathId = z.object({ id: z.string().uuid() });
const ListQuery = z.object({
  kind: z.enum(['staff', 'asset', 'table', 'space', 'equipment']).optional(),
  locationId: z.string().uuid().optional(),
  activeOnly: queryBool.optional(),
  // Absent ⇒ the active site (`x-sparx-property-id`); `all` ⇒ every site this
  // member may reach. A resource picker / calendar lane shows one business's
  // people + equipment, not the tenant's whole roster.
  property: z.string().optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; route registration is sync.
const schedulingResourceRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/scheduling/resources', async (request) => {
    await requireSchedulingModule(request);
    const auth = requireRole(request, 'viewer');
    const { tenantId } = toSchedulingContext(request);
    const query = ListQuery.parse(request.query);
    const propertyIds = await resolveListScopeIds(
      auth,
      query.property,
      request.headers['x-sparx-property-id']
    );
    const rows = await listResources(tenantId, { ...query, propertyIds });
    // One query for the whole page's site scope rather than one per row.
    const scopes = await getResourcePropertyIdsFor(
      tenantId,
      rows.map((r) => r.id)
    );
    return ok(rows.map((r) => resourceView(r, scopes.get(r.id) ?? [])));
  });

  app.post('/v1/scheduling/resources', async (request, reply) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toSchedulingContext(request);
    const input = CreateResourceInput.parse(request.body);
    const row = await createResource(tenantId, input);
    return reply.code(201).send(ok(resourceView(row, input.propertyIds)));
  });

  app.get('/v1/scheduling/resources/:id', async (request) => {
    await requireSchedulingModule(request);
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    const [row, scope] = await Promise.all([
      getResource(tenantId, id),
      getResourcePropertyIds(tenantId, id),
    ]);
    return ok(resourceView(row, scope));
  });

  // The resource's private subscribe-to `.ics` feed URL (docs/79 §8.1). Any staff
  // member with dashboard access can copy it into Google/Outlook/Apple; the signed
  // URL itself is the auth on the public feed endpoint. read = auth (no role gate).
  app.get('/v1/scheduling/resources/:id/calendar-feed', async (request) => {
    await requireSchedulingModule(request);
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    await getResource(tenantId, id); // 404s a missing/foreign resource before signing
    return ok({ feedUrl: resourceFeedUrl(tenantId, id) });
  });

  app.patch('/v1/scheduling/resources/:id', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    const input = UpdateResourceInput.parse({ ...(request.body as object), id });
    const row = await updateResource(tenantId, input);
    return ok(resourceView(row, await getResourcePropertyIds(tenantId, id)));
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

function resourceView(r: SchedulingResource, propertyIds: string[]) {
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
    // The sites this resource works for. EMPTY = every site — so a single-site
    // tenant, and any resource deliberately shared across two businesses, both
    // read as `[]` here and the picker shows "All sites".
    propertyIds,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export default schedulingResourceRoutes;
