// CRM deals — list / get / create / update / move-stage / forecast.
// Attach/detach order + quote routes live in ./deal-attachments.ts to keep
// this file under the 200-line target.
//
//   GET    /v1/crm/deals                      → list
//   POST   /v1/crm/deals                      → create
//   GET    /v1/crm/deals/forecast             → weighted forecast
//   GET    /v1/crm/deals/:id                  → fetch one
//   PATCH  /v1/crm/deals/:id                  → update
//   DELETE /v1/crm/deals/:id                  → soft-delete (for a mistake; the
//                                               normal close is move-stage to Won/Lost)
//   POST   /v1/crm/deals/:id/move-stage       → move to a new stage

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { dealService } from '@sparx/crm';
import { withTenant } from '@sparx/db';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireCrmModule, toCrmContext } from '../../../lib/crm-context.js';
import { reachableSiteIds } from '../../../lib/property.js';
import dealAttachmentRoutes from './deal-attachments.js';
import { publishDomainEvent } from '../../../lib/staff-events.js';

const PathId = z.object({ id: z.string().uuid() });

const ListQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  pipeline_id: z.string().uuid().optional(),
  stage_id: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
  b2b_account_id: z.string().uuid().optional(),
  assigned_rep_id: z.string().uuid().nullable().optional(),
  state: z.enum(['open', 'closed']).optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const ForecastQuery = z.object({
  pipeline_id: z.string().uuid().nullable().optional(),
  start_month: z.string().optional(),
  end_month: z.string().optional(),
});

const dealRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/crm/deals', async (request) => {
    const auth = requireRole(request, 'viewer');
    await requireCrmModule(request);
    const q = ListQuery.parse(request.query);
    const { items, total } = await dealService.list(toCrmContext(request), {
      q: q.q,
      pipelineId: q.pipeline_id,
      stageId: q.stage_id,
      customerId: q.customer_id,
      companyId: q.b2b_account_id,
      assignedRepId: q.assigned_rep_id ?? undefined,
      // A site-restricted member sees only their businesses' deals (docs/131
      // §3.3); an unrestricted member sees all (reachableSiteIds → undefined).
      propertyIds: reachableSiteIds(auth),
      state: q.state,
      take: q.take,
      skip: q.skip,
    });
    return paged(items, { total, per_page: q.take ?? 50 });
  });

  app.get('/v1/crm/deals/forecast', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const q = ForecastQuery.parse(request.query);
    const result = await dealService.forecast(toCrmContext(request), {
      pipelineId: q.pipeline_id ?? undefined,
      startMonth: q.start_month,
      endMonth: q.end_month,
    });
    return ok(result);
  });

  app.get('/v1/crm/deals/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const deal = await dealService.get(toCrmContext(request), id);
    return ok(deal);
  });

  app.post('/v1/crm/deals', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const deal = await dealService.create(toCrmContext(request), request.body);
    reply.code(201);
    return ok(deal);
  });

  app.patch('/v1/crm/deals/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const deal = await dealService.update(toCrmContext(request), id, request.body);
    return ok(deal);
  });

  app.delete('/v1/crm/deals/:id', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    await dealService.softDelete(toCrmContext(request), id);
    reply.code(204);
  });

  app.post('/v1/crm/deals/:id/move-stage', async (request) => {
    const auth = requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const ctx = toCrmContext(request);
    const deal = await dealService.moveStage(ctx, id, request.body);

    // A WON deal is a payable moment, and the staff module needs to hear about
    // it to calculate commission. `moveStage` already publishes
    // `crm.deal.stage_changed`, but that is a CrmTopic: the CRM bus does not
    // reach an in-process platform consumer, so a worker subscribing to it would
    // never receive a message. Hence a second, narrower publish on the platform
    // bus — only `won`, because only `won` earns anybody anything.
    //
    // Read the stage TYPE rather than its name: a tenant is free to rename "Won"
    // to "Signed", and matching on the label would quietly stop paying people.
    const stage = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
      tx.pipelineStage.findFirst({
        where: { id: deal.stageId },
        select: { stageType: true },
      })
    );
    if (stage?.stageType === 'won') {
      await publishDomainEvent('crm.deal.won', ctx.tenantId, auth.actorId, { dealId: deal.id });
    }

    return ok(deal);
  });

  await app.register(dealAttachmentRoutes);
};

export default dealRoutes;
