// B2B invoices — net-terms credit management (docs/10 §9, docs/64 Ph3).
//
// Invoices are auto-created by the order placement handler when the B2B
// account has payment_terms set (e.g. 'net30'). They can also be created
// manually for service work billed outside an order flow.
//
// Status flow: unpaid → paid | overdue → paid | written_off
// Overdue escalation is handled by the b2b-overdue-worker Cloud Run cron.
// Credit-hold and suspended account status changes are published here so
// consumers (email-worker, CRM activity feed) react without polling.
//
//   GET    /v1/b2b/invoices                    → list (filtered by account/status)
//   POST   /v1/b2b/invoices                    → create manually
//   GET    /v1/b2b/invoices/:id                → fetch one
//   PATCH  /v1/b2b/invoices/:id                → update notes / due date (unpaid only)
//   POST   /v1/b2b/invoices/:id/mark-paid      → record payment, sync credit_used
//   POST   /v1/b2b/invoices/:id/write-off      → cancel invoice, sync credit_used

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@sparx/db';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { notFound, badRequest, forbidden } from '@sparx/api-core/errors';
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
  status: z.enum(['unpaid', 'overdue', 'paid', 'written_off']).optional(),
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

const MarkPaidBody = z.object({
  paidMethod: z.enum(['check', 'ach', 'wire', 'credit_card', 'other']),
  notes: z.string().max(2000).optional(),
});

const WriteOffBody = z.object({
  notes: z.string().max(2000).optional(),
});

const b2bInvoiceRoutes: FastifyPluginAsync = async (app) => {
  // ── List ─────────────────────────────────────────────────────────────────
  app.get('/v1/b2b/invoices', async (request, reply) => {
    await requireB2bModule(request);
    await requireRole(request, 'viewer');
    const ctx = toB2bContext(request);
    const q = ListQuery.parse(request.query);

    const invoiceWhere = {
      tenantId: ctx.tenantId,
      ...(q.account_id ? { accountId: q.account_id } : {}),
      ...(q.status ? { status: q.status } : {}),
    };

    const { items, total } = await withTenant(ctx, async (tx) => {
      const [items, total] = await Promise.all([
        tx.b2bInvoice.findMany({
          where: invoiceWhere,
          include: {
            account: { select: { id: true, companyName: true } },
            paidBy: { select: { id: true, name: true } },
          },
          orderBy: { dueAt: 'asc' },
          take: q.take,
          skip: q.skip,
        }),
        tx.b2bInvoice.count({ where: invoiceWhere }),
      ]);
      return { items, total };
    });

    return reply.send(paged(items, { total, skip: q.skip, take: q.take }));
  });

  // ── Create ────────────────────────────────────────────────────────────────
  app.post('/v1/b2b/invoices', async (request, reply) => {
    await requireB2bModule(request);
    await requireRole(request, 'editor');
    const ctx = toB2bContext(request);
    const body = CreateBody.parse(request.body);

    const invoice = await withTenant(ctx, async (tx) => {
      // Verify the account belongs to this tenant.
      const account = await tx.b2BAccount.findFirst({
        where: { id: body.accountId, tenantId: ctx.tenantId, deletedAt: null },
        select: { id: true, creditLimit: true, creditUsed: true },
      });
      if (!account) throw notFound('B2B account not found');

      const inv = await tx.b2bInvoice.create({
        data: {
          tenantId: ctx.tenantId,
          accountId: body.accountId,
          orderId: body.orderId,
          invoiceNumber: body.invoiceNumber,
          amountCents: body.amountCents,
          dueAt: new Date(body.dueAt),
          notes: body.notes,
        },
      });

      // Sync credit_used on the account.
      await tx.$executeRaw`SELECT sync_b2b_credit_used(${body.accountId}::uuid)`;

      return inv;
    });

    await publishEvent(
      publisher,
      'b2b.invoice.created',
      ctx.tenantId,
      ctx.userId,
      {
        invoiceId: invoice.id,
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
    await requireRole(request, 'viewer');
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);

    const invoice = await withTenant(ctx, (tx) =>
      tx.b2bInvoice.findFirst({
        where: { id, tenantId: ctx.tenantId },
        include: {
          account: { select: { id: true, companyName: true, paymentTerms: true } },
          paidBy: { select: { id: true, name: true, email: true } },
        },
      })
    );

    if (!invoice) throw notFound('Invoice not found');
    return reply.send(ok(invoice));
  });

  // ── Update (notes/due date, unpaid only) ──────────────────────────────────
  app.patch('/v1/b2b/invoices/:id', async (request, reply) => {
    await requireB2bModule(request);
    await requireRole(request, 'editor');
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    const body = UpdateBody.parse(request.body);

    const updated = await withTenant(ctx, async (tx) => {
      const existing = await tx.b2bInvoice.findFirst({
        where: { id, tenantId: ctx.tenantId },
        select: { id: true, status: true },
      });
      if (!existing) throw notFound('Invoice not found');
      if (existing.status === 'paid' || existing.status === 'written_off') {
        throw badRequest(`Cannot edit a ${existing.status} invoice`);
      }

      return tx.b2bInvoice.update({
        where: { id },
        data: {
          ...(body.dueAt !== undefined ? { dueAt: new Date(body.dueAt) } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
        },
      });
    });

    return reply.send(ok(updated));
  });

  // ── Mark paid ─────────────────────────────────────────────────────────────
  app.post('/v1/b2b/invoices/:id/mark-paid', async (request, reply) => {
    await requireB2bModule(request);
    await requireRole(request, 'editor');
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    const body = MarkPaidBody.parse(request.body);

    const invoice = await withTenant(ctx, async (tx) => {
      const existing = await tx.b2bInvoice.findFirst({
        where: { id, tenantId: ctx.tenantId },
        select: { id: true, status: true, accountId: true, amountCents: true },
      });
      if (!existing) throw notFound('Invoice not found');
      if (existing.status === 'paid') throw badRequest('Invoice is already paid');
      if (existing.status === 'written_off') throw badRequest('Cannot pay a written-off invoice');

      const paid = await tx.b2bInvoice.update({
        where: { id },
        data: {
          status: 'paid',
          paidAt: new Date(),
          paidByUserId: ctx.userId,
          paidMethod: body.paidMethod,
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
        },
      });

      // Recompute credit_used after payment.
      await tx.$executeRaw`SELECT sync_b2b_credit_used(${existing.accountId}::uuid)`;

      // Lift credit_hold if all invoices are now paid.
      const unpaidCount = await tx.b2bInvoice.count({
        where: {
          accountId: existing.accountId,
          tenantId: ctx.tenantId,
          status: { in: ['unpaid', 'overdue'] },
        },
      });
      if (unpaidCount === 0) {
        await tx.b2BAccount.updateMany({
          where: {
            id: existing.accountId,
            tenantId: ctx.tenantId,
            status: 'credit_hold',
          },
          data: { status: 'active' },
        });
      }

      return paid;
    });

    return reply.send(ok(invoice));
  });

  // ── Write off ─────────────────────────────────────────────────────────────
  app.post('/v1/b2b/invoices/:id/write-off', async (request, reply) => {
    await requireB2bModule(request);
    await requireRole(request, 'admin');
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    const body = WriteOffBody.parse(request.body);

    const invoice = await withTenant(ctx, async (tx) => {
      const existing = await tx.b2bInvoice.findFirst({
        where: { id, tenantId: ctx.tenantId },
        select: { id: true, status: true, accountId: true },
      });
      if (!existing) throw notFound('Invoice not found');
      if (existing.status === 'paid') throw badRequest('Cannot write off a paid invoice');
      if (existing.status === 'written_off') throw badRequest('Invoice is already written off');

      const written = await tx.b2bInvoice.update({
        where: { id },
        data: {
          status: 'written_off',
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
        },
      });

      await tx.$executeRaw`SELECT sync_b2b_credit_used(${existing.accountId}::uuid)`;

      return written;
    });

    return reply.send(ok(invoice));
  });
};

export default b2bInvoiceRoutes;
