// Invoicing — builder-authored PRINT TEMPLATES (docs/87 §10, Phase 5b).
//
//   GET    /v1/invoicing/templates                 → list (seeds the default once)
//   POST   /v1/invoicing/templates                 → create
//   GET    /v1/invoicing/templates/:id             → fetch one (with draft tree)
//   PATCH  /v1/invoicing/templates/:id             → rename / save draft tree
//   DELETE /v1/invoicing/templates/:id             → delete (not the default)
//   POST   /v1/invoicing/templates/:id/publish     → snapshot draft → published
//   POST   /v1/invoicing/templates/:id/default     → make this the default
//   GET    /v1/invoicing/templates/:id/preview?documentId= → render the DRAFT
//          tree against a real document (or sample data) for the editor preview
//
// AUTHOR-only: this designs the document's printed presentation; it never touches
// the document's financial data (that is the structured Phase-6 editor).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { billingRenderService, billingTemplateService, type BillingRenderData } from '@sparx/crm';
import type { BuilderNode } from '@sparx/builder-schemas';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireInvoicingModule, toInvoicingContext } from '../../../lib/invoicing-context.js';
import { resolveInvoiceBrand } from '../../../lib/invoice-render.js';
import { renderInvoiceTree } from '../../../lib/invoice-tree-render.js';

const PathId = z.object({ id: z.string().uuid() });
const PreviewQuery = z.object({ documentId: z.string().uuid().optional() });

// Offset pagination for the template catalog. `listOrSeed` returns the full set
// (and lazily seeds the built-in default on first use); the window is applied here
// so the seed-on-first-use contract other callers depend on stays unchanged.
const ListTemplatesQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

// Sample render data for the editor preview when no real document is supplied —
// representative of a typical estimate so the author sees every section populated.
const SAMPLE_DATA: BillingRenderData = {
  title: 'Invoice',
  number: 'INV-000123',
  status: 'unpaid',
  currency: 'USD',
  issuedAt: '2026-06-01T00:00:00.000Z',
  dueAt: null,
  validUntil: null,
  billTo: { heading: 'Bill to', name: 'Sample Customer', lines: ['customer@example.com'] },
  shipTo: null,
  lines: [
    {
      typeLabel: 'Part',
      description: 'Fuel injector',
      quantity: 2,
      unitPrice: 150,
      lineTotal: 300,
      taxable: true,
    },
    {
      typeLabel: 'Labor',
      description: 'Diagnostic + install',
      quantity: 2.5,
      unitPrice: 120,
      lineTotal: 300,
      taxable: false,
    },
  ],
  totals: {
    subtotal: 600,
    discountTotal: 0,
    taxTotal: 26.25,
    taxRate: 0.0875,
    shippingTotal: 0,
    surchargeTotal: 0,
    total: 626.25,
    depositTotal: 0,
    amountPaid: 0,
    balance: 626.25,
  },
  notes: 'Thanks for your business.',
};

const templateRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/invoicing/templates', async (request) => {
    requireRole(request, 'viewer');
    await requireInvoicingModule(request);
    const q = ListTemplatesQuery.parse(request.query);
    const all = await billingTemplateService.listOrSeed(toInvoicingContext(request));
    const needle = q.q?.toLowerCase();
    const filtered = needle ? all.filter((t) => t.name.toLowerCase().includes(needle)) : all;
    const total = filtered.length;
    const skip = q.skip ?? 0;
    // Window only when asked — an un-paged caller still gets the whole (filtered) set.
    const items =
      q.take !== undefined || q.skip !== undefined
        ? filtered.slice(skip, skip + (q.take ?? total))
        : filtered;
    return paged(items, { total, skip, per_page: q.take ?? 50 });
  });

  app.get('/v1/invoicing/templates/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireInvoicingModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await billingTemplateService.get(toInvoicingContext(request), id));
  });

  app.post('/v1/invoicing/templates', async (request, reply) => {
    requireRole(request, 'editor');
    await requireInvoicingModule(request);
    const created = await billingTemplateService.create(toInvoicingContext(request), request.body);
    reply.code(201);
    return ok(created);
  });

  app.patch('/v1/invoicing/templates/:id', async (request) => {
    requireRole(request, 'editor');
    await requireInvoicingModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await billingTemplateService.update(toInvoicingContext(request), id, request.body));
  });

  app.delete('/v1/invoicing/templates/:id', async (request, reply) => {
    requireRole(request, 'editor');
    await requireInvoicingModule(request);
    const { id } = PathId.parse(request.params);
    await billingTemplateService.remove(toInvoicingContext(request), id);
    reply.code(204);
  });

  app.post('/v1/invoicing/templates/:id/publish', async (request) => {
    requireRole(request, 'editor');
    await requireInvoicingModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await billingTemplateService.publish(toInvoicingContext(request), id));
  });

  app.post('/v1/invoicing/templates/:id/default', async (request) => {
    requireRole(request, 'editor');
    await requireInvoicingModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await billingTemplateService.setDefault(toInvoicingContext(request), id));
  });

  // Render the template's DRAFT tree to print-HTML for the editor's live preview —
  // against a real document when `documentId` is given, else representative sample
  // data. Returns text/html (the editor embeds it in an iframe).
  app.get('/v1/invoicing/templates/:id/preview', async (request, reply) => {
    requireRole(request, 'viewer');
    await requireInvoicingModule(request);
    const ctx = toInvoicingContext(request);
    const { id } = PathId.parse(request.params);
    const { documentId } = PreviewQuery.parse(request.query ?? {});

    const draft = await billingTemplateService.getDraftTree(ctx, id);
    if (!draft) {
      void reply.code(404);
      return reply.send('Template not found');
    }
    const [data, brand] = await Promise.all([
      documentId
        ? billingRenderService.buildRenderData(ctx, documentId)
        : Promise.resolve(SAMPLE_DATA),
      resolveInvoiceBrand(ctx),
    ]);
    const html = renderInvoiceTree(draft.tree as unknown as BuilderNode, data, brand);
    void reply.header('Content-Type', 'text/html; charset=utf-8');
    return reply.send(html);
  });

  return Promise.resolve();
};

export default templateRoutes;
