// Invoicing — builder-authored PRINT TEMPLATES (docs/87 §10, Phase 5b).
//
//   GET    /v1/invoicing/templates?property=       → list (seeds the default once)
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
//
// SITE-SCOPED, on the house `?property=` rule (resolveListScope): absent means
// the site you are working in, `all` means every site. A letterhead carries a
// business's name and address, so the list has to answer "which of my businesses
// is this for" -- see billingTemplateService's own header.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  billingRenderService,
  billingTemplateService,
  type BillingRenderData,
} from '@wizeworks/crm';
import type { BuilderNode } from '@wizeworks/builder-schemas';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireInvoicingModule, toInvoicingContext } from '../../../lib/invoicing-context.js';
import { resolveListScope } from '../../../lib/property.js';
import { resolveInvoiceBrand } from '../../../lib/invoice-render.js';
import { renderInvoiceTree } from '../../../lib/invoice-tree-render.js';

const PathId = z.object({ id: z.string().uuid() });
const PreviewQuery = z.object({ documentId: z.string().uuid().optional() });

// Offset pagination for the template catalog. `listOrSeed` returns the full set
// (and lazily seeds the built-in default on first use); the window is applied here
// so the seed-on-first-use contract other callers depend on stays unchanged.
const ListTemplatesQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  // The house site filter: an id, or the literal `all`. See resolveListScope.
  property: z.string().min(1).max(64).optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

/**
 * What the editor's preview is drawn against when there is no real document.
 *
 * TWO RULES, both learned the hard way.
 *
 * INDUSTRY-NEUTRAL. It read "Fuel injector" and "Diagnostic + install", tagged
 * Part and Labor, which is a diesel repair shop -- one client's trade presented
 * to a textile studio, a salon and a publisher as what their bill looks like.
 * `DEFAULT_DOCUMENT_LINE_TYPES` was neutralised for exactly this reason and
 * carries a comment saying so; this sample sat one file away and was missed.
 * [[feedback_industry_agnostic_no_diesel]]
 *
 * EVERY BLOCK POPULATED. The author is choosing which blocks to keep, so a
 * block that draws nothing here looks like a block that does not work. It had no
 * ship-to, no delivery charge and no payments, so three of the nine blocks were
 * invisible in the one place their whole purpose is to be seen.
 * [[feedback_never_present_absence_as_measurement]]
 */
const SAMPLE_DATA: BillingRenderData = {
  title: 'Invoice',
  number: 'INV-000123',
  status: 'partial',
  currency: 'USD',
  issuedAt: '2026-06-01T00:00:00.000Z',
  dueAt: '2026-07-01T00:00:00.000Z',
  validUntil: null,
  billTo: {
    heading: 'Bill to',
    name: 'Sample Customer',
    lines: ['18 Example Street', 'Portland, OR 97214', 'US', 'customer@example.com'],
  },
  // Deliberately a DIFFERENT address from the bill-to, because a ship-to block
  // that repeats the line above it teaches nothing about what the block is for.
  shipTo: {
    heading: 'Ship to',
    name: 'Sample Customer',
    lines: ['Unit 4, 220 Example Road', 'Portland, OR 97211', 'US'],
  },
  lines: [
    {
      typeLabel: 'Product',
      description: 'Something you sell',
      quantity: 2,
      unitPrice: 150,
      lineTotal: 300,
      taxable: true,
    },
    {
      typeLabel: 'Service',
      description: 'Work you did, by the hour',
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
    shippingTotal: 12,
    surchargeTotal: 0,
    total: 638.25,
    depositTotal: 0,
    amountPaid: 200,
    balance: 438.25,
  },
  notes: 'Anything you typed in the Notes box on the invoice shows up here.',
  payments: [
    { label: 'Payment', method: 'Card', amount: 200, receivedAt: '2026-06-08T00:00:00.000Z' },
  ],
};

const templateRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/invoicing/templates', async (request) => {
    const auth = requireRole(request, 'viewer');
    await requireInvoicingModule(request);
    const q = ListTemplatesQuery.parse(request.query);
    // Absent = the site being worked in; `all` = every site, which is the only
    // way to see another business's letterheads and has to be asked for.
    const scoped = await resolveListScope(auth, q.property, request.headers['x-sparx-property-id']);
    const all = await billingTemplateService.listOrSeed(
      toInvoicingContext(request),
      scoped === undefined ? { propertyId: null, everySite: true } : { propertyId: scoped }
    );
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
    const auth = requireRole(request, 'editor');
    await requireInvoicingModule(request);
    // A letterhead made while working in a business belongs to THAT business
    // unless the author says otherwise -- including saying `null` out loud for a
    // deliberately shared one, which is why this tests for the key's presence
    // rather than its truthiness.
    const body: Record<string, unknown> = { ...(request.body as Record<string, unknown> | null) };
    if (!('propertyId' in body)) {
      body.propertyId = await resolveListScope(
        auth,
        undefined,
        request.headers['x-sparx-property-id']
      );
    }
    const created = await billingTemplateService.create(toInvoicingContext(request), body);
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
