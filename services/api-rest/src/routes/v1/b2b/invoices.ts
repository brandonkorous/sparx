// B2B invoices — net-terms accounts-receivable (docs/10 §9, docs/87 §15).
//
// As of Phase 8 these routes are backed by `billing_documents` (the one billing
// engine), NOT the legacy `b2b_invoices` table — a B2B receivable is a
// BillingDocument on the system `net-terms-ar` workflow. The route shape is
// preserved (a thin "invoice" projection of the document) so the dashboard and
// customer portal keep working; the status vocabulary is now billing-native:
//   unpaid | partial | paid | overdue | void
// ("void" replaces the old "written_off").
//
// Invoices are auto-created by checkout / approval when a B2B account orders on
// net terms; they can also be created manually for work billed outside an order.
// Credit utilisation (`credit_used`) re-syncs automatically through the billing
// money authority (recomputeTotals → sync_b2b_credit_used) on every mutation.
//
//   GET    /v1/b2b/invoices                    → list (filtered by account/status)
//   POST   /v1/b2b/invoices                    → create manually
//   GET    /v1/b2b/invoices/:id                → fetch one
//   PATCH  /v1/b2b/invoices/:id                → update notes / due date (open only)
//   POST   /v1/b2b/invoices/:id/mark-paid      → record full payment, lift hold
//   POST   /v1/b2b/invoices/:id/write-off      → void the receivable

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant, type Prisma } from '@sparx/db';
import { b2bArService, billingPaymentService } from '@sparx/crm';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { notFound, badRequest } from '@sparx/api-core/errors';
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

const PathId = z.object({ id: z.string().uuid() });

const ListQuery = z.object({
  account_id: z.string().uuid().optional(),
  status: z.enum(['unpaid', 'partial', 'paid', 'overdue', 'void']).optional(),
  take: z.coerce.number().int().min(1).max(250).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const CreateBody = z.object({
  accountId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  invoiceNumber: z.string().min(1).max(63),
  amountCents: z.number().int().min(1),
  dueAt: z.string().datetime(),
  notes: z.string().max(2000).optional(),
});

const UpdateBody = z.object({
  dueAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

// Map the legacy paid-method vocabulary to the billing payment-method enum.
const MarkPaidBody = z.object({
  paidMethod: z.enum(['check', 'ach', 'wire', 'credit_card', 'other']),
  notes: z.string().max(2000).optional(),
});

const WriteOffBody = z.object({
  notes: z.string().max(2000).optional(),
});

const PAID_METHOD_MAP: Record<string, string> = {
  check: 'check',
  ach: 'ach',
  wire: 'wire',
  credit_card: 'card',
  other: 'other',
};

// The shape `/v1/b2b/invoices` returns — a B2B-AR projection of a billing
// document, preserving the historical field names the dashboard + portal read.
const INVOICE_INCLUDE = {
  b2bAccount: { select: { id: true, companyName: true, paymentTerms: true } },
  payments: {
    orderBy: { receivedAt: 'desc' },
    include: { recordedBy: { select: { id: true, name: true, email: true } } },
  },
} satisfies Prisma.BillingDocumentInclude;

type InvoiceDoc = Prisma.BillingDocumentGetPayload<{ include: typeof INVOICE_INCLUDE }>;

function cents(d: Prisma.Decimal | number): number {
  return Math.round(Number(d) * 100);
}

function mapInvoice(doc: InvoiceDoc) {
  const meta = (doc.metadata ?? {}) as Record<string, unknown>;
  // Most recent real payment drives the displayed method + "recorded by".
  const lastPayment = doc.payments.find((p) => p.kind !== 'refund') ?? doc.payments[0] ?? null;
  return {
    id: doc.id,
    accountId: doc.b2bAccountId,
    orderId: typeof meta.orderId === 'string' ? meta.orderId : null,
    invoiceNumber: doc.number ?? '',
    amountCents: cents(doc.total),
    balanceCents: cents(doc.balance),
    status: doc.status,
    overdueDays: doc.overdueDays,
    dueAt: doc.dueAt ? doc.dueAt.toISOString() : null,
    paidAt: doc.paidAt ? doc.paidAt.toISOString() : null,
    paidMethod: doc.status === 'paid' ? (lastPayment?.method ?? null) : null,
    notes: doc.notes,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    account: doc.b2bAccount
      ? {
          id: doc.b2bAccount.id,
          companyName: doc.b2bAccount.companyName,
          paymentTerms: doc.b2bAccount.paymentTerms,
        }
      : null,
    paidBy: lastPayment?.recordedBy
      ? {
          id: lastPayment.recordedBy.id,
          name: lastPayment.recordedBy.name,
          email: lastPayment.recordedBy.email,
        }
      : null,
  };
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const b2bInvoiceRoutes: FastifyPluginAsync = async (app) => {
  // ── List ─────────────────────────────────────────────────────────────────
  app.get('/v1/b2b/invoices', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'viewer');
    const ctx = toB2bContext(request);
    const q = ListQuery.parse(request.query);

    const where: Prisma.BillingDocumentWhereInput = {
      b2bAccountId: q.account_id ?? { not: null },
      deletedAt: null,
      ...(q.status ? { status: q.status } : {}),
    };

    const { items, total } = await withTenant(ctx, async (tx) => {
      const [items, total] = await Promise.all([
        tx.billingDocument.findMany({
          where,
          include: INVOICE_INCLUDE,
          orderBy: { dueAt: 'asc' },
          take: q.take,
          skip: q.skip,
        }),
        tx.billingDocument.count({ where }),
      ]);
      return { items, total };
    });

    return reply.send(paged(items.map(mapInvoice), { total, skip: q.skip, take: q.take }));
  });

  // ── Create (manual) ────────────────────────────────────────────────────────
  app.post('/v1/b2b/invoices', async (request, reply) => {
    await requireB2bModule(request);
    const auth = requireRole(request, 'editor');
    const ctx = toB2bContext(request);
    const body = CreateBody.parse(request.body);

    // A manual invoice is issued by the site the operator is working in
    // (docs/131 §3.6) — that decides whose numbering sequence it draws from and
    // whose letterhead freezes onto it at finalize.
    const propertyId = await resolvePropertyId(
      auth,
      request.headers['x-sparx-property-id'] as string | undefined
    );

    const doc = await b2bArService.createOrderArDocument(ctx, {
      b2bAccountId: body.accountId,
      propertyId,
      orderId: body.orderId ?? null,
      amount: body.amountCents / 100,
      dueAt: new Date(body.dueAt),
      numberOverride: body.invoiceNumber,
      notes: body.notes ?? null,
      description: 'Invoice',
    });
    const invoice = await loadInvoice(ctx, doc.id);

    await publishEvent(
      publisher,
      'b2b.invoice.created',
      ctx.tenantId,
      ctx.userId,
      {
        invoiceId: doc.id,
        accountId: body.accountId,
        amountCents: body.amountCents,
        dueAt: body.dueAt,
      },
      pubLogger
    );

    return reply.status(201).send(ok(invoice));
  });

  // ── Fetch one ─────────────────────────────────────────────────────────────
  app.get('/v1/b2b/invoices/:id', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'viewer');
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);

    const invoice = await loadInvoice(ctx, id);
    if (!invoice) throw notFound('Invoice not found');
    return reply.send(ok(invoice));
  });

  // ── Update (notes / due date, open only) ───────────────────────────────────
  app.patch('/v1/b2b/invoices/:id', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'editor');
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    const body = UpdateBody.parse(request.body);

    await b2bArService.updateArDocument(ctx, id, {
      ...(body.dueAt !== undefined ? { dueAt: new Date(body.dueAt) } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    });

    const invoice = await loadInvoice(ctx, id);
    return reply.send(ok(invoice));
  });

  // ── Mark paid ─────────────────────────────────────────────────────────────
  app.post('/v1/b2b/invoices/:id/mark-paid', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'editor');
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    const body = MarkPaidBody.parse(request.body);

    // Snapshot the open balance, then record a single payment that clears it.
    const before = await withTenant(ctx, (tx) =>
      tx.billingDocument.findFirst({
        where: { id, b2bAccountId: { not: null }, deletedAt: null },
        select: { id: true, status: true, balance: true, b2bAccountId: true, notes: true },
      })
    );
    if (!before) throw notFound('Invoice not found');
    if (before.status === 'paid') throw badRequest('Invoice is already paid');
    if (before.status === 'void') throw badRequest('Cannot pay a voided invoice');

    const balance = Number(before.balance);
    if (balance > 0) {
      await billingPaymentService.recordPayment(ctx, id, {
        kind: 'payment',
        method: PAID_METHOD_MAP[body.paidMethod] ?? 'other',
        amount: balance,
        ...(body.notes !== undefined ? { note: body.notes } : {}),
      });
    }

    // Lift credit_hold if the account now has no open receivables.
    const liftAccountId = before.b2bAccountId;
    if (liftAccountId) {
      await withTenant(ctx, async (tx) => {
        const open = await tx.billingDocument.count({
          where: {
            b2bAccountId: liftAccountId,
            deletedAt: null,
            status: { in: ['unpaid', 'partial', 'overdue'] },
          },
        });
        if (open === 0) {
          await tx.b2BAccount.updateMany({
            where: { id: liftAccountId, status: 'credit_hold' },
            data: { status: 'active' },
          });
        }
      });
    }

    const invoice = await loadInvoice(ctx, id);
    return reply.send(ok(invoice));
  });

  // ── Write off (void the receivable) ────────────────────────────────────────
  app.post('/v1/b2b/invoices/:id/write-off', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'admin');
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    const body = WriteOffBody.parse(request.body);

    const before = await withTenant(ctx, (tx) =>
      tx.billingDocument.findFirst({
        where: { id, b2bAccountId: { not: null }, deletedAt: null },
        select: { id: true, status: true },
      })
    );
    if (!before) throw notFound('Invoice not found');
    if (before.status === 'paid') throw badRequest('Cannot write off a paid invoice');
    if (before.status === 'void') throw badRequest('Invoice is already written off');

    await b2bArService.voidArDocument(
      ctx,
      id,
      body.notes !== undefined ? { note: body.notes } : {}
    );

    const invoice = await loadInvoice(ctx, id);
    return reply.send(ok(invoice));
  });

  // Load + project one invoice, scoped to B2B-AR documents.
  async function loadInvoice(
    ctx: ReturnType<typeof toB2bContext>,
    id: string
  ): Promise<ReturnType<typeof mapInvoice> | null> {
    const doc = await withTenant(ctx, (tx) =>
      tx.billingDocument.findFirst({
        where: { id, b2bAccountId: { not: null }, deletedAt: null },
        include: INVOICE_INCLUDE,
      })
    );
    return doc ? mapInvoice(doc) : null;
  }
};

export default b2bInvoiceRoutes;
