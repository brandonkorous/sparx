// B2B purchase approval — rule configuration + the approval queue (docs/10 §12,
// docs/64 B2B Ph6). Extracted from the api-rest routes.
//
// Approval rules gate B2B portal orders above a configured threshold: an order
// that trips a rule at checkout parks in `pending_approval`; staff approve (→ the
// order places, stock commits, a net-terms AR document is issued) or reject (→ the
// order cancels). The mutating transitions COMMIT then ask their caller to publish
// the resulting domain events — the service stays free of publisher plumbing so it
// runs identically under REST (`request.log` publisher) and MCP (a createPublisher
// from @wizeworks/events, matching the other api-mcp tool registries).

import { z } from 'zod';
import { withTenant, type Prisma } from '@wizeworks/db';
import { notFound } from '@wizeworks/api-core/errors';
import { isModuleEnabled } from '@wizeworks/auth';
import { b2bArService } from '@wizeworks/crm';
import { inventoryService, type CommittedSale } from '@wizeworks/inventory';
import type { B2bContext } from './context.js';
import type { PendingEvent } from './events.js';

// ── Schemas (shared with the REST routes) ─────────────────────────────────────

export const ApprovalRuleBody = z.object({
  accountId: z.string().uuid().nullable().optional(),
  // The site this spending control applies to (docs/131 §4). Explicit null = it
  // applies everywhere the tenant sells; omitted = the caller's default site.
  propertyId: z.string().uuid().nullable().optional(),
  minAmountCents: z.number().int().min(0),
  requiredApproverUserId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const ApprovalRulePatchBody = z.object({
  minAmountCents: z.number().int().min(0).optional(),
  requiredApproverUserId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const ApprovalQueueQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  account_id: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(250).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

export const ApproveBody = z.object({ reason: z.string().max(1000).optional() });
export const RejectBody = z.object({ reason: z.string().max(1000).optional() });

export type ApprovalRuleInput = z.infer<typeof ApprovalRuleBody>;
export type ApprovalRulePatchInput = z.infer<typeof ApprovalRulePatchBody>;
export type ApprovalQueueInput = z.infer<typeof ApprovalQueueQuery>;

// ── View mappers ──────────────────────────────────────────────────────────────

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
    // null renders as "All sites" — an operator must see at a glance that a
    // threshold reaches businesses other than the one they're looking at.
    propertyId: rule.propertyId,
    minAmountCents: rule.minAmountCents,
    minAmountFormatted: `$${(rule.minAmountCents / 100).toFixed(2)}`,
    requiredApproverUserId: rule.requiredApproverUserId,
    requiredApproverName: rule.requiredApprover?.name ?? rule.requiredApprover?.email ?? null,
    isActive: rule.isActive,
    createdAt: rule.createdAt.toISOString(),
  };
}

export type ApprovalRuleView = ReturnType<typeof toRuleView>;

const RULE_INCLUDE = {
  account: { select: { id: true, companyName: true } },
  requiredApprover: { select: { id: true, name: true, email: true } },
} as const;

// ── Rules ──────────────────────────────────────────────────────────────────────

export async function listRules(ctx: B2bContext): Promise<{ rules: ApprovalRuleView[] }> {
  const rules = await withTenant(ctx, (tx) =>
    tx.purchaseApprovalRule.findMany({
      where: { tenantId: ctx.tenantId },
      include: RULE_INCLUDE,
      orderBy: [{ accountId: 'asc' }, { createdAt: 'desc' }],
    })
  );
  return { rules: rules.map(toRuleView) };
}

/**
 * Create a spending-approval rule. `defaultPropertyId` is the caller's active
 * site — used when the body omits `propertyId` entirely; an EXPLICIT null makes
 * the rule apply everywhere. Defaulting the other way would silently gate
 * checkout on businesses the author wasn't thinking about (docs/131 §4).
 */
export async function createRule(
  ctx: B2bContext,
  rawInput: unknown,
  defaultPropertyId: string
): Promise<ApprovalRuleView> {
  const body = ApprovalRuleBody.parse(rawInput);

  const rule = await withTenant(ctx, async (tx) => {
    if (body.accountId) {
      const account = await tx.company.findFirst({
        where: { id: body.accountId, tenantId: ctx.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!account) throw notFound('B2B account not found');
    }

    return tx.purchaseApprovalRule.create({
      data: {
        tenantId: ctx.tenantId,
        accountId: body.accountId ?? null,
        propertyId: body.propertyId === undefined ? defaultPropertyId : body.propertyId,
        minAmountCents: body.minAmountCents,
        requiredApproverUserId: body.requiredApproverUserId ?? null,
        isActive: body.isActive ?? true,
      },
      include: RULE_INCLUDE,
    });
  });

  return toRuleView(rule);
}

export async function updateRule(
  ctx: B2bContext,
  id: string,
  rawInput: unknown
): Promise<ApprovalRuleView> {
  const body = ApprovalRulePatchBody.parse(rawInput);

  const rule = await withTenant(ctx, async (tx) => {
    const existing = await tx.purchaseApprovalRule.findFirst({
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
      include: RULE_INCLUDE,
    });
  });

  return toRuleView(rule);
}

/** Deactivate a rule (soft — `isActive=false`, preserving its audit history). */
export async function deleteRule(ctx: B2bContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const existing = await tx.purchaseApprovalRule.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!existing) throw notFound('Approval rule not found');
    await tx.purchaseApprovalRule.update({ where: { id }, data: { isActive: false } });
  });
}

// ── Approval queue ───────────────────────────────────────────────────────────

export async function listQueue(ctx: B2bContext, input: ApprovalQueueInput) {
  // `status: 'pending_approval'` is set only by the checkout approval gate, which
  // only fires for an active B2B account. B2B orders place through the same
  // storefront checkout (channel='storefront'), so no channel filter is applied.
  const where: Prisma.OrderWhereInput = {
    tenantId: ctx.tenantId,
    status: 'pending_approval',
    ...(input.account_id ? { customer: { companyId: input.account_id } } : {}),
    ...(input.q
      ? {
          OR: [
            { orderNumber: { contains: input.q, mode: 'insensitive' } },
            { customer: { firstName: { contains: input.q, mode: 'insensitive' } } },
            { customer: { lastName: { contains: input.q, mode: 'insensitive' } } },
            { customer: { email: { contains: input.q, mode: 'insensitive' } } },
            {
              customer: { company: { companyName: { contains: input.q, mode: 'insensitive' } } },
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
              companyId: true,
              company: { select: { id: true, companyName: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: input.take,
        skip: input.skip,
      }),
      tx.order.count({ where }),
    ]);
    return { orders, total };
  });

  type OrderRow = (typeof orders)[number];

  return {
    items: orders.map((o: OrderRow) => ({
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
      companyId: o.customer.companyId,
      companyName: o.customer.company?.companyName ?? null,
    })),
    total,
    skip: input.skip,
    take: input.take,
  };
}

export interface ApproveResult {
  order: { id: string; orderNumber: string; status: string };
  events: PendingEvent[];
  committedSales: CommittedSale[];
}

/**
 * Approve a pending B2B order: place it, commit stock (deferred at checkout while
 * held), audit-note it, and — if it was a net-terms order — issue the AR document
 * that was deferred pending approval. Returns the domain events to publish and the
 * committed sales to emit inventory threshold events for, both AFTER the caller
 * observes the returned transaction has committed.
 */
export async function approveOrder(
  ctx: B2bContext,
  orderId: string,
  rawInput: unknown
): Promise<ApproveResult> {
  const body = ApproveBody.parse(rawInput);
  const inventoryActive = await isModuleEnabled(ctx.tenantId, 'inventory');

  const result = await withTenant(ctx, async (tx) => {
    const existing = await tx.order.findFirst({
      where: { id: orderId, tenantId: ctx.tenantId, status: 'pending_approval' },
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        propertyId: true,
        total: true,
        currency: true,
        metadata: true,
        customer: {
          select: { companyId: true, company: { select: { paymentTerms: true } } },
        },
      },
    });
    if (!existing) throw notFound('Pending order not found');

    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: 'placed' },
      select: { id: true, orderNumber: true, status: true },
    });

    // Decrement stock now the order is actually placed — checkout deferred the
    // commit while it was held (docs/100 §7.4). Idempotency keys keep a retried
    // approval safe. No-op when inventory is off.
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

    // Net-terms order → issue the AR document now (deferred at checkout). It's a
    // BillingDocument on the system `net-terms-ar` workflow (docs/87 §15), composed
    // into this tx; createOrderArDocument re-syncs credit_used.
    const meta = (existing.metadata ?? {}) as Record<string, unknown>;
    const paymentTermsRequested =
      typeof meta.paymentTermsRequested === 'string' ? meta.paymentTermsRequested : null;
    const accountId = existing.customer.companyId ?? null;
    let b2bInvoiceId: string | null = null;

    if (paymentTermsRequested && accountId) {
      const paymentTerms = existing.customer.company?.paymentTerms ?? paymentTermsRequested;
      const dueDaysMatch = /^net(\d+)$/i.exec(paymentTerms);
      const dueDays = dueDaysMatch?.[1] ? parseInt(dueDaysMatch[1], 10) : 30;
      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + dueDays);
      // The order's own site issues the invoice (docs/131 §3.6). Order.propertyId
      // is nullable (orders outlive their site), so fall back to the primary.
      const issuingPropertyId =
        existing.propertyId ??
        (
          await tx.property.findFirst({
            where: { tenantId: ctx.tenantId, isPrimary: true },
            select: { id: true },
          })
        )?.id;
      if (!issuingPropertyId) {
        throw new Error(`Cannot issue an AR document: tenant ${ctx.tenantId} has no primary site.`);
      }
      const arDoc = await b2bArService.createOrderArDocument(
        { tenantId: ctx.tenantId, userId: ctx.userId ?? undefined, tx },
        {
          companyId: accountId,
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

  const events: PendingEvent[] = [
    {
      type: 'b2b.order.approved',
      payload: {
        orderId,
        orderNumber: result.order.orderNumber,
        reason: body.reason ?? null,
      },
    },
  ];
  if (result.b2bInvoiceId) {
    events.push({
      type: 'b2b.invoice.created',
      payload: {
        invoiceId: result.b2bInvoiceId,
        accountId: result.accountId,
        orderId,
        orderNumber: result.order.orderNumber,
      },
    });
  }
  // Announce the now-placed order for inventory/fulfillment consumers.
  events.push({
    type: 'order.placed',
    payload: { orderId, orderNumber: result.order.orderNumber },
  });

  return { order: result.order, events, committedSales: result.committedSales };
}

export interface RejectResult {
  order: { id: string; orderNumber: string; status: string };
  events: PendingEvent[];
}

/** Reject a pending B2B order: cancel it + audit-note it. */
export async function rejectOrder(
  ctx: B2bContext,
  orderId: string,
  rawInput: unknown
): Promise<RejectResult> {
  const body = RejectBody.parse(rawInput);

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

  return {
    order,
    events: [
      {
        type: 'b2b.order.rejected',
        payload: { orderId, orderNumber: order.orderNumber, reason: body.reason ?? null },
      },
    ],
  };
}
