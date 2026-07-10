// Invoicing — document workflows + their stages (docs/87 §3).
//
//   GET    /v1/invoicing/workflows                       → list (with stages)
//   POST   /v1/invoicing/workflows                       → create
//   GET    /v1/invoicing/workflows/:id                   → fetch one (with stages)
//   PATCH  /v1/invoicing/workflows/:id                   → update
//   DELETE /v1/invoicing/workflows/:id                   → archive (no hard delete)
//   POST   /v1/invoicing/workflows/:id/stages            → create a stage
//   POST   /v1/invoicing/workflows/:id/stages/reorder    → batch-reorder stages
//   PATCH  /v1/invoicing/workflows/:id/stages/:stageId   → update a stage
//   DELETE /v1/invoicing/workflows/:id/stages/:stageId   → delete a stage

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { documentWorkflowService } from '@sparx/crm';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireInvoicingModule, toInvoicingContext } from '../../../lib/invoicing-context.js';

const PathId = z.object({ id: z.string().uuid() });
const StagePathIds = z.object({ id: z.string().uuid(), stageId: z.string().uuid() });
const ListQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  include_archived: z.coerce.boolean().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const workflowRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/invoicing/workflows', async (request) => {
    requireRole(request, 'viewer');
    await requireInvoicingModule(request);
    const q = ListQuery.parse(request.query);
    const { items, total } = await documentWorkflowService.listPaged(toInvoicingContext(request), {
      q: q.q,
      includeArchived: q.include_archived,
      take: q.take,
      skip: q.skip,
    });
    return paged(items, { total, per_page: q.take ?? 50 });
  });

  app.get('/v1/invoicing/workflows/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireInvoicingModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await documentWorkflowService.get(toInvoicingContext(request), id));
  });

  app.post('/v1/invoicing/workflows', async (request, reply) => {
    requireRole(request, 'editor');
    await requireInvoicingModule(request);
    const workflow = await documentWorkflowService.create(
      toInvoicingContext(request),
      request.body
    );
    reply.code(201);
    return ok(workflow);
  });

  app.patch('/v1/invoicing/workflows/:id', async (request) => {
    requireRole(request, 'editor');
    await requireInvoicingModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await documentWorkflowService.update(toInvoicingContext(request), id, request.body));
  });

  app.delete('/v1/invoicing/workflows/:id', async (request) => {
    requireRole(request, 'admin');
    await requireInvoicingModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await documentWorkflowService.archive(toInvoicingContext(request), id));
  });

  app.post('/v1/invoicing/workflows/:id/stages', async (request, reply) => {
    requireRole(request, 'editor');
    await requireInvoicingModule(request);
    const { id } = PathId.parse(request.params);
    const stage = await documentWorkflowService.createStage(
      toInvoicingContext(request),
      id,
      request.body
    );
    reply.code(201);
    return ok(stage);
  });

  app.post('/v1/invoicing/workflows/:id/stages/reorder', async (request) => {
    requireRole(request, 'editor');
    await requireInvoicingModule(request);
    const { id } = PathId.parse(request.params);
    return ok(
      await documentWorkflowService.reorderStages(toInvoicingContext(request), id, request.body)
    );
  });

  app.patch('/v1/invoicing/workflows/:id/stages/:stageId', async (request) => {
    requireRole(request, 'editor');
    await requireInvoicingModule(request);
    const { stageId } = StagePathIds.parse(request.params);
    return ok(
      await documentWorkflowService.updateStage(toInvoicingContext(request), stageId, request.body)
    );
  });

  app.delete('/v1/invoicing/workflows/:id/stages/:stageId', async (request, reply) => {
    requireRole(request, 'editor');
    await requireInvoicingModule(request);
    const { stageId } = StagePathIds.parse(request.params);
    await documentWorkflowService.deleteStage(toInvoicingContext(request), stageId);
    reply.code(204);
  });

  return Promise.resolve();
};

export default workflowRoutes;
