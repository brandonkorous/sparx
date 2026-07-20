// B2B purchase approval — rules configuration + approval queue.
// (docs/10 §12, docs/64 B2B Ph6)
//
// Approval rules gate B2B portal orders above a configured threshold.
// When an order triggers a rule at checkout, its status is set to
// `pending_approval`; staff must approve or reject it here.
//
//   GET    /v1/b2b/approval-rules              → list all rules
//   POST   /v1/b2b/approval-rules              → create rule
//   PATCH  /v1/b2b/approval-rules/:id          → update (threshold, approver, isActive)
//   DELETE /v1/b2b/approval-rules/:id          → deactivate
//
//   GET    /v1/b2b/approval-queue              → pending_approval orders
//   POST   /v1/b2b/approval-queue/:orderId/approve  → approve + place order
//   POST   /v1/b2b/approval-queue/:orderId/reject   → reject + cancel order

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant, type Prisma, type TxClient } from '@sparx/db';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { notFound } from '@sparx/api-core/errors';
import { createPublisher, publishEvent, type PublisherLogger } from '@sparx/events';
import { b2bArService } from '@sparx/crm';
import { isModuleEnabled } from '@sparx/auth';
import { inventoryService, type CommittedSale } from '@sparx/inventory';
import { requireB2bModule, toB2bContext } from '../../../lib/b2b-context.js';
import { resolvePropertyId } from '../../../lib/property.js';
import { env } from '../../../env.js';

// purchaseApprovalRule is a new model added by migration 20260716000000.
// The Prisma client won't include it until `prisma generate` runs against
// the migrated schema. All accesses below are cast through `any` until then.
// Remove these casts once the migration has been applied.
type AnyTx = TxClient & Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const pubLogger: PublisherLogger = {
  info: (obj, msg) => console.info(msg ?? '', obj),
  warn: (obj, msg) => console.warn(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
};
const publisher = createPublisher({ projectId: env.GCP_PROJECT_ID, logger: pubLogger });

const PathId = z.object({ id: z.string().uuid() });
const PathOrderId = z.object({ orderId: z.string().uuid() });

const RuleBody = z.object({
  accountId: z.string().uuid().nullable().optional(),
  // The site this spending control applies to (docs/131 §4). Explicit null = it
  // applies everywhere the tenant sells; omitted = the site being worked in.
  propertyId: z.string().uuid().nullable().optional(),
  minAmountCents: z.number().int().min(0),
  requiredApproverUserId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

const RulePatchBody = z.object({
  minAmountCents: z.number().int().min(0).optional(),
  requiredApproverUserId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

const ApproveBody = z.object({
  reason: z.string().max(1000).optional(),
});

const RejectBody = z.object({
  reason: z.string().max(1000).optional(),
});

const QueueQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  account_id: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(250).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

function toRuleView(rule: {
  id: string;
  accountId: string | null;
  propertyId: string | null;
  minAmountCents: number;
  requiredApproverUserId: string | null;
  isActive: boolean;
  createdAt: Date;
  account?: { id: string; companyName: string } | null;
  requiredApprover?: { id: string; name: string | null; email: string } | null;
}) {
  return {
    id: rule.id,
    accountId: rule.accountId,
    accountName: rule.account?.companyName ?? null,
    // null renders as "All sites" — an operator must be able to see at a glance
    // that a threshold reaches businesses other than the one they are looking at.
    propertyId: rule.propertyId,
    minAmountCents: rule.minAmountCents,
    minAmountFormatted: `$${(rule.minAmountCents / 100).toFixed(2)}`,
    requiredApproverUserId: rule.requiredApproverUserId,
    requiredApproverName: rule.requiredApprover?.name ?? rule.requiredApprover?.email ?? null,
    isActive: rule.isActive,
    createdAt: rule.createdAt.toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const b2bApprovalRoutes: FastifyPluginAsync = async (app) => {
  // ── List rules ────────────────────────────────────────────────────────────
  app.get('/v1/b2b/approval-rules', async (request) => {
    await requireB2bModule(request);
    requireRole(request, 'editor');
    const ctx = toB2bContext(request);

    const rules = (await withTenant(ctx, (tx) =>
      (tx as AnyTx).purchaseApprovalRule.findMany({
        where: { tenantId: ctx.tenantId },
        include: {
          account: { select: { id: true, companyName: true } },
          requiredApprover: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ accountId: 'asc' }, { createdAt: 'desc' }],
      })
    )) as Parameters<typeof toRuleView>[0][];

    return ok({ rules: rules.map(toRuleView) });
  });

  // ── Create rule ───────────────────────────────────────────────────────────
  app.post('/v1/b2b/approval-rules', async (request, reply) => {
    await requireB2bModule(request);
    const auth = requireRole(request, 'admin');
    const ctx = toB2bContext(request);
    const body = RuleBody.parse(request.body);

    const rule = await withTenant(ctx, async (tx) => {
      if (body.accountId) {
        const account = await tx.b2BAccount.findFirst({
          where: { id: body.accountId, tenantId: ctx.tenantId, deletedAt: null },
          select: { id: true },
        });
        if (!account) throw notFound('B2B account not found');
      }

      // Omitted → the site being worked in; only an EXPLICIT null makes the rule
      // apply everywhere. Defaulting the other way would silently gate checkout
      // on businesses the author was not thinking about.
      const scopeId = await resolvePropertyId(
        auth,
        request.headers['x-sparx-property-id'] as string | undefined
      );

      return tx.purchaseApprovalRule.create({
        data: {
          tenantId: ctx.tenantId,
          accountId: body.accountId ?? null,
          propertyId: body.propertyId === undefined ? scopeId : body.propertyId,
          minAmountCents: body.minAmountCents,
          requiredApproverUserId: body.requiredApproverUserId ?? null,
          isActive: body.isActive ?? true,
        },
        include: {
          account: { select: { id: true, companyName: true } },
          requiredApprover: { select: { id: true, name: true, email: true } },
        },
      });
    });

    return reply.status(201).send(ok(toRuleView(rule)));
  });

  // ── Update rule ───────────────────────────────────────────────────────────
  app.patch('/v1/b2b/approval-rules/:id', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'admin');
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    const body = RulePatchBody.parse(request.body);

    const rule = await withTenant(ctx, async (tx) => {
      const existing = await (tx as AnyTx).purchaseApprovalRule.findFirst({
        where: { id, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!existing) throw notFound('Approval rule not found');

      return tx.purchaseApprovalRule.update({
        where: { id },
        data: {
          ...(body.minAmountCents !== undefined ? { minAmountCents: body.minAmountCents } : {}),
          ...(body.requiredApproverUserId !== undefined
            ? { requiredApproverUserId: body.requiredApproverUserId }
            : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
        include: {
          account: { select: { id: true, companyName: true } },
          requiredApprover: { select: { id: true, name: true, email: true } },
        },
      });
    });

    return reply.send(ok(toRuleView(rule)));
  });

  // ── Delete (deactivate) rule ──────────────────────────────────────────────
  app.delete('/v1/b2b/approval-rules/:id', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'admin');
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);

    await withTenant(ctx, async (tx) => {
      const existing = await (tx as AnyTx).purchaseApprovalRule.findFirst({
        where: { id, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!existing) throw notFound('Approval rule not found');
      await (tx as AnyTx).purchaseApprovalRule.update({ where: { id }, data: { isActive: false } });
    });

    return reply.status(204).send();
  });

  // ── Approval queue (pending_approval orders) ──────────────────────────────
  app.get('/v1/b2b/approval-queue', async (request) => {
    await requireB2bModule(request);
    requireRole(request, 'editor');
    const ctx = toB2bContext(request);
    const q = QueueQuery.parse(request.query);

    // `status: 'pending_approval'` is set only by the checkout approval gate,
    // which only ever fires for an active B2B account (checkout-service.ts) —
    // no additional channel filter is needed. B2B orders place through the
    // same storefront checkout everyone uses (docs/10 §11) and always carry
    // channel='storefront', never 'b2b_portal' (no code path sets that value),
    // so filtering on it here silently emptied the queue for every order.
    const where: Prisma.OrderWhereInput = {
      tenantId: ctx.tenantId,
      status: 'pending_approval',
      ...(q.account_id
        ? {
            customer: { b2bAccountId: q.account_id },
          }
        : {}),
      ...(q.q
        ? {
            OR: [
              { orderNumber: { contains: q.q, mode: 'insensitive' } },
              { customer: { firstName: { contains: q.q, mode: 'insensitive' } } },
              { customer: { lastName: { contains: q.q, mode: 'insensitive' } } },
              { customer: { email: { contains: q.q, mode: 'insensitive' } } },
              {
                customer: {
                  b2bAccount: { companyName: { contains: q.q, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
    };

    const { orders, total } = await withTenant(ctx, async (tx) => {
      const [orders, total] = await Promise.all([
        tx.order.findMany({
          where,
          select: {
            id: true,
            orderNumber: true,
            total: true,
            currency: true,
            createdAt: true,
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                b2bAccountId: true,
                b2bAccount: { select: { id: true, companyName: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
          take: q.take,
          skip: q.skip,
        }),
        tx.order.count({ where }),
      ]);
      return { orders, total };
    });

    type OrderRow = (typeof orders)[number];

    return paged(
      orders.map((o: OrderRow) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        totalCents: Math.round(Number(o.total) * 100),
        currency: o.currency,
        createdAt: o.createdAt.toISOString(),
        customerId: o.customer.id,
        customerName:
          [o.customer.firstName, o.customer.lastName].filter(Boolean).join(' ') ||
          (o.customer.email ?? null),
        customerEmail: o.customer.email,
        b2bAccountId: o.customer.b2bAccountId,
        companyName: o.customer.b2bAccount?.companyName ?? null,
      })),
      { total, skip: q.skip, take: q.take }
    );
  });

  // ── Approve order ─────────────────────────────────────────────────────────
  app.post('/v1/b2b/approval-queue/:orderId/approve', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'editor');
    const ctx = toB2bContext(request);
    const { orderId } = PathOrderId.parse(request.params);
    const body = ApproveBody.parse(request.body);
    const inventoryActive = await isModuleEnabled(ctx.tenantId, 'inventory');

    const result = await withTenant(ctx, async (tx) => {
      const existing = await tx.order.findFirst({
        where: { id: orderId, tenantId: ctx.tenantId, status: 'pending_approval' },
        select: {
          id: true,
          orderNumber: true,
          customerId: true,
          // The site the order was placed on — the business that issues its
          // invoice on approval (docs/131 §3.6).
          propertyId: true,
          total: true,
          currency: true,
          metadata: true,
          customer: {
            select: {
              b2bAccountId: true,
              b2bAccount: { select: { paymentTerms: true } },
            },
          },
        },
      });
      if (!existing) throw notFound('Pending order not found');

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: 'placed' },
        select: { id: true, orderNumber: true, status: true },
      });

      // Decrement stock now that the order is actually placed — checkout deferred
      // the commit while the order was held for approval (docs/100 §7.4). Drives
      // off the order's line items (no cart hold survives to here); idempotency
      // keys keep it safe against a retried approval. No-op when inventory is off.
      let committedSales: CommittedSale[] = [];
      if (inventoryActive) {
        const orderItems = await tx.orderItem.findMany({
          where: { orderId, tenantId: ctx.tenantId },
          select: { id: true, variantId: true, quantity: true },
        });
        committedSales = await inventoryService.commitSaleOnTx(tx, ctx, {
          orderId,
          lines: orderItems.map((it) => ({
            variantId: it.variantId ?? '',
            quantity: it.quantity,
            reservationId: null,
            lineKey: it.id,
          })),
        });
      }

      // Audit trail via CRM activity.
      await tx.crmActivity.create({
        data: {
          tenantId: ctx.tenantId,
          actorId: ctx.userId ?? null,
          actorType: 'staff',
          customerId: existing.customerId,
          type: 'note',
          description: `Order #${existing.orderNumber} approved${body.reason ? ` — ${body.reason}` : ''}`,
          occurredAt: new Date(),
        },
      });

      // If this was a net-terms B2B order, create the AR document now (was
      // deferred during checkout pending approval). The receivable is a
      // BillingDocument on the system `net-terms-ar` workflow (docs/87 §15), not a
      // `b2b_invoices` row; createOrderArDocument composes into this tx and
      // re-syncs credit_used.
      const meta = (existing.metadata ?? {}) as Record<string, unknown>;
      const paymentTermsRequested =
        typeof meta.paymentTermsRequested === 'string' ? meta.paymentTermsRequested : null;
      const accountId = existing.customer.b2bAccountId ?? null;
      let b2bInvoiceId: string | null = null;

      if (paymentTermsRequested && accountId) {
        const paymentTerms = existing.customer.b2bAccount?.paymentTerms ?? paymentTermsRequested;
        const dueDaysMatch = /^net(\d+)$/i.exec(paymentTerms);
        const dueDays = dueDaysMatch?.[1] ? parseInt(dueDaysMatch[1], 10) : 30;
        const dueAt = new Date();
        dueAt.setDate(dueAt.getDate() + dueDays);
        // The order's own site issues the invoice (docs/131 §3.6) — the same
        // business the buyer placed the order with. `Order.propertyId` is
        // nullable (orders outlive their site), so fall back to the primary.
        const issuingPropertyId =
          existing.propertyId ??
          (
            await tx.property.findFirst({
              where: { tenantId: ctx.tenantId, isPrimary: true },
              select: { id: true },
            })
          )?.id;
        if (!issuingPropertyId) {
          throw new Error(
            `Cannot issue an AR document: tenant ${ctx.tenantId} has no primary site.`
          );
        }
        const arDoc = await b2bArService.createOrderArDocument(
          { tenantId: ctx.tenantId, userId: ctx.userId ?? undefined, tx },
          {
            b2bAccountId: accountId,
            propertyId: issuingPropertyId,
            orderId,
            amount: Number(existing.total),
            currency: existing.currency,
            dueAt,
            description: `Order ${existing.orderNumber}`,
          }
        );
        b2bInvoiceId = arDoc.id;
      }

      return { order: updated, b2bInvoiceId, accountId, committedSales };
    });

    // Inventory threshold events fire after the approval transaction commits.
    if (result.committedSales.length > 0) {
      await inventoryService.emitSaleEvents(ctx, result.committedSales);
    }

    await publishEvent(
      publisher,
      'b2b.order.approved',
      ctx.tenantId,
      ctx.userId ?? null,
      { orderId, orderNumber: result.order.orderNumber, reason: body.reason ?? null },
      pubLogger
    );

    if (result.b2bInvoiceId) {
      await publishEvent(
        publisher,
        'b2b.invoice.created',
        ctx.tenantId,
        ctx.userId ?? null,
        {
          invoiceId: result.b2bInvoiceId,
          accountId: result.accountId,
          orderId,
          orderNumber: result.order.orderNumber,
        },
        pubLogger
      );
    }

    // Now that the order is placed, announce it for inventory/fulfillment consumers.
    await publishEvent(
      publisher,
      'order.placed',
      ctx.tenantId,
      ctx.userId ?? null,
      { orderId, orderNumber: result.order.orderNumber },
      pubLogger
    );

    return reply.send(ok(result.order));
  });

  // ── Reject order ──────────────────────────────────────────────────────────
  app.post('/v1/b2b/approval-queue/:orderId/reject', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'editor');
    const ctx = toB2bContext(request);
    const { orderId } = PathOrderId.parse(request.params);
    const body = RejectBody.parse(request.body);

    const order = await withTenant(ctx, async (tx) => {
      const existing = await tx.order.findFirst({
        where: { id: orderId, tenantId: ctx.tenantId, status: 'pending_approval' },
        select: { id: true, orderNumber: true, customerId: true },
      });
      if (!existing) throw notFound('Pending order not found');

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: 'cancelled' },
        select: { id: true, orderNumber: true, status: true },
      });

      // Audit trail via CRM activity.
      await tx.crmActivity.create({
        data: {
          tenantId: ctx.tenantId,
          actorId: ctx.userId ?? null,
          actorType: 'staff',
          customerId: existing.customerId,
          type: 'note',
          description: `Order #${existing.orderNumber} rejected${body.reason ? ` — ${body.reason}` : ''}`,
          occurredAt: new Date(),
        },
      });

      return updated;
    });

    await publishEvent(
      publisher,
      'b2b.order.rejected',
      ctx.tenantId,
      ctx.userId ?? null,
      { orderId, orderNumber: order.orderNumber, reason: body.reason ?? null },
      pubLogger
    );

    return reply.send(ok(order));
  });
};

export default b2bApprovalRoutes;
