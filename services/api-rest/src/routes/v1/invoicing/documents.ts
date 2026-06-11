// Invoicing — billing documents + their lines (docs/87 §2/§5/§12).
//
//   GET    /v1/invoicing/documents                       → list (paginated)
//   POST   /v1/invoicing/documents                       → create
//   GET    /v1/invoicing/documents/:id                   → fetch one (with lines)
//   PATCH  /v1/invoicing/documents/:id                   → update header
//   DELETE /v1/invoicing/documents/:id                   → soft-delete
//   POST   /v1/invoicing/documents/:id/lines             → add a line (priced)
//   PATCH  /v1/invoicing/documents/:id/lines/:lineId     → update a line
//   DELETE /v1/invoicing/documents/:id/lines/:lineId     → remove a line

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { billingDocumentService, billingLineService } from '@sparx/crm';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireInvoicingModule, toInvoicingContext } from '../../../lib/invoicing-context.js';

const PathId = z.object({ id: z.string().uuid() });
const LinePathIds = z.object({ id: z.string().uuid(), lineId: z.string().uuid() });

const documentRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/invoicing/documents', async (request) => {
    requireRole(request, 'viewer');
    await requireInvoicingModule(request);
    return ok(await billingDocumentService.list(toInvoicingContext(request), request.query));
  });

  app.get('/v1/invoicing/documents/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireInvoicingModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await billingDocumentService.get(toInvoicingContext(request), id));
  });

  app.post('/v1/invoicing/documents', async (request, reply) => {
    requireRole(request, 'editor');
    await requireInvoicingModule(request);
    const doc = await billingDocumentService.create(toInvoicingContext(request), request.body);
    reply.code(201);
    return ok(doc);
  });

  app.patch('/v1/invoicing/documents/:id', async (request) => {
    requireRole(request, 'editor');
    await requireInvoicingModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await billingDocumentService.update(toInvoicingContext(request), id, request.body));
  });

  app.delete('/v1/invoicing/documents/:id', async (request, reply) => {
    requireRole(request, 'editor');
    await requireInvoicingModule(request);
    const { id } = PathId.parse(request.params);
    await billingDocumentService.remove(toInvoicingContext(request), id);
    reply.code(204);
  });

  // ── Lines ────────────────────────────────────────────────────────────────
  app.post('/v1/invoicing/documents/:id/lines', async (request, reply) => {
    requireRole(request, 'editor');
    await requireInvoicingModule(request);
    const { id } = PathId.parse(request.params);
    const doc = await billingLineService.addLine(toInvoicingContext(request), id, request.body);
    reply.code(201);
    return ok(doc);
  });

  app.patch('/v1/invoicing/documents/:id/lines/:lineId', async (request) => {
    requireRole(request, 'editor');
    await requireInvoicingModule(request);
    const { lineId } = LinePathIds.parse(request.params);
    return ok(await billingLineService.updateLine(toInvoicingContext(request), lineId, request.body));
  });

  app.delete('/v1/invoicing/documents/:id/lines/:lineId', async (request) => {
    requireRole(request, 'editor');
    await requireInvoicingModule(request);
    const { lineId } = LinePathIds.parse(request.params);
    return ok(await billingLineService.removeLine(toInvoicingContext(request), lineId));
  });

  return Promise.resolve();
};

export default documentRoutes;
