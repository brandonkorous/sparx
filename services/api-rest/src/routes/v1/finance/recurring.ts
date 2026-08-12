// Recurring costs — the templates, and the button that catches them up.
//
//   GET    /v1/finance/recurring          → templates + when each next lands
//   POST   /v1/finance/recurring          → add one
//   PATCH  /v1/finance/recurring/:id      → edit (a schedule change re-anchors)
//   DELETE /v1/finance/recurring/:id      → drop the template; its expenses stay
//   POST   /v1/finance/recurring/generate → run every due template now
//
// The generate route exists for the owner who just added rent starting in January
// and wants this year's rows immediately, rather than waiting for the worker's
// next tick. Idempotent, so pressing it twice is free.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import {
  createRecurring,
  deleteRecurring,
  generateDueExpenses,
  listRecurring,
  updateRecurring,
} from '@sparx/finance';
import { createRecurringSchema, updateRecurringSchema } from '@sparx/finance/schemas';
import {
  headerPropertyId,
  requireFinanceModule,
  toFinanceContext,
} from '../../../lib/finance-context.js';
import { resolvePropertyId } from '../../../lib/property.js';

const PathId = z.object({ id: z.string().uuid() });
const ListQuery = z.object({ includeInactive: z.coerce.boolean().optional() });
const GenerateBody = z.object({ through: z.coerce.date().optional() }).default({});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; route registration is sync.
const financeRecurringRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/finance/recurring', async (request) => {
    await requireFinanceModule(request);
    requireRole(request, 'viewer');
    const { tenantId } = toFinanceContext(request);
    const query = ListQuery.parse(request.query);
    const rows = await listRecurring(tenantId, { includeInactive: query.includeInactive });
    return ok(rows);
  });

  app.post('/v1/finance/recurring', async (request, reply) => {
    await requireFinanceModule(request);
    const auth = requireRole(request, 'editor');
    const { tenantId } = toFinanceContext(request);
    const input = createRecurringSchema.parse(request.body);
    const propertyId =
      input.propertyId ?? (await resolvePropertyId(auth, headerPropertyId(request)));
    return reply.code(201).send(ok(await createRecurring(tenantId, { ...input, propertyId })));
  });

  app.patch('/v1/finance/recurring/:id', async (request) => {
    await requireFinanceModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toFinanceContext(request);
    const { id } = PathId.parse(request.params);
    const input = updateRecurringSchema.parse({ ...(request.body as object), id });
    return ok(await updateRecurring(tenantId, input));
  });

  app.delete('/v1/finance/recurring/:id', async (request, reply) => {
    await requireFinanceModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toFinanceContext(request);
    const { id } = PathId.parse(request.params);
    await deleteRecurring(tenantId, id);
    return reply.code(204).send();
  });

  app.post('/v1/finance/recurring/generate', async (request) => {
    await requireFinanceModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toFinanceContext(request);
    const { through } = GenerateBody.parse(request.body ?? {});
    const results = await generateDueExpenses(tenantId, through ?? new Date());
    return ok({
      templates: results.length,
      generated: results.reduce((sum, r) => sum + r.generated, 0),
      results,
    });
  });
};

export default financeRecurringRoutes;
