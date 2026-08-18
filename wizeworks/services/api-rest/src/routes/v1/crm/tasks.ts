// CRM tasks — list / get / create / update / complete + overdue + today.
//
//   GET    /v1/crm/tasks                → list
//   POST   /v1/crm/tasks                → create
//   GET    /v1/crm/tasks/overdue        → overdue tasks for caller (or all with ?user_id=)
//   GET    /v1/crm/tasks/today          → today's tasks for caller
//   GET    /v1/crm/tasks/:id            → fetch one
//   PATCH  /v1/crm/tasks/:id            → update
//   POST   /v1/crm/tasks/:id/complete   → mark complete (idempotent)

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { taskService } from '@wizeworks/crm';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { requireRole, requireAuth } from '@wizeworks/api-core/auth';
import { requireCrmModule, toCrmContext } from '../../../lib/crm-context.js';
import { reachableSiteIds } from '../../../lib/property.js';

const PathId = z.object({ id: z.string().uuid() });

const ListQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  assigned_to_user_id: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
  status: z.enum(['open', 'completed', 'cancelled']).optional(),
  due_before: z.string().datetime().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const OverdueQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  user_id: z.string().uuid().optional(),
});

const taskRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/crm/tasks', async (request) => {
    const auth = requireRole(request, 'viewer');
    await requireCrmModule(request);
    const q = ListQuery.parse(request.query);
    const { items, total } = await taskService.list(toCrmContext(request), {
      q: q.q,
      assignedToUserId: q.assigned_to_user_id,
      customerId: q.customer_id,
      dealId: q.deal_id,
      // A site-restricted member sees only their businesses' task queue
      // (docs/131 §3.3) — the reason Task got a site column in the first place.
      propertyIds: reachableSiteIds(auth),
      status: q.status,
      dueBefore: q.due_before ? new Date(q.due_before) : undefined,
      take: q.take,
      skip: q.skip,
    });
    return paged(items, { total, per_page: q.take ?? 50 });
  });

  app.get('/v1/crm/tasks/overdue', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const q = OverdueQuery.parse(request.query);
    const rows = await taskService.getOverdue(toCrmContext(request), {
      q: q.q,
      userId: q.user_id,
    });
    return ok(rows);
  });

  app.get('/v1/crm/tasks/today', async (request) => {
    const auth = requireRole(request, 'viewer');
    await requireCrmModule(request);
    const rows = await taskService.getTodayForUser(toCrmContext(request), {
      userId: auth.actorId,
    });
    return ok(rows);
  });

  app.get('/v1/crm/tasks/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const task = await taskService.get(toCrmContext(request), id);
    return ok(task);
  });

  app.post('/v1/crm/tasks', async (request, reply) => {
    requireAuth(request);
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const task = await taskService.create(toCrmContext(request), request.body);
    reply.code(201);
    return ok(task);
  });

  app.patch('/v1/crm/tasks/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const task = await taskService.update(toCrmContext(request), id, request.body);
    return ok(task);
  });

  app.post('/v1/crm/tasks/:id/complete', async (request) => {
    requireAuth(request);
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const task = await taskService.complete(toCrmContext(request), { taskId: id });
    return ok(task);
  });
  return Promise.resolve();
};

export default taskRoutes;
