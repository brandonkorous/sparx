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
//   POST   /v1/invoicing/documents/:id/advance           → move to a stage (§3)
//   GET    /v1/invoicing/documents/:id/snapshots         → frozen-record history
//   GET    /v1/invoicing/documents/:id/snapshots/:sid    → one frozen record

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { billingDocumentService, billingDocumentStageService, billingLineService } from '@sparx/crm';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireInvoicingModule, toInvoicingContext } from '../../../lib/invoicing-context.js';

const PathId = z.object({ id: z.string().uuid() });
const LinePathIds = z.object({ id: z.string().uuid(), lineId: z.string().uuid() });
const SnapshotPathIds = z.object({ id: z.string().uuid(), snapshotId: z.string().uuid() });

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
    return ok(
      await billingLineService.updateLine(toInvoicingContext(request), lineId, request.body)
    );
  });

  app.delete('/v1/invoicing/documents/:id/lines/:lineId', async (request) => {
    requireRole(request, 'editor');
    await requireInvoicingModule(request);
    const { lineId } = LinePathIds.parse(request.params);
    return ok(await billingLineService.removeLine(toInvoicingContext(request), lineId));
  });

  // ── Stage advance ──────────────────────────────────────────────────────────
  // Moves the document to a stage in its workflow; entering the stage runs its
  // configured effects (number / snapshot / finalize / lock).
  app.post('/v1/invoicing/documents/:id/advance', async (request) => {
    requireRole(request, 'editor');
    await requireInvoicingModule(request);
    const { id } = PathId.parse(request.params);
    return ok(
      await billingDocumentStageService.advance(toInvoicingContext(request), id, request.body)
    );
  });

  // ── Snapshots (append-only frozen records) ───────────────────────────────────
  app.get('/v1/invoicing/documents/:id/snapshots', async (request) => {
    requireRole(request, 'viewer');
    await requireInvoicingModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await billingDocumentStageService.listSnapshots(toInvoicingContext(request), id));
  });

  app.get('/v1/invoicing/documents/:id/snapshots/:snapshotId', async (request) => {
    requireRole(request, 'viewer');
    await requireInvoicingModule(request);
    const { snapshotId } = SnapshotPathIds.parse(request.params);
    return ok(
      await billingDocumentStageService.getSnapshot(toInvoicingContext(request), snapshotId)
    );
  });

  return Promise.resolve();
};

export default documentRoutes;
