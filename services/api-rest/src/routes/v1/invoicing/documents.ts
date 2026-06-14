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
//   POST   /v1/invoicing/documents/:id/payments          → record a payment (§8)
//   GET    /v1/invoicing/documents/:id/payments          → payment history
//   GET    /v1/invoicing/documents/:id/pdf               → branded print-HTML (§10)
//   GET    /v1/invoicing/documents/:id/snapshots/:sid/pdf → print a frozen record

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  billingDocumentService,
  billingDocumentStageService,
  billingLineService,
  billingPaymentService,
  billingRenderService,
} from '@sparx/crm';
import { GatewayNotFoundError, PaymentConfigError, paymentService } from '@sparx/payments';
import { ok, paged } from '@sparx/api-core/envelope';
import { ApiError } from '@sparx/api-core/errors';
import { requireRole } from '@sparx/api-core/auth';
import { requireInvoicingModule, toInvoicingContext } from '../../../lib/invoicing-context.js';
import { renderTenantInvoiceHtml, resolveInvoiceBrand } from '../../../lib/invoice-render.js';

const PathId = z.object({ id: z.string().uuid() });
const LinePathIds = z.object({ id: z.string().uuid(), lineId: z.string().uuid() });

// Offset pagination + the passthrough filters the service understands. `take`/`skip`
// match the platform list convention; they map onto the service's `limit`/`offset`.
const ListDocumentsQuery = z.object({
  workflowId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  b2bAccountId: z.string().uuid().optional(),
  status: z.string().max(20).optional(),
  includeDeleted: z.coerce.boolean().optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});
const SnapshotPathIds = z.object({ id: z.string().uuid(), snapshotId: z.string().uuid() });
const PaymentLinkBody = z.object({
  successUrl: z.string().url(),
  expiresAt: z.string().datetime().optional(),
});

const documentRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/invoicing/documents', async (request) => {
    requireRole(request, 'viewer');
    await requireInvoicingModule(request);
    const q = ListDocumentsQuery.parse(request.query);
    const { items, total } = await billingDocumentService.list(toInvoicingContext(request), {
      workflowId: q.workflowId,
      stageId: q.stageId,
      customerId: q.customerId,
      b2bAccountId: q.b2bAccountId,
      status: q.status,
      includeDeleted: q.includeDeleted,
      // The service speaks limit/offset; `default(50)`/`default(0)` apply when omitted.
      ...(q.take !== undefined ? { limit: q.take } : {}),
      ...(q.skip !== undefined ? { offset: q.skip } : {}),
    });
    return paged(items, { total, skip: q.skip ?? 0, per_page: q.take ?? 50 });
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

  // ── Payments / AR (§8) ───────────────────────────────────────────────────────
  // A payment is allowed on a locked/finalized document — locking freezes lines,
  // not the act of paying.
  app.post('/v1/invoicing/documents/:id/payments', async (request, reply) => {
    requireRole(request, 'editor');
    await requireInvoicingModule(request);
    const { id } = PathId.parse(request.params);
    const result = await billingPaymentService.recordPayment(
      toInvoicingContext(request),
      id,
      request.body
    );
    reply.code(201);
    return ok(result);
  });

  app.get('/v1/invoicing/documents/:id/payments', async (request) => {
    requireRole(request, 'viewer');
    await requireInvoicingModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await billingPaymentService.listPayments(toInvoicingContext(request), id));
  });

  // Hosted pay-link for the outstanding balance (docs/94 ADR §8). Routes through
  // PaymentService → the tenant's gateway (Sparx Pay = 0.5% fee; others = $0). The
  // resulting payment_intent carries metadata.invoiceId, so the payment webhook records
  // the payment against this document on success. Manual / unconfigured tenants get a
  // clean validation error (they collect by hand instead).
  app.post('/v1/invoicing/documents/:id/payment-link', async (request, reply) => {
    requireRole(request, 'editor');
    await requireInvoicingModule(request);
    const { id } = PathId.parse(request.params);
    const body = PaymentLinkBody.parse(request.body ?? {});
    const ctx = toInvoicingContext(request);

    const doc = await billingDocumentService.get(ctx, id);
    const balanceCents = Math.round(Number(doc.balance) * 100);
    if (balanceCents <= 0) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'This document has no outstanding balance to collect.'
      );
    }

    let url: string | null;
    try {
      url = await paymentService.createPaymentLink({
        tenantId: ctx.tenantId,
        amount: balanceCents,
        currency: doc.currency.toLowerCase(),
        invoiceId: doc.id,
        description: doc.number ? `Invoice ${doc.number}` : 'Invoice payment',
        successUrl: body.successUrl,
        ...(body.expiresAt ? { expiresAt: new Date(body.expiresAt) } : {}),
      });
    } catch (err) {
      if (err instanceof PaymentConfigError || err instanceof GatewayNotFoundError) {
        throw new ApiError(
          'VALIDATION_ERROR',
          'No payment gateway is configured. Set one up in Settings → Payments.'
        );
      }
      throw err;
    }
    if (!url) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'The active payment gateway does not support hosted payment links.'
      );
    }

    reply.code(201);
    return ok({ url });
  });

  // ── PDF / print (§10) ────────────────────────────────────────────────────────
  // v1 returns branded print-styled HTML (the browser's Print → PDF path); a
  // server-side PDF byte stream is the documented fast-follow. Render data + the
  // tenant brand are assembled, then routed through the tenant's ACTIVE published
  // template (the builder-authored path) or the built-in default renderer.
  app.get('/v1/invoicing/documents/:id/pdf', async (request, reply) => {
    requireRole(request, 'viewer');
    await requireInvoicingModule(request);
    const ctx = toInvoicingContext(request);
    const { id } = PathId.parse(request.params);
    const [data, brand] = await Promise.all([
      billingRenderService.buildRenderData(ctx, id),
      resolveInvoiceBrand(ctx),
    ]);
    const html = await renderTenantInvoiceHtml(ctx, data, brand);
    void reply.header('Content-Type', 'text/html; charset=utf-8');
    void reply.header(
      'Content-Disposition',
      `inline; filename="${data.number ?? 'document'}.html"`
    );
    return reply.send(html);
  });

  // Print a frozen snapshot — the approved estimate / final invoice exactly as it
  // stood when captured (§4). Renders the frozen substance; brand is resolved live.
  app.get('/v1/invoicing/documents/:id/snapshots/:snapshotId/pdf', async (request, reply) => {
    requireRole(request, 'viewer');
    await requireInvoicingModule(request);
    const ctx = toInvoicingContext(request);
    const { snapshotId } = SnapshotPathIds.parse(request.params);
    const [data, brand] = await Promise.all([
      billingRenderService.buildRenderDataFromSnapshot(ctx, snapshotId),
      resolveInvoiceBrand(ctx),
    ]);
    const html = await renderTenantInvoiceHtml(ctx, data, brand);
    void reply.header('Content-Type', 'text/html; charset=utf-8');
    void reply.header(
      'Content-Disposition',
      `inline; filename="${data.number ?? 'document'}.html"`
    );
    return reply.send(html);
  });

  return Promise.resolve();
};

export default documentRoutes;
