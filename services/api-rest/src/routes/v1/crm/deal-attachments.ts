// Deal ↔ order / billing-document (quote) join-table operations (locked
// decision #5). The `/quotes` URL is kept for stability even though the
// linked entity is now a BillingDocument — quotes ARE billing documents.
//
//   GET    /v1/crm/deals/:id/orders               → list attached orders
//   POST   /v1/crm/deals/:id/orders               → attach order
//   DELETE /v1/crm/deals/:id/orders/:orderId      → detach order
//   GET    /v1/crm/deals/:id/quotes               → list attached documents
//   POST   /v1/crm/deals/:id/quotes               → attach document
//   DELETE /v1/crm/deals/:id/quotes/:documentId   → detach document

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { dealService } from '@sparx/crm';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireCrmModule, toCrmContext } from '../../../lib/crm-context.js';

const PathId = z.object({ id: z.string().uuid() });
const OrderLinkParams = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
});
const DocumentLinkParams = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
});
const AttachOrderBody = z.object({ order_id: z.string().uuid() });
const AttachDocumentBody = z.object({ document_id: z.string().uuid() });

const dealAttachmentRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/crm/deals/:id/orders', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const rows = await dealService.listAttachedOrders(toCrmContext(request), id);
    return ok(rows);
  });

  app.post('/v1/crm/deals/:id/orders', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const body = AttachOrderBody.parse(request.body);
    const link = await dealService.attachOrder(toCrmContext(request), {
      dealId: id,
      orderId: body.order_id,
    });
    reply.code(201);
    return ok(link);
  });

  app.delete('/v1/crm/deals/:id/orders/:orderId', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id, orderId } = OrderLinkParams.parse(request.params);
    await dealService.detachOrder(toCrmContext(request), { dealId: id, orderId });
    reply.code(204);
  });

  app.get('/v1/crm/deals/:id/quotes', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const rows = await dealService.listAttachedDocuments(toCrmContext(request), id);
    return ok(rows);
  });

  app.post('/v1/crm/deals/:id/quotes', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const body = AttachDocumentBody.parse(request.body);
    const link = await dealService.attachDocument(toCrmContext(request), {
      dealId: id,
      documentId: body.document_id,
    });
    reply.code(201);
    return ok(link);
  });

  app.delete('/v1/crm/deals/:id/quotes/:documentId', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id, documentId } = DocumentLinkParams.parse(request.params);
    await dealService.detachDocument(toCrmContext(request), { dealId: id, documentId });
    reply.code(204);
  });
  return Promise.resolve();
};

export default dealAttachmentRoutes;
