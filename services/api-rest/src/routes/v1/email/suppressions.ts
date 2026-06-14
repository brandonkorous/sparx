// Email suppressions — the do-not-send list (manual + Mailgun-mirrored).
//
//   GET    /v1/email/suppressions          → list (scope/q filters, paged)
//   POST   /v1/email/suppressions          → add one (manual)
//   POST   /v1/email/suppressions/import   → bulk add
//   DELETE /v1/email/suppressions/:id      → remove

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { suppressionService } from '@sparx/email-platform';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireEmailModule, toEmailContext } from '../../../lib/email-context.js';

const PathId = z.object({ id: z.string().uuid() });

// The dashboard list pages page with `take`/`skip` (docs/34 §7); the
// suppression service speaks `limit`/`offset`, so map them here. The other
// filters (scope/q) are validated by the service's own ListSuppressionsQuery.
const ListSuppressionsPageQuery = z.object({
  scope: z.string().optional(),
  q: z.string().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const emailSuppressionRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/email/suppressions', async (request) => {
    requireRole(request, 'viewer');
    await requireEmailModule(request);
    const q = ListSuppressionsPageQuery.parse(request.query);
    // The service's ListSuppressionsQuery is `.strict()` and speaks limit/offset,
    // so hand it only the keys it knows.
    const { items, total } = await suppressionService.list(toEmailContext(request), {
      ...(q.scope ? { scope: q.scope } : {}),
      ...(q.q ? { q: q.q } : {}),
      ...(q.take !== undefined ? { limit: q.take } : {}),
      ...(q.skip !== undefined ? { offset: q.skip } : {}),
    });
    return paged(items, { total, per_page: q.take ?? 100 });
  });

  app.post('/v1/email/suppressions', async (request, reply) => {
    requireRole(request, 'editor');
    await requireEmailModule(request);
    const row = await suppressionService.add(toEmailContext(request), request.body);
    reply.code(201);
    return ok(row);
  });

  app.post('/v1/email/suppressions/import', async (request) => {
    requireRole(request, 'admin');
    await requireEmailModule(request);
    const result = await suppressionService.importMany(toEmailContext(request), request.body);
    return ok(result);
  });

  app.delete('/v1/email/suppressions/:id', async (request, reply) => {
    requireRole(request, 'editor');
    await requireEmailModule(request);
    const { id } = PathId.parse(request.params);
    await suppressionService.remove(toEmailContext(request), id);
    reply.code(204);
  });

  return Promise.resolve();
};

export default emailSuppressionRoutes;
