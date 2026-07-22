// Built-in entity resolvers + scanners (docs/81 §5.3).
//
// The initial resolver catalog: customer / deal / order hydrators for the common
// event triggers, and a customer scanner for scheduled (predicate) triggers. The
// field set is the documented contract the AI assistant offers and conditions
// reference — adding a field here is additive. Module-specific resolvers
// (b2b account, quote, …) register through the same `registerResolver` seam as
// their owning module wires the engine.

import type { ResolvedFields, TenantCtx } from '../engine-types';
import { PROPERTY_FIELD, registerResolver, registerScanner, type ScannedRow } from './registry';

const MS_PER_DAY = 86_400_000;

/** Prisma Decimal | number | null → number | null. */
function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Whole days between `then` and now (null-safe). */
function daysSince(then: Date | null | undefined, now: Date): number | null {
  if (!then) return null;
  return Math.floor((now.getTime() - then.getTime()) / MS_PER_DAY);
}

function str(v: unknown): string {
  if (typeof v === 'string') return v;
  throw new Error(`expected string id on trigger payload, got ${typeof v}`);
}

// ─── customer ──────────────────────────────────────────────────────────────

interface CustomerLike {
  id: string;
  type: string;
  email: string | null;
  company: string | null;
  doNotContact: boolean;
  tags: string[];
  totalSpent: unknown;
  orderCount: number;
  firstOrderAt: Date | null;
  lastOrderAt: Date | null;
  createdAt: Date;
  propertyId: string | null;
}

function customerFields(c: CustomerLike, now: Date): ResolvedFields {
  return {
    // WHICH BUSINESS this record belongs to (docs/131 §3.1) — the engine filters
    // site-scoped automations on it. Reserved key, not part of the condition
    // vocabulary. Null for a tenant-level CRM contact tied to no site.
    [PROPERTY_FIELD]: c.propertyId,
    'customer.id': c.id,
    'customer.type': c.type,
    'customer.email': c.email,
    'customer.company': c.company,
    'customer.doNotContact': c.doNotContact,
    'customer.tags': c.tags,
    'customer.totalSpent': num(c.totalSpent),
    'customer.orderCount': c.orderCount,
    'customer.hasOrdered': c.orderCount > 0,
    'customer.lastOrderAt': c.lastOrderAt,
    'customer.daysSinceLastOrder': daysSince(c.lastOrderAt, now),
    'customer.daysSinceCreated': daysSince(c.createdAt, now),
  };
}

const CUSTOMER_SELECT = {
  id: true,
  type: true,
  email: true,
  company: true,
  doNotContact: true,
  tags: true,
  totalSpent: true,
  orderCount: true,
  firstOrderAt: true,
  lastOrderAt: true,
  createdAt: true,
  propertyId: true,
} as const;

async function hydrateCustomer(ctx: TenantCtx, customerId: string): Promise<ResolvedFields> {
  const c = await ctx.tx.customer.findUnique({
    where: { id: customerId },
    select: CUSTOMER_SELECT,
  });
  if (!c) return {};
  return customerFields(c, new Date());
}

// ─── deal ────────────────────────────────────────────────────────────────────

async function hydrateDeal(ctx: TenantCtx, dealId: string): Promise<ResolvedFields> {
  const d = await ctx.tx.deal.findUnique({
    where: { id: dealId },
    select: {
      id: true,
      title: true,
      value: true,
      currency: true,
      probability: true,
      stageId: true,
      pipelineId: true,
      assignedRepId: true,
      closedAt: true,
      closedReason: true,
      expectedCloseDate: true,
      tags: true,
      customerId: true,
      // stageType (open | won | lost) drives the won/open conditions on the
      // new-lead-task + deal-closed-won-task seeds (the stage id alone can't).
      stage: { select: { stageType: true } },
    },
  });
  if (!d) return {};
  const fields: ResolvedFields = {
    'deal.id': d.id,
    'deal.title': d.title,
    // Alias for templated copy (`{{deal.name}}`); `deal.title` stays for conditions.
    'deal.name': d.title,
    'deal.value': num(d.value),
    'deal.currency': d.currency,
    'deal.probability': num(d.probability),
    'deal.stageId': d.stageId,
    'deal.stageType': d.stage.stageType,
    'deal.pipelineId': d.pipelineId,
    'deal.assignedRepId': d.assignedRepId,
    'deal.isClosed': d.closedAt !== null,
    'deal.closedReason': d.closedReason,
    'deal.expectedCloseDate': d.expectedCloseDate,
    'deal.tags': d.tags,
  };
  if (d.customerId) {
    Object.assign(fields, await hydrateCustomer(ctx, d.customerId));
  }
  return fields;
}

// ─── order ───────────────────────────────────────────────────────────────────

async function hydrateOrder(ctx: TenantCtx, orderId: string): Promise<ResolvedFields> {
  const o = await ctx.tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      channel: true,
      total: true,
      subtotal: true,
      refundTotal: true,
      currency: true,
      placedAt: true,
      customerId: true,
      propertyId: true,
    },
  });
  if (!o) return {};
  const fields: ResolvedFields = {
    'order.id': o.id,
    'order.number': o.orderNumber,
    'order.status': o.status,
    'order.paymentStatus': o.paymentStatus,
    'order.channel': o.channel,
    'order.total': num(o.total),
    'order.subtotal': num(o.subtotal),
    'order.refundTotal': num(o.refundTotal),
    'order.currency': o.currency,
    'order.placedAt': o.placedAt,
  };
  Object.assign(fields, await hydrateCustomer(ctx, o.customerId));
  // AFTER the customer merge, deliberately. hydrateCustomer sets PROPERTY_FIELD
  // too, and Object.assign would otherwise let the customer's site overwrite the
  // order's — which is wrong in both directions: a customer created before the
  // order (or a tenant-level contact) can carry a different site or none at all,
  // while the ORDER is the thing that actually happened on a storefront. The
  // order's own site is authoritative, so it is written last.
  fields[PROPERTY_FIELD] = o.propertyId;
  return fields;
}

// ─── registration ────────────────────────────────────────────────────────────

const CUSTOMER_EVENTS = [
  'crm.customer.created',
  'crm.customer.updated',
  'crm.customer.subscribed',
  'crm.segment.entered',
];
const DEAL_EVENTS = ['crm.deal.created', 'crm.deal.updated', 'crm.deal.stage_changed'];
const ORDER_EVENTS = [
  'order.placed',
  'order.paid',
  // The failure side of payment, not just the success side: without it the
  // payment-failed notification seed renders "Payment failed on order " with
  // `{{order.number}}` resolved to nothing — the one detail that makes the
  // notification actionable.
  'order.payment_failed',
  'payment.captured',
  'order.fulfilled',
  'order.delivered',
  'order.cancelled',
  'order.refunded',
];

let installed = false;

/**
 * Register the built-in resolvers + scanners exactly once. Idempotent so it is
 * safe to call from every engine entry point (worker boot, api-rest boot, tests)
 * without double-registration.
 */
export function installBuiltinResolvers(): void {
  if (installed) return;
  installed = true;

  for (const ev of CUSTOMER_EVENTS) {
    registerResolver(ev, (ctx, p) => hydrateCustomer(ctx, str(p.customerId)));
  }
  for (const ev of DEAL_EVENTS) {
    registerResolver(ev, (ctx, p) => hydrateDeal(ctx, str(p.dealId ?? p.id)));
  }
  for (const ev of ORDER_EVENTS) {
    registerResolver(ev, (ctx, p) => hydrateOrder(ctx, str(p.orderId ?? p.id)));
  }

  // Scheduled (predicate) trigger over customers — the substrate for the
  // inactivity / win-back / high-value sweeps (docs/81 §5.2). Loads the active
  // customer set (cap + soft-delete filter pushed to SQL); the predicate's
  // `where` + the automation's conditions filter it in-app via the evaluator.
  registerScanner('customer', async (ctx: TenantCtx): Promise<ScannedRow[]> => {
    const now = new Date();
    const rows = await ctx.tx.customer.findMany({
      where: { deletedAt: null },
      select: CUSTOMER_SELECT,
      orderBy: { updatedAt: 'desc' },
      take: 5_000,
    });
    return rows.map((c) => ({ id: c.id, fields: customerFields(c as CustomerLike, now) }));
  });
}
