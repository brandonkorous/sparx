// Invoicing — the tenant line-type registry (docs/87 §5).
//
//   GET    /v1/invoicing/line-types         → list (active by default)
//   POST   /v1/invoicing/line-types         → create
//   GET    /v1/invoicing/line-types/:id     → fetch one
//   PATCH  /v1/invoicing/line-types/:id     → update (key is immutable)
//   DELETE /v1/invoicing/line-types/:id     → hard delete (unused types only)

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { documentLineTypeService } from '@sparx/crm';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireInvoicingModule, toInvoicingContext } from '../../../lib/invoicing-context.js';

const PathId = z.object({ id: z.string().uuid() });
const ListQuery = z.object({ include_inactive: z.coerce.boolean().optional() });

const lineTypeRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/invoicing/line-types', async (request) => {
    requireRole(request, 'viewer');
    await requireInvoicingModule(request);
    const q = ListQuery.parse(request.query);
    return ok(
      await documentLineTypeService.list(toInvoicingContext(request), {
        includeInactive: q.include_inactive,
      })
    );
  });

  app.get('/v1/invoicing/line-types/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireInvoicingModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await documentLineTypeService.get(toInvoicingContext(request), id));
  });

  app.post('/v1/invoicing/line-types', async (request, reply) => {
    requireRole(request, 'editor');
    await requireInvoicingModule(request);
    const created = await documentLineTypeService.create(toInvoicingContext(request), request.body);
    reply.code(201);
    return ok(created);
  });

  app.patch('/v1/invoicing/line-types/:id', async (request) => {
    requireRole(request, 'editor');
    await requireInvoicingModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await documentLineTypeService.update(toInvoicingContext(request), id, request.body));
  });

  app.delete('/v1/invoicing/line-types/:id', async (request, reply) => {
    requireRole(request, 'editor');
    await requireInvoicingModule(request);
    const { id } = PathId.parse(request.params);
    await documentLineTypeService.remove(toInvoicingContext(request), id);
    reply.code(204);
  });

  return Promise.resolve();
};

export default lineTypeRoutes;
