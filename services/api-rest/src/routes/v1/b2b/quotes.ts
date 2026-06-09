// B2B RFQ / quote workflow (docs/10 §7, docs/64 Ph2).
//
// Uses the shared `quotes` + `quote_items` tables (CRM spine); B2B adds the
// `respond` lifecycle action and email notifications via Pub/Sub.
//
// Status flow (B2B superset of CRM statuses):
//   draft → submitted → under_review → quoted → accepted/declined/expired
//
//   GET    /v1/b2b/quotes                         → list (filtered by account)
//   POST   /v1/b2b/quotes                         → create (draft, b2bAccountId required)
//   GET    /v1/b2b/quotes/:id                     → fetch one (with items)
//   PATCH  /v1/b2b/quotes/:id                     → update draft fields
//   POST   /v1/b2b/quotes/:id/submit              → draft → submitted
//   POST   /v1/b2b/quotes/:id/respond             → submitted/under_review → quoted (merchant)
//   POST   /v1/b2b/quotes/:id/accept              → quoted → accepted (creates order)
//   POST   /v1/b2b/quotes/:id/decline             → quoted → declined
//   GET    /v1/b2b/quotes/:id/pdf                 → stream printable quote HTML

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@sparx/db';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { notFound, badRequest } from '@sparx/api-core/errors';
import { createPublisher, publishEvent, type PublisherLogger } from '@sparx/events';
import { requireB2bModule, toB2bContext } from '../../../lib/b2b-context.js';
import { env } from '../../../env.js';

const pubLogger: PublisherLogger = {
  info: (obj, msg) => console.info(msg ?? '', obj),
  warn: (obj, msg) => console.warn(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
};
const publisher = createPublisher({ projectId: env.GCP_PROJECT_ID, logger: pubLogger });

const PathId = z.object({ id: z.string().uuid() });

const ListQuery = z.object({
  account_id: z.string().uuid().optional(),
  status: z.string().optional(),
  take: z.coerce.number().int().min(1).max(250).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const CreateBody = z.object({
  b2bAccountId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  expiresAt: z.string().datetime().optional(),
  customerNote: z.string().max(2000).optional(),
  internalNote: z.string().max(2000).optional(),
});

const RespondBody = z.object({
  // Per-line quoted prices: map of itemId → unitPriceCents
  lineItems: z.array(
    z.object({
      itemId: z.string().uuid(),
      unitPriceCents: z.number().int().min(0),
      notes: z.string().max(500).optional(),
    })
  ),
  expiresAt: z.string().datetime().optional(),
  merchantNote: z.string().max(2000).optional(),
});

const DeclineBody = z.object({
  reason: z.string().max(500).optional(),
});

// ── helpers ────────────────────────────────────────────────────────────────

function assertStatus(current: string, allowed: string[], action: string) {
  if (!allowed.includes(current)) {
    throw badRequest(
      `Quote status "${current}" is not valid for the "${action}" action. ` +
        `Allowed statuses: ${allowed.join(', ')}.`
    );
  }
}

function quoteHtml(quote: {
  quoteNumber: string;
  companyName: string;
  status: string;
  validUntil: Date | null;
  customerNote: string | null;
  internalNote: string | null;
  createdAt: Date;
  items: Array<{
    name: string;
    sku: string;
    quantity: number;
    unitPrice: unknown;
    lineTotal: unknown;
  }>;
  subtotal: unknown;
  taxTotal: unknown;
  total: unknown;
}) {
  const fmt = (n: unknown) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const rows = quote.items
    .map(
      (i) =>
        `<tr><td>${i.name}</td><td>${i.sku}</td><td>${i.quantity}</td>` +
        `<td align="right">${fmt(i.unitPrice)}</td><td align="right">${fmt(i.lineTotal)}</td></tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Quote ${quote.quoteNumber}</title>
<style>
  body { font-family: system-ui, sans-serif; font-size: 14px; padding: 40px; color: #111; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .meta { color: #555; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  th { border-bottom: 2px solid #e5e7eb; padding: 8px 4px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666; }
  td { border-bottom: 1px solid #e5e7eb; padding: 8px 4px; }
  .totals { margin-top: 16px; text-align: right; }
  .totals tr td { border: none; padding: 2px 4px; }
  .total-row { font-weight: 600; font-size: 16px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>Quote #${quote.quoteNumber}</h1>
  <div class="meta">
    <div>Company: <strong>${quote.companyName}</strong></div>
    <div>Status: ${quote.status}</div>
    <div>Date: ${quote.createdAt.toLocaleDateString()}</div>
    ${quote.validUntil ? `<div>Expires: ${quote.validUntil.toLocaleDateString()}</div>` : ''}
  </div>
  ${quote.customerNote ? `<p><strong>Note:</strong> ${quote.customerNote}</p>` : ''}
  <table>
    <thead>
      <tr><th>Item</th><th>SKU</th><th>Qty</th><th align="right">Unit price</th><th align="right">Total</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <table class="totals">
    <tr><td>Subtotal</td><td>${fmt(quote.subtotal)}</td></tr>
    <tr><td>Tax</td><td>${fmt(quote.taxTotal)}</td></tr>
    <tr class="total-row"><td>Total</td><td>${fmt(quote.total)}</td></tr>
  </table>
</body>
</html>`;
}

// ── routes ─────────────────────────────────────────────────────────────────

const b2bQuoteRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/b2b/quotes', async (request) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const q = ListQuery.parse(request.query);

    const where: Record<string, unknown> = { tenantId: ctx.tenantId };
    if (q.account_id) where['b2bAccountId'] = q.account_id;
    if (q.status) where['status'] = q.status;

    const [items, total] = await Promise.all([
      withTenant(ctx, (tx) =>
        tx.quote.findMany({
          where,
          take: q.take,
          skip: q.skip,
          orderBy: { createdAt: 'desc' },
          include: {
            b2bAccount: { select: { id: true, companyName: true } },
            _count: { select: { items: true } },
          },
        })
      ),
      withTenant(ctx, (tx) => tx.quote.count({ where })),
    ]);

    return paged(items, { total, per_page: q.take });
  });

  app.get('/v1/b2b/quotes/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);

    const quote = await withTenant(ctx, (tx) =>
      tx.quote.findFirst({
        where: { id, tenantId: ctx.tenantId },
        include: {
          items: true,
          b2bAccount: { select: { id: true, companyName: true } },
          customer: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      })
    );
    if (!quote) throw notFound('quote');
    return ok(quote);
  });

  app.post('/v1/b2b/quotes', async (request, reply) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const body = CreateBody.parse(request.body);

    // Validate the account exists for this tenant.
    const account = await withTenant(ctx, (tx) =>
      tx.b2BAccount.findFirst({
        where: { id: body.b2bAccountId, tenantId: ctx.tenantId, deletedAt: null },
      })
    );
    if (!account) throw notFound('b2b account');

    // Generate quote number: Q-YYYYMMDD-XXXX
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const quoteNumber = `Q-${datePart}-${rand}`;

    const quote = await withTenant(ctx, (tx) =>
      tx.quote.create({
        data: {
          tenantId: ctx.tenantId,
          b2bAccountId: body.b2bAccountId,
          customerId: body.customerId,
          quoteNumber,
          status: 'draft',
          validUntil: body.expiresAt ? new Date(body.expiresAt) : null,
          customerNote: body.customerNote,
          internalNote: body.internalNote,
          createdByUserId: ctx.userId,
        },
        include: {
          b2bAccount: { select: { id: true, companyName: true } },
        },
      })
    );

    reply.code(201);
    return ok(quote);
  });

  app.patch('/v1/b2b/quotes/:id', async (request) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);

    const existing = await withTenant(ctx, (tx) =>
      tx.quote.findFirst({ where: { id, tenantId: ctx.tenantId } })
    );
    if (!existing) throw notFound('quote');
    assertStatus(existing.status, ['draft', 'submitted', 'under_review'], 'update');

    const PatchBody = z.object({
      customerNote: z.string().max(2000).nullable().optional(),
      internalNote: z.string().max(2000).nullable().optional(),
      expiresAt: z.string().datetime().nullable().optional(),
    });
    const body = PatchBody.parse(request.body);

    const updated = await withTenant(ctx, (tx) =>
      tx.quote.update({
        where: { id },
        data: {
          customerNote: body.customerNote,
          internalNote: body.internalNote,
          validUntil:
            body.expiresAt !== undefined
              ? body.expiresAt
                ? new Date(body.expiresAt)
                : null
              : undefined,
          updatedAt: new Date(),
        },
        include: { b2bAccount: { select: { id: true, companyName: true } } },
      })
    );
    return ok(updated);
  });

  // ── submit ──────────────────────────────────────────────────────────────

  app.post('/v1/b2b/quotes/:id/submit', async (request) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);

    const quote = await withTenant(ctx, (tx) =>
      tx.quote.findFirst({
        where: { id, tenantId: ctx.tenantId },
        include: {
          b2bAccount: { select: { id: true, companyName: true } },
          items: true,
        },
      })
    );
    if (!quote) throw notFound('quote');
    assertStatus(quote.status, ['draft'], 'submit');

    const updated = await withTenant(ctx, (tx) =>
      tx.quote.update({
        where: { id },
        data: { status: 'submitted', submittedAt: new Date(), updatedAt: new Date() },
        include: { b2bAccount: { select: { id: true, companyName: true } } },
      })
    );

    // Notify merchant staff via Pub/Sub → email-worker.
    await publishEvent(
      publisher,
      'b2b.quote.submitted',
      ctx.tenantId,
      ctx.userId,
      { quoteId: id, quoteNumber: quote.quoteNumber, accountId: quote.b2bAccountId },
      pubLogger
    );

    return ok(updated);
  });

  // ── respond (merchant sets line prices and sends to customer) ────────────

  app.post('/v1/b2b/quotes/:id/respond', async (request) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    const body = RespondBody.parse(request.body);

    const quote = await withTenant(ctx, (tx) =>
      tx.quote.findFirst({
        where: { id, tenantId: ctx.tenantId },
        include: { items: true, b2bAccount: { select: { id: true, companyName: true } } },
      })
    );
    if (!quote) throw notFound('quote');
    assertStatus(quote.status, ['submitted', 'under_review'], 'respond');

    // Apply per-line prices in a transaction.
    const updated = await withTenant(ctx, async (tx) => {
      // Update each quoted line item price.
      for (const line of body.lineItems) {
        const item = quote.items.find((i) => i.id === line.itemId);
        if (!item) continue;
        const unitPrice = line.unitPriceCents / 100;
        const lineSubtotal = unitPrice * item.quantity;
        await tx.quoteItem.update({
          where: { id: line.itemId },
          data: {
            unitPrice,
            lineSubtotal,
            lineTotal: lineSubtotal,
          },
        });
      }

      // Recompute totals.
      const items = await tx.quoteItem.findMany({ where: { quoteId: id } });
      const subtotal = items.reduce((s, i) => s + Number(i.lineSubtotal), 0);

      return tx.quote.update({
        where: { id },
        data: {
          status: 'quoted',
          subtotal,
          total: subtotal + Number(quote.taxTotal) + Number(quote.shippingTotal),
          internalNote: body.merchantNote ?? quote.internalNote,
          validUntil: body.expiresAt ? new Date(body.expiresAt) : quote.validUntil,
          updatedAt: new Date(),
        },
        include: {
          items: true,
          b2bAccount: { select: { id: true, companyName: true } },
        },
      });
    });

    // Notify customer via Pub/Sub → email-worker.
    await publishEvent(
      publisher,
      'b2b.quote.responded',
      ctx.tenantId,
      ctx.userId,
      { quoteId: id, quoteNumber: quote.quoteNumber, accountId: quote.b2bAccountId },
      pubLogger
    );

    return ok(updated);
  });

  // ── accept ──────────────────────────────────────────────────────────────

  app.post('/v1/b2b/quotes/:id/accept', async (request) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);

    const quote = await withTenant(ctx, (tx) =>
      tx.quote.findFirst({ where: { id, tenantId: ctx.tenantId } })
    );
    if (!quote) throw notFound('quote');
    assertStatus(quote.status, ['quoted', 'submitted'], 'accept');

    const updated = await withTenant(ctx, (tx) =>
      tx.quote.update({
        where: { id },
        data: { status: 'accepted', acceptedAt: new Date(), updatedAt: new Date() },
      })
    );
    return ok(updated);
  });

  // ── decline ─────────────────────────────────────────────────────────────

  app.post('/v1/b2b/quotes/:id/decline', async (request) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    const body = DeclineBody.parse(request.body ?? {});

    const quote = await withTenant(ctx, (tx) =>
      tx.quote.findFirst({ where: { id, tenantId: ctx.tenantId } })
    );
    if (!quote) throw notFound('quote');
    assertStatus(quote.status, ['quoted', 'submitted', 'under_review'], 'decline');

    const updated = await withTenant(ctx, (tx) =>
      tx.quote.update({
        where: { id },
        data: {
          status: 'declined',
          declinedAt: new Date(),
          declinedReason: body.reason,
          updatedAt: new Date(),
        },
      })
    );
    return ok(updated);
  });

  // ── PDF (printable HTML with print-media styles) ─────────────────────────

  app.get('/v1/b2b/quotes/:id/pdf', async (request, reply) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);

    const quote = await withTenant(ctx, (tx) =>
      tx.quote.findFirst({
        where: { id, tenantId: ctx.tenantId },
        include: {
          items: true,
          b2bAccount: { select: { id: true, companyName: true } },
        },
      })
    );
    if (!quote) throw notFound('quote');

    const html = quoteHtml({
      quoteNumber: quote.quoteNumber,
      companyName: quote.b2bAccount?.companyName ?? 'Unknown',
      status: quote.status,
      validUntil: quote.validUntil,
      customerNote: quote.customerNote,
      internalNote: null,
      createdAt: quote.createdAt,
      items: quote.items.map((i) => ({
        name: i.name,
        sku: i.sku,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        lineTotal: i.lineTotal,
      })),
      subtotal: quote.subtotal,
      taxTotal: quote.taxTotal,
      total: quote.total,
    });

    void reply.header('Content-Type', 'text/html; charset=utf-8');
    void reply.header('Content-Disposition', `inline; filename="quote-${quote.quoteNumber}.html"`);
    return reply.send(html);
  });

  return Promise.resolve();
};

export default b2bQuoteRoutes;
