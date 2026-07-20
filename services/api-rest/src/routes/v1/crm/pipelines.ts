// CRM pipelines + their stages.
//
//   GET    /v1/crm/pipelines                          → list (with stages)
//   POST   /v1/crm/pipelines                          → create
//   GET    /v1/crm/pipelines/:id                      → fetch one (with stages)
//   PATCH  /v1/crm/pipelines/:id                      → update
//   DELETE /v1/crm/pipelines/:id                      → archive (no hard delete)
//   POST   /v1/crm/pipelines/:id/stages               → create a stage
//   POST   /v1/crm/pipelines/:id/stages/reorder       → batch-reorder stages
//   PATCH  /v1/crm/pipelines/:id/stages/:stageId      → update a stage

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pipelineService } from '@sparx/crm';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireCrmModule, toCrmContext } from '../../../lib/crm-context.js';
import { resolvePropertyId, reachableSiteIds } from '../../../lib/property.js';

const PathId = z.object({ id: z.string().uuid() });
const StagePathIds = z.object({
  id: z.string().uuid(),
  stageId: z.string().uuid(),
});
const ListQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  include_archived: z.coerce.boolean().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const pipelineRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/crm/pipelines', async (request) => {
    const auth = requireRole(request, 'viewer');
    await requireCrmModule(request);
    const q = ListQuery.parse(request.query);
    const { items, total } = await pipelineService.list(toCrmContext(request), {
      q: q.q,
      includeArchived: q.include_archived,
      // Restricted members see only their businesses' pipelines (docs/131 §3.3).
      propertyIds: reachableSiteIds(auth),
      take: q.take,
      skip: q.skip,
    });
    return paged(items, { total, per_page: q.take ?? 50 });
  });

  app.get('/v1/crm/pipelines/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const pipeline = await pipelineService.get(toCrmContext(request), id);
    return ok(pipeline);
  });

  app.post('/v1/crm/pipelines', async (request, reply) => {
    const auth = requireRole(request, 'editor');
    await requireCrmModule(request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    // Default the pipeline to the site being worked in (docs/131 §5); explicit
    // null still authors a tenant-wide process.
    const propertyId =
      body.propertyId === undefined
        ? await resolvePropertyId(
            auth,
            request.headers['x-sparx-property-id'] as string | undefined
          )
        : (body.propertyId as string | null);
    const pipeline = await pipelineService.create(toCrmContext(request), { ...body, propertyId });
    reply.code(201);
    return ok(pipeline);
  });

  app.patch('/v1/crm/pipelines/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const pipeline = await pipelineService.update(toCrmContext(request), id, request.body);
    return ok(pipeline);
  });

  app.delete('/v1/crm/pipelines/:id', async (request) => {
    requireRole(request, 'admin');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const pipeline = await pipelineService.archive(toCrmContext(request), id);
    return ok(pipeline);
  });

  app.post('/v1/crm/pipelines/:id/stages', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const stage = await pipelineService.createStage(toCrmContext(request), id, request.body);
    reply.code(201);
    return ok(stage);
  });

  app.post('/v1/crm/pipelines/:id/stages/reorder', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const stages = await pipelineService.reorderStages(toCrmContext(request), id, request.body);
    return ok(stages);
  });

  app.patch('/v1/crm/pipelines/:id/stages/:stageId', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { stageId } = StagePathIds.parse(request.params);
    const stage = await pipelineService.updateStage(toCrmContext(request), stageId, request.body);
    return ok(stage);
  });
  return Promise.resolve();
};

export default pipelineRoutes;
