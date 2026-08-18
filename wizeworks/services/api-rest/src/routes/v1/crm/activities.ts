// CRM activity feed — the append-only event log (locked decision #3).
//
//   GET  /v1/crm/activities  → list (filter by customer / deal / b2b / type / window)
//   POST /v1/crm/activities  → record a new activity (human-authored notes,
//                              calls, meetings, files; consumers go through
//                              the in-process service directly)

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { activityService } from '@wizeworks/crm';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireCrmModule, toCrmContext } from '../../../lib/crm-context.js';

// HTTP query params arrive as strings with snake_case keys, but
// activityService.list (also called by MCP/Server Actions) validates against
// the camelCase ListActivitiesInput where `limit` is a NUMBER. Parse + coerce
// here and map to the service shape — mirrors the deals/quotes/tasks routes.
// Without this, `?customer_id=…&limit=100` fails number validation (500) and
// snake_case anchors are silently dropped (unscoped results).
const ListQuery = z.object({
  customer_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
  b2b_account_id: z.string().uuid().optional(),
  type: z.string().max(63).optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  cursor: z.string().optional(),
});

const activityRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/crm/activities', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const q = ListQuery.parse(request.query);
    const rows = await activityService.list(toCrmContext(request), {
      customerId: q.customer_id,
      dealId: q.deal_id,
      companyId: q.b2b_account_id,
      type: q.type,
      since: q.since,
      until: q.until,
      limit: q.limit,
      cursor: q.cursor,
    });
    return ok(rows);
  });

  app.post('/v1/crm/activities', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const activity = await activityService.record(toCrmContext(request), request.body);
    reply.code(201);
    return ok(activity);
  });
  return Promise.resolve();
};

export default activityRoutes;
