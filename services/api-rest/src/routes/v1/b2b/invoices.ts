// B2B invoices — net-terms accounts-receivable (docs/10 §9, docs/87 §15). Thin
// transport over @sparx/b2b's invoiceService, which projects a B2B-AR "invoice"
// over a BillingDocument on the system `net-terms-ar` workflow.
//
//   GET    /v1/b2b/invoices                    → list (filtered by account/status)
//   POST   /v1/b2b/invoices                    → create manually
//   GET    /v1/b2b/invoices/:id                → fetch one
//   PATCH  /v1/b2b/invoices/:id                → update notes / due date (open only)
//   POST   /v1/b2b/invoices/:id/mark-paid      → record full payment, lift hold
//   POST   /v1/b2b/invoices/:id/write-off      → void the receivable

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { invoiceService, type PendingEvent } from '@sparx/b2b';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { createPublisher, publishEvent, type PublisherLogger } from '@sparx/events';
import { requireB2bModule, toB2bContext } from '../../../lib/b2b-context.js';
import { resolvePropertyId } from '../../../lib/property.js';
import { env } from '../../../env.js';

const pubLogger: PublisherLogger = {
  info: (obj, msg) => console.info(msg ?? '', obj),
  warn: (obj, msg) => console.warn(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
};
const publisher = createPublisher({ projectId: env.GCP_PROJECT_ID, logger: pubLogger });

async function emit(
  ctx: { tenantId: string; userId: string },
  events: PendingEvent[]
): Promise<void> {
  for (const e of events) {
    await publishEvent(publisher, e.type, ctx.tenantId, ctx.userId ?? null, e.payload, pubLogger);
  }
}

const PathId = z.object({ id: z.string().uuid() });

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const b2bInvoiceRoutes: FastifyPluginAsync = async (app) => {
  // ── List ─────────────────────────────────────────────────────────────────
  app.get('/v1/b2b/invoices', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'viewer');
    const ctx = toB2bContext(request);
    const { items, total, skip, take } = await invoiceService.listInvoices(
      ctx,
      invoiceService.InvoiceListQuery.parse(request.query)
    );
    return reply.send(paged(items, { total, skip, take }));
  });

  // ── Create (manual) ────────────────────────────────────────────────────────
  app.post('/v1/b2b/invoices', async (request, reply) => {
    await requireB2bModule(request);
    const auth = requireRole(request, 'editor');
    const ctx = toB2bContext(request);
    // The site the operator is working in issues the invoice (docs/131 §3.6) — it
    // decides the numbering sequence + the letterhead frozen at finalize.
    const propertyId = await resolvePropertyId(
      auth,
      request.headers['x-sparx-property-id'] as string | undefined
    );
    const { invoice, events } = await invoiceService.createInvoice(ctx, request.body, propertyId);
    await emit(ctx, events);
    return reply.status(201).send(ok(invoice));
  });

  // ── Fetch one ─────────────────────────────────────────────────────────────
  app.get('/v1/b2b/invoices/:id', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'viewer');
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    return reply.send(ok(await invoiceService.getInvoice(ctx, id)));
  });

  // ── Update (notes / due date, open only) ───────────────────────────────────
  app.patch('/v1/b2b/invoices/:id', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'editor');
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    return reply.send(ok(await invoiceService.updateInvoice(ctx, id, request.body)));
  });

  // ── Mark paid ─────────────────────────────────────────────────────────────
  app.post('/v1/b2b/invoices/:id/mark-paid', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'editor');
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    return reply.send(ok(await invoiceService.markInvoicePaid(ctx, id, request.body)));
  });

  // ── Write off (void the receivable) ────────────────────────────────────────
  app.post('/v1/b2b/invoices/:id/write-off', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'admin');
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    return reply.send(ok(await invoiceService.writeOffInvoice(ctx, id, request.body)));
  });
};

export default b2bInvoiceRoutes;
