// Service requests (docs/144 §7).
//
//   GET    /v1/crm/tickets                    → the queue
//   POST   /v1/crm/tickets                    → open one by hand
//   GET    /v1/crm/tickets/:id                → one request + both its clocks
//   PATCH  /v1/crm/tickets/:id                → edit (re-prioritising re-promises)
//   POST   /v1/crm/tickets/:id/stage          → move it along
//   POST   /v1/crm/tickets/:id/assign         → hand it to somebody (or nobody)
//   DELETE /v1/crm/tickets/:id                → soft-delete a mistake
//
//   GET/POST/PATCH/DELETE /v1/crm/sla-policies[/:id]  → what was promised
//   POST   /v1/crm/sla-policies/sweep         → run the clock check now
//
// The stage move is its own endpoint rather than a field on PATCH, mirroring
// deals: that transition stamps resolved/closed, writes the timeline entry and
// emits the event a tenant's automations key off, and a plain field write would
// silently skip all three.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { queryBool } from '@sparx/api-core/query';
import { slaPolicyService, ticketService, ticketSlaSweep } from '@sparx/crm';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireAuth, requireRole } from '@sparx/api-core/auth';

import { requireCrmModule, toCrmContext } from '../../../lib/crm-context.js';
import { reachableSiteIds } from '../../../lib/property.js';

const IdPath = z.object({ id: z.string().uuid() });

/**
 * Query-string shape.
 *
 * Separate from `TicketQuery` in @sparx/crm-schemas on purpose: everything
 * arrives as a string over HTTP, so this coerces and renames, and the service
 * schema stays the single source of truth for what the FILTERS mean. Booleans go
 * through `queryBool` rather than `z.coerce.boolean()`, which is `Boolean(value)`
 * and so reads the string `'false'` as TRUE — that would silently invert the two
 * filters a support lead relies on most.
 */
const TicketListQuery = z.object({
  q: z.string().max(255).optional(),
  pipeline_id: z.string().uuid().optional(),
  stage_id: z.string().uuid().optional(),
  state: z.enum(['open', 'resolved', 'closed', 'all']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  source: z.enum(['chat', 'email', 'form', 'phone', 'manual', 'api']).optional(),
  customer_id: z.string().uuid().optional(),
  b2b_account_id: z.string().uuid().optional(),
  assigned_to: z.string().uuid().optional(),
  unassigned: queryBool.optional(),
  breached: queryBool.optional(),
  due_within_minutes: z.coerce.number().int().min(1).max(43_200).optional(),
  tags: z.string().max(500).optional(),
  sort: z
    .enum(['created_desc', 'created_asc', 'updated_desc', 'due_asc', 'priority_desc'])
    .optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

// Registration is synchronous; the plugin type demands a promise, so it is
// returned at the end rather than faked with `async` — the same shape the
// sibling CRM route files use.
const ticketRoutes: FastifyPluginAsync = (app) => {
  /* ── The queue ────────────────────────────────────────────────────────── */

  app.get('/v1/crm/tickets', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const q = TicketListQuery.parse(request.query);

    const { items, total } = await ticketService.list(toCrmContext(request), {
      query: {
        ...(q.q ? { q: q.q } : {}),
        ...(q.pipeline_id ? { pipelineId: q.pipeline_id } : {}),
        ...(q.stage_id ? { stageId: q.stage_id } : {}),
        ...(q.state ? { state: q.state } : {}),
        ...(q.priority ? { priority: q.priority } : {}),
        ...(q.source ? { source: q.source } : {}),
        ...(q.customer_id ? { customerId: q.customer_id } : {}),
        ...(q.b2b_account_id ? { companyId: q.b2b_account_id } : {}),
        ...(q.assigned_to ? { assignedToUserId: q.assigned_to } : {}),
        // `!== undefined`, not truthiness: these are now real booleans, and
        // `q.unassigned ? …` would silently drop an explicit `unassigned=false`.
        ...(q.unassigned !== undefined ? { unassigned: q.unassigned } : {}),
        ...(q.breached !== undefined ? { breached: q.breached } : {}),
        ...(q.due_within_minutes ? { dueWithinMinutes: q.due_within_minutes } : {}),
        ...(q.tags ? { tags: q.tags.split(',').filter(Boolean) } : {}),
        ...(q.sort ? { sort: q.sort } : {}),
        ...(q.take ? { take: q.take } : {}),
        ...(q.skip ? { skip: q.skip } : {}),
      },
      // Site read-scoping (docs/131 §3.3) — a member granted one business sees
      // that business's requests plus the tenant-wide ones, never another
      // business's support queue.
      propertyIds: reachableSiteIds(requireAuth(request)),
    });

    return paged(items, {
      total,
      per_page: q.take ?? 50,
      page: Math.floor((q.skip ?? 0) / (q.take ?? 50)) + 1,
    });
  });

  app.post('/v1/crm/tickets', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const created = await ticketService.create(toCrmContext(request), request.body);
    return reply.code(201).send(ok(created));
  });

  app.get('/v1/crm/tickets/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    return ok(await ticketService.get(toCrmContext(request), id));
  });

  app.patch('/v1/crm/tickets/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    return ok(await ticketService.update(toCrmContext(request), id, request.body));
  });

  app.post('/v1/crm/tickets/:id/stage', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    return ok(await ticketService.moveStage(toCrmContext(request), id, request.body));
  });

  app.post('/v1/crm/tickets/:id/assign', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    return ok(await ticketService.assign(toCrmContext(request), id, request.body));
  });

  app.delete('/v1/crm/tickets/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    await ticketService.softDelete(toCrmContext(request), id);
    return ok({ deleted: true });
  });

  /* ── What was promised ────────────────────────────────────────────────── */
  //
  // Admin-only to WRITE, viewer to READ. Changing a response target changes
  // what the business owes every customer from that moment on — that is an
  // owner's decision, not a support agent's. Reading it is not: an agent
  // looking at an amber row deserves to know what "amber" means here.

  app.get('/v1/crm/sla-policies', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const { items, total } = await slaPolicyService.list(toCrmContext(request), {
      propertyIds: reachableSiteIds(requireAuth(request)),
    });
    return paged(items, { total, per_page: items.length });
  });

  app.get('/v1/crm/sla-policies/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    return ok(await slaPolicyService.get(toCrmContext(request), id));
  });

  app.post('/v1/crm/sla-policies', async (request, reply) => {
    requireRole(request, 'admin');
    await requireCrmModule(request);
    const created = await slaPolicyService.create(toCrmContext(request), request.body);
    return reply.code(201).send(ok(created));
  });

  app.patch('/v1/crm/sla-policies/:id', async (request) => {
    requireRole(request, 'admin');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    return ok(await slaPolicyService.update(toCrmContext(request), id, request.body));
  });

  app.delete('/v1/crm/sla-policies/:id', async (request) => {
    requireRole(request, 'admin');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    return ok(await slaPolicyService.archive(toCrmContext(request), id));
  });

  /**
   * Run the clock check for THIS tenant, now.
   *
   * The cron sweeps every tenant on a schedule; this exists so a person can see
   * the effect of a policy they just changed without waiting for the next tick,
   * and so a support lead who suspects the queue is stale can prove it either
   * way. Idempotent, like the sweep itself — running it twice announces nothing
   * twice.
   */
  app.post('/v1/crm/sla-policies/sweep', async (request) => {
    requireRole(request, 'admin');
    await requireCrmModule(request);
    return ok(await ticketSlaSweep.sweepTenant(toCrmContext(request)));
  });

  return Promise.resolve();
};

export default ticketRoutes;
