// subscriptionService — auto-ship / recurring orders.
//
// sparx owns ALL of it (docs/142): the schedule, the item set, the
// customer-facing pause/skip/cancel surface, the dunning state machine, and the
// charge itself. `findDueOccurrences` + `processOccurrence` are driven by the
// subscription tick (`POST /internal/commerce/subscription-tick`, every 15
// minutes); the charge goes out off-session against the customer's vaulted
// method through whichever gateway the tenant connected.
//
// A renewal ALWAYS produces an order, paid or not — the order is the record of
// what was owed, and payment is a separate fact recorded against it. That keeps
// the card path and invoice mode on one code path, and keeps a failed renewal
// visible in the orders list instead of vanishing.

import { orderService } from '@wizeworks/crm';
import {
  CancelSubscriptionInput,
  ChangeSubscriptionAddressInput,
  ChangeSubscriptionPaymentMethodInput,
  CreateSubscriptionInput,
  PauseSubscriptionInput,
  ResumeSubscriptionInput,
  SkipNextOccurrenceInput,
  type SubscriptionStatus,
  UpdateSubscriptionItemsInput,
  UpdateSubscriptionScheduleInput,
} from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import type { Prisma, Subscription, SubscriptionItem, TxClient } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { CommerceConflictError, CommerceNotFoundError, CommerceValidationError } from '../errors';
import type { ServiceContext } from '../errors';
import { publishCommerceEvent } from '../events';
import { CUSTOMER_NAME_SELECT, customerDisplayName, type CustomerNameParts } from './customer-name';

export interface SubscriptionSummary {
  id: string;
  customerId: string;
  customerName: string | null;
  status: SubscriptionStatus;
  nextOccurrenceAt: string | null;
  itemCount: number;
  monthlyRecurringRevenueCents: number;
  currency: string;
  providerSlug: string;
  /** card | invoice — how this one collects (docs/142 §8). On a list this is
   *  what separates "will charge itself" from "someone has to pay a bill". */
  billingMode: string;
}

export interface SubscriptionEventRow {
  id: string;
  event: string;
  payload: unknown;
  actorUserId: string | null;
  occurredAt: string;
}

export interface DunningAttemptRow {
  id: string;
  paymentRef: string | null;
  attemptNumber: number;
  outcome: string;
  failureReason: string | null;
  attemptedAt: string;
  nextRetryAt: string | null;
}

export interface SubscriptionDetail extends SubscriptionSummary {
  intervalUnit: string;
  intervalCount: number;
  deliveriesPerCycle: number;
  trialEndsAt: string | null;
  startedAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  pausedUntil: string | null;
  cancelledAt: string | null;
  shippingAddress: unknown;
  billingAddress: unknown;
  items: {
    id: string;
    variantId: string;
    variantSku: string | null;
    productTitle: string | null;
    quantity: number;
    unitPriceCents: number;
    addonOfId: string | null;
    addonOfName: string | null;
  }[];
  /** The lifecycle stream — created, renewed, paused, cancelled, … — newest
   *  first. What actually happened to this repeat order and when. */
  events: SubscriptionEventRow[];
  /** Failed / retried payment attempts, newest first. Empty unless a charge has
   *  ever failed; the tail of it is why a subscription is `past_due`. */
  dunningAttempts: DunningAttemptRow[];
  /** The card this renews on. Null on an invoice-mode subscription (nothing to
   *  charge, by design) and null on a card one that has none — which is the
   *  state that means it CANNOT renew, so the surface has to be able to say so
   *  rather than showing a blank. */
  paymentMethod: {
    id: string;
    brand: string | null;
    last4: string | null;
    expMonth: number | null;
    expYear: number | null;
    status: string;
  } | null;
}

// ─── Reads ───────────────────────────────────────────────────────────

export async function list(
  ctx: ServiceContext,
  filter: {
    status?: SubscriptionStatus;
    customerId?: string;
    take?: number;
    skip?: number;
  } = {}
): Promise<{ items: SubscriptionSummary[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const where: Prisma.SubscriptionWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
    };
    const [rows, total] = await Promise.all([
      tx.subscription.findMany({
        where,
        include: { items: true, customer: { select: CUSTOMER_NAME_SELECT } },
        orderBy: { createdAt: 'desc' },
        take: filter.take ?? 50,
        skip: filter.skip ?? 0,
      }),
      tx.subscription.count({ where }),
    ]);
    return { items: rows.map(toSummary), total };
  });
}

export async function get(
  ctx: ServiceContext,
  subscriptionId: string
): Promise<SubscriptionDetail> {
  const row = await withTenant(ctx, (tx) =>
    tx.subscription.findFirst({
      where: { id: subscriptionId },
      include: {
        items: { include: { variant: { include: { product: { select: { title: true } } } } } },
        customer: { select: CUSTOMER_NAME_SELECT },
        events: { orderBy: { occurredAt: 'desc' }, take: 50 },
        dunningAttempts: { orderBy: { attemptedAt: 'desc' }, take: 20 },
        paymentMethod: true,
      },
    })
  );
  if (!row) throw new CommerceNotFoundError('Subscription', subscriptionId);
  // Resolve `addonOfId` → the parent line's product name so add-ons read as
  // "rides along with <product>" instead of a raw item id.
  const itemNameById = new Map(row.items.map((it) => [it.id, it.variant.product.title]));
  return {
    ...toSummary(row),
    intervalUnit: row.intervalUnit,
    intervalCount: row.intervalCount,
    deliveriesPerCycle: row.deliveriesPerCycle,
    trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    currentPeriodStart: row.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
    pausedUntil: row.pausedUntil?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    shippingAddress: row.shippingAddress,
    billingAddress: row.billingAddress,
    items: row.items.map((it) => ({
      id: it.id,
      variantId: it.variantId,
      variantSku: it.variant.sku,
      productTitle: it.variant.product.title,
      quantity: it.quantity,
      unitPriceCents: it.unitPriceCents,
      addonOfId: it.addonOfId,
      addonOfName: it.addonOfId ? (itemNameById.get(it.addonOfId) ?? null) : null,
    })),
    events: row.events.map((ev) => ({
      id: ev.id,
      event: ev.event,
      payload: ev.payload,
      actorUserId: ev.actorUserId,
      occurredAt: ev.occurredAt.toISOString(),
    })),
    dunningAttempts: row.dunningAttempts.map((att) => ({
      id: att.id,
      paymentRef: att.paymentRef,
      attemptNumber: att.attemptNumber,
      outcome: att.outcome,
      failureReason: att.failureReason,
      attemptedAt: att.attemptedAt.toISOString(),
      nextRetryAt: att.nextRetryAt?.toISOString() ?? null,
    })),
    paymentMethod: row.paymentMethod
      ? {
          id: row.paymentMethod.id,
          brand: row.paymentMethod.brand,
          last4: row.paymentMethod.last4,
          expMonth: row.paymentMethod.expMonth,
          expYear: row.paymentMethod.expYear,
          status: row.paymentMethod.status,
        }
      : null,
  };
}

/**
 * Point a subscription at a different saved card, or switch it to invoicing.
 *
 * The recovery path for every "this cannot charge" state: a card that expired, a
 * card the customer replaced, a subscription created before there was a vault at
 * all. Without it, a past_due subscription can only be fixed by cancelling and
 * re-selling it.
 */
export async function changePaymentMethod(ctx: ServiceContext, rawInput: unknown): Promise<void> {
  const input = ChangeSubscriptionPaymentMethodInput.parse(rawInput);
  await withTenant(ctx, async (tx) => {
    const sub = await assertSubscription(tx, input.subscriptionId);

    if (input.billingMode === 'card') {
      const method = await tx.customerPaymentMethod.findFirst({
        where: { id: input.paymentMethodId ?? '', customerId: sub.customerId },
        select: { id: true, status: true },
      });
      if (!method) {
        throw new CommerceNotFoundError('PaymentMethod', input.paymentMethodId ?? '');
      }
      if (method.status !== 'active') {
        throw new CommerceValidationError('That saved card can no longer be charged.', [
          { field: 'paymentMethodId', message: `The card is ${method.status}.` },
        ]);
      }
    }

    await tx.subscription.update({
      where: { id: sub.id },
      data: {
        billingMode: input.billingMode,
        paymentMethodId: input.billingMode === 'card' ? (input.paymentMethodId ?? null) : null,
        // A new card earns a fresh attempt. Leaving it past_due would mean the
        // customer fixes the problem and still has to wait for a retry that the
        // ladder may already have given up on.
        ...(sub.status === 'past_due' ? { status: 'active' } : {}),
      },
    });

    if (sub.status === 'past_due') {
      await tx.dunningAttempt.updateMany({
        where: { subscriptionId: sub.id, nextRetryAt: { not: null } },
        data: { nextRetryAt: new Date() },
      });
    }

    await recordSubscriptionEvent(tx, ctx, sub.id, 'payment_method_changed', {
      billingMode: input.billingMode,
      paymentMethodId: input.paymentMethodId ?? null,
    });
  });
}

export interface ProductSubscriptionSummary {
  /** How many live subscriptions include this product, by status. Zero for a
   *  status is reported rather than omitted, so a caller never has to decide
   *  whether a missing key means none or means unknown. */
  counts: { active: number; paused: number; cancelled: number; pastDue: number };
  /** Combined monthly recurring revenue of the ACTIVE subscriptions only —
   *  paused and cancelled ones bill nothing, and counting them would overstate
   *  the number on the one screen a person would quote it from. */
  monthlyRecurringRevenueCents: number;
  currency: string | null;
  /** Units of this product shipped per month across active subscriptions. */
  unitsPerMonth: number;
  subscriptions: (SubscriptionSummary & {
    /** This product's own lines within that subscription — a subscription can
     *  carry several variants of the same product. */
    lines: { variantId: string; variantSku: string | null; quantity: number }[];
  })[];
}

/**
 * Every subscription that includes any variant of one product.
 *
 * A subscription is customer-grain and a product panel is product-grain, so
 * this is the join that lets a product answer "is anyone on a repeat order for
 * this, and what would stopping selling it break". Without it the product side
 * of subscriptions could not be shown at all: `list()` filters by customer and
 * status only, and asking it per variant would be a request per SKU.
 *
 * Cancelled subscriptions are INCLUDED in the counts and the list. They are the
 * evidence that this product used to sell on repeat, which is exactly what
 * someone reads this panel to find out.
 */
export async function listForProduct(
  ctx: ServiceContext,
  productId: string,
  filter: { take?: number } = {}
): Promise<ProductSubscriptionSummary> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.subscription.findMany({
      where: { items: { some: { variant: { productId } } } },
      include: {
        items: { include: { variant: { select: { id: true, sku: true, productId: true } } } },
        customer: { select: CUSTOMER_NAME_SELECT },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: filter.take ?? 100,
    });

    const counts = { active: 0, paused: 0, cancelled: 0, pastDue: 0 };
    let mrr = 0;
    let units = 0;
    let currency: string | null = null;

    const subscriptions = rows.map((row) => {
      const lines = row.items
        .filter((it) => it.variant.productId === productId)
        .map((it) => ({
          variantId: it.variantId,
          variantSku: it.variant.sku,
          quantity: it.quantity,
        }));

      // `toSummary` reports the MRR of the WHOLE subscription. This product's
      // share of it is what belongs on a product panel — a $200/mo box that
      // happens to contain one $5 item must not be reported as $200 of this
      // product's recurring revenue.
      const summary = toSummary(row);
      const productCycleCents = row.items
        .filter((it) => it.variant.productId === productId)
        .reduce((sum, it) => sum + it.unitPriceCents * it.quantity, 0);
      const productMrr = Math.round(
        productCycleCents *
          row.deliveriesPerCycle *
          monthlyFactorFor(row.intervalUnit, row.intervalCount)
      );

      if (row.status === 'active' || row.status === 'trialing') {
        counts.active += 1;
        mrr += productMrr;
        units += Math.round(
          lines.reduce((sum, line) => sum + line.quantity, 0) *
            row.deliveriesPerCycle *
            monthlyFactorFor(row.intervalUnit, row.intervalCount)
        );
        currency ??= row.currency;
      } else if (row.status === 'paused') counts.paused += 1;
      else if (row.status === 'past_due') counts.pastDue += 1;
      else counts.cancelled += 1;

      return { ...summary, monthlyRecurringRevenueCents: productMrr, lines };
    });

    return {
      counts,
      monthlyRecurringRevenueCents: mrr,
      currency,
      unitsPerMonth: units,
      subscriptions,
    };
  });
}

export async function listForCustomer(
  ctx: ServiceContext,
  customerId: string
): Promise<SubscriptionSummary[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.subscription.findMany({
      where: { customerId },
      include: { items: true, customer: { select: CUSTOMER_NAME_SELECT } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map(toSummary);
  });
}

// ─── Create ──────────────────────────────────────────────────────────

export async function create(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ id: string; nextOccurrenceAt: string }> {
  const input = CreateSubscriptionInput.parse(rawInput);

  const startAt = input.startAt ? new Date(input.startAt) : new Date();
  const trialEndsAt =
    input.trialDays != null ? new Date(startAt.getTime() + input.trialDays * 86_400_000) : null;
  const initialStatus: SubscriptionStatus = trialEndsAt ? 'trialing' : 'active';
  const nextOccurrenceAt = computeNextOccurrence(
    trialEndsAt ?? startAt,
    input.schedule.intervalUnit,
    input.schedule.intervalCount
  );

  const result = await withTenant(ctx, async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: input.customerId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new CommerceNotFoundError('Customer', input.customerId);

    // The saved card must be THIS customer's and must still be usable. Checked
    // here rather than trusted from the request: a payment-method id is a
    // guessable handle to somebody's card, and the alternative is a renewal
    // silently charging the wrong person.
    if (input.paymentMethodId) {
      const method = await tx.customerPaymentMethod.findFirst({
        where: { id: input.paymentMethodId, customerId: input.customerId },
        select: { id: true, status: true },
      });
      if (!method) throw new CommerceNotFoundError('PaymentMethod', input.paymentMethodId);
      if (method.status !== 'active') {
        throw new CommerceValidationError('That saved card can no longer be charged.', [
          { field: 'paymentMethodId', message: `The card is ${method.status}.` },
        ]);
      }
    }

    const sub = await tx.subscription.create({
      data: {
        tenantId: ctx.tenantId,
        customerId: input.customerId,
        channel: input.channel,
        currency: input.currency,
        status: initialStatus,
        providerSlug: input.paymentProviderSlug,
        billingMode: input.billingMode,
        paymentMethodId: input.paymentMethodId ?? null,
        intervalUnit: input.schedule.intervalUnit,
        intervalCount: input.schedule.intervalCount,
        deliveriesPerCycle: input.schedule.deliveriesPerCycle,
        anchorDayOfMonth: input.schedule.anchorDayOfMonth ?? null,
        anchorDayOfWeek: input.schedule.anchorDayOfWeek ?? null,
        endAfterOccurrences: input.schedule.endAfterOccurrences ?? null,
        endOnDate: input.schedule.endOnDate ? new Date(input.schedule.endOnDate) : null,
        shippingAddress: input.shippingAddress,
        ...(input.billingAddress !== undefined ? { billingAddress: input.billingAddress } : {}),
        startedAt: startAt,
        trialEndsAt,
        nextOccurrenceAt,
        items: {
          create: input.items.map((it) => ({
            tenantId: ctx.tenantId,
            variantId: it.variantId,
            quantity: it.quantity,
            unitPriceCents: it.unitPriceCents,
            ...(it.configuration ? { configurationPayload: it.configuration } : {}),
            addonOfId: it.addonOfId ?? null,
          })),
        },
      },
      select: { id: true, nextOccurrenceAt: true },
    });

    await tx.subscriptionEvent.create({
      data: {
        tenantId: ctx.tenantId,
        subscriptionId: sub.id,
        event: 'created',
        payload: {
          schedule: input.schedule,
          itemCount: input.items.length,
        },
        actorUserId: ctx.userId ?? null,
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'customer',
      action: 'commerce.subscription.created',
      entityType: 'Subscription',
      entityId: sub.id,
      diff: { after: { customerId: input.customerId, status: initialStatus } },
    });

    return sub;
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'subscription.created',
    data: {
      subscriptionId: result.id,
      customerId: input.customerId,
      providerSlug: input.paymentProviderSlug,
    },
  });

  return {
    id: result.id,
    nextOccurrenceAt: (result.nextOccurrenceAt ?? nextOccurrenceAt).toISOString(),
  };
}

// ─── Mutations ───────────────────────────────────────────────────────

export async function updateItems(ctx: ServiceContext, rawInput: unknown): Promise<void> {
  const input = UpdateSubscriptionItemsInput.parse(rawInput);
  await withTenant(ctx, async (tx) => {
    const sub = await assertSubscription(tx, input.subscriptionId);
    await tx.subscriptionItem.deleteMany({ where: { subscriptionId: sub.id } });
    await tx.subscriptionItem.createMany({
      data: input.items.map((it) => ({
        tenantId: ctx.tenantId,
        subscriptionId: sub.id,
        variantId: it.variantId,
        quantity: it.quantity,
        unitPriceCents: it.unitPriceCents,
        ...(it.configuration ? { configurationPayload: it.configuration } : {}),
        addonOfId: it.addonOfId ?? null,
      })),
    });
    await recordSubscriptionEvent(tx, ctx, sub.id, 'item_changed', { count: input.items.length });
  });
}

export async function updateSchedule(ctx: ServiceContext, rawInput: unknown): Promise<void> {
  const input = UpdateSubscriptionScheduleInput.parse(rawInput);
  await withTenant(ctx, async (tx) => {
    const sub = await assertSubscription(tx, input.subscriptionId);
    const nextOccurrenceAt = computeNextOccurrence(
      new Date(),
      input.schedule.intervalUnit,
      input.schedule.intervalCount
    );
    await tx.subscription.update({
      where: { id: sub.id },
      data: {
        intervalUnit: input.schedule.intervalUnit,
        intervalCount: input.schedule.intervalCount,
        deliveriesPerCycle: input.schedule.deliveriesPerCycle,
        anchorDayOfMonth: input.schedule.anchorDayOfMonth ?? null,
        anchorDayOfWeek: input.schedule.anchorDayOfWeek ?? null,
        endAfterOccurrences: input.schedule.endAfterOccurrences ?? null,
        endOnDate: input.schedule.endOnDate ? new Date(input.schedule.endOnDate) : null,
        nextOccurrenceAt,
      },
    });
    await recordSubscriptionEvent(tx, ctx, sub.id, 'item_changed', {
      reason: 'schedule_changed',
      schedule: input.schedule,
    });
  });
}

export async function changeAddress(ctx: ServiceContext, rawInput: unknown): Promise<void> {
  const input = ChangeSubscriptionAddressInput.parse(rawInput);
  await withTenant(ctx, async (tx) => {
    const sub = await assertSubscription(tx, input.subscriptionId);
    await tx.subscription.update({
      where: { id: sub.id },
      data: {
        ...(input.shippingAddress !== undefined ? { shippingAddress: input.shippingAddress } : {}),
        ...(input.billingAddress !== undefined ? { billingAddress: input.billingAddress } : {}),
      },
    });
    await recordSubscriptionEvent(tx, ctx, sub.id, 'address_changed', {
      shipping: input.shippingAddress != null,
      billing: input.billingAddress != null,
    });
  });
}

export async function pause(ctx: ServiceContext, rawInput: unknown): Promise<void> {
  const input = PauseSubscriptionInput.parse(rawInput);
  await withTenant(ctx, async (tx) => {
    const sub = await assertSubscription(tx, input.subscriptionId);
    if (sub.status === 'cancelled') {
      throw new CommerceConflictError('Cannot pause a cancelled subscription');
    }
    await tx.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'paused',
        pausedUntil: input.until ? new Date(input.until) : null,
      },
    });
    await recordSubscriptionEvent(tx, ctx, sub.id, 'paused', {
      until: input.until,
      reason: input.reason,
    });
  });
  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'subscription.paused',
    data: { subscriptionId: input.subscriptionId, until: input.until },
  });
}

export async function resume(ctx: ServiceContext, rawInput: unknown): Promise<void> {
  const input = ResumeSubscriptionInput.parse(rawInput);
  await withTenant(ctx, async (tx) => {
    const sub = await assertSubscription(tx, input.subscriptionId);
    if (sub.status !== 'paused') {
      throw new CommerceConflictError(`Cannot resume a ${sub.status} subscription`);
    }
    const nextOccurrenceAt = computeNextOccurrence(new Date(), sub.intervalUnit, sub.intervalCount);
    await tx.subscription.update({
      where: { id: sub.id },
      data: { status: 'active', pausedUntil: null, nextOccurrenceAt },
    });
    await recordSubscriptionEvent(tx, ctx, sub.id, 'resumed', { nextOccurrenceAt });
  });
  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'subscription.resumed',
    data: { subscriptionId: input.subscriptionId },
  });
}

export async function skipNextOccurrence(ctx: ServiceContext, rawInput: unknown): Promise<void> {
  const input = SkipNextOccurrenceInput.parse(rawInput);
  await withTenant(ctx, async (tx) => {
    const sub = await assertSubscription(tx, input.subscriptionId);
    const baseFrom = sub.nextOccurrenceAt ?? new Date();
    const nextOccurrenceAt = computeNextOccurrence(baseFrom, sub.intervalUnit, sub.intervalCount);
    await tx.subscription.update({
      where: { id: sub.id },
      data: { nextOccurrenceAt },
    });
    await recordSubscriptionEvent(tx, ctx, sub.id, 'skipped', {
      skippedFrom: baseFrom.toISOString(),
      reason: input.reason,
    });
  });
}

export async function cancel(ctx: ServiceContext, rawInput: unknown): Promise<void> {
  const input = CancelSubscriptionInput.parse(rawInput);
  await withTenant(ctx, async (tx) => {
    const sub = await assertSubscription(tx, input.subscriptionId);
    if (sub.status === 'cancelled') return;
    await tx.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        nextOccurrenceAt: input.atPeriodEnd ? sub.nextOccurrenceAt : null,
      },
    });
    await recordSubscriptionEvent(tx, ctx, sub.id, 'cancelled', {
      atPeriodEnd: input.atPeriodEnd,
      reason: input.reason,
    });
  });
  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'subscription.cancelled',
    data: { subscriptionId: input.subscriptionId, atPeriodEnd: input.atPeriodEnd },
  });
}

// ─── Worker entry points ─────────────────────────────────────────────

export async function findDueOccurrences(
  ctx: ServiceContext,
  asOf: string,
  limit: number
): Promise<string[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.subscription.findMany({
      where: {
        status: { in: ['active', 'trialing'] },
        nextOccurrenceAt: { lte: new Date(asOf) },
      },
      orderBy: { nextOccurrenceAt: 'asc' },
      take: limit,
      select: { id: true },
    });
    return rows.map((r) => r.id);
  });
}

/**
 * Generate a renewal order + advance the schedule. Idempotent on
 * subscriptionId — calling twice for the same overdue tick will only
 * produce one renewal order because nextOccurrenceAt advances inside
 * the same transaction that creates the order.
 */
export async function processOccurrence(
  ctx: ServiceContext,
  subscriptionId: string
): Promise<{ orderId: string | null; nextOccurrenceAt: string | null }> {
  let orderId: string | null = null;
  let nextOccurrenceIso: string | null = null;
  let publishRenewal = false;

  await withTenant(ctx, async (tx) => {
    const sub = await tx.subscription.findFirst({
      where: { id: subscriptionId },
      include: { items: { include: { variant: { include: { product: true } } } } },
    });
    if (!sub) throw new CommerceNotFoundError('Subscription', subscriptionId);
    if (sub.status !== 'active' && sub.status !== 'trialing') {
      return; // nothing to do
    }
    if (!sub.nextOccurrenceAt || sub.nextOccurrenceAt.getTime() > Date.now()) {
      return; // not yet due
    }

    const order = await orderService.create(ctx, {
      customerId: sub.customerId,
      channel: 'storefront',
      source: 'subscription_renewal',
      currency: sub.currency,
      shippingAddress: sub.shippingAddress as Parameters<
        typeof orderService.create
      >[1] extends infer A
        ? A
        : never,
      billingAddress: (sub.billingAddress ?? sub.shippingAddress) as Parameters<
        typeof orderService.create
      >[1] extends infer A
        ? A
        : never,
      items: sub.items.map((it) => ({
        productId: it.variant.productId,
        variantId: it.variantId,
        sku: it.variant.sku,
        name: it.variant.product.title,
        quantity: it.quantity,
        unitPrice: it.unitPriceCents / 100,
      })),
      metadata: {
        commerceSubscriptionId: sub.id,
        renewalAt: sub.nextOccurrenceAt.toISOString(),
        providerSlug: sub.providerSlug,
        providerScheduleRef: sub.providerScheduleRef,
      },
    });

    const nextOccurrenceAt = computeNextOccurrence(
      sub.nextOccurrenceAt,
      sub.intervalUnit,
      sub.intervalCount
    );
    await tx.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'active', // trial converts to active on first renewal
        currentPeriodStart: sub.nextOccurrenceAt,
        currentPeriodEnd: nextOccurrenceAt,
        nextOccurrenceAt,
      },
    });

    await recordSubscriptionEvent(tx, ctx, sub.id, 'renewed', {
      orderId: order.id,
      orderNumber: order.orderNumber,
    });

    orderId = order.id;
    nextOccurrenceIso = nextOccurrenceAt.toISOString();
    publishRenewal = true;
  });

  if (publishRenewal) {
    await publishCommerceEvent({
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      topic: 'subscription.renewed',
      data: { subscriptionId, orderId, nextOccurrenceAt: nextOccurrenceIso },
    });
  }

  return { orderId, nextOccurrenceAt: nextOccurrenceIso };
}

export async function recordDunningAttempt(
  ctx: ServiceContext,
  input: {
    subscriptionId: string;
    paymentRef: string;
    outcome: 'succeeded' | 'failed' | 'retry_scheduled';
    nextRetryAt?: string;
    /** The gateway's decline reason, stored so the subscription's dunning
     *  history reads as "why" and not just "failed". */
    reason?: string;
    /** Whether this failure should reach the customer. The dunning policy's
     *  `first_and_last` mode silences the middle attempts, so a customer whose
     *  bank is having a bad week is not emailed three times about one card.
     *  Defaults to true — a failure nobody is told about is the worse bug. */
    notifyCustomer?: boolean;
    /** The end of the ladder. Always notifies regardless of policy: this is the
     *  one the customer cannot afford to miss. */
    finalAttempt?: boolean;
  }
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const priorCount = await tx.dunningAttempt.count({
      where: { subscriptionId: input.subscriptionId },
    });
    await tx.dunningAttempt.create({
      data: {
        tenantId: ctx.tenantId,
        subscriptionId: input.subscriptionId,
        paymentRef: input.paymentRef,
        attemptNumber: priorCount + 1,
        outcome: input.outcome,
        failureReason: input.reason ?? null,
        nextRetryAt: input.nextRetryAt ? new Date(input.nextRetryAt) : null,
      },
    });
    if (input.outcome === 'failed') {
      await tx.subscription.update({
        where: { id: input.subscriptionId },
        data: { status: 'past_due' },
      });
    } else if (input.outcome === 'succeeded') {
      await tx.subscription.update({
        where: { id: input.subscriptionId },
        data: { status: 'active' },
      });
    }
  });

  // This event is what dispatches the customer's "your payment didn't go
  // through" email, via the system automation seeded on it — so suppressing the
  // publish IS how the notify policy is honoured.
  const notify = input.finalAttempt === true || input.notifyCustomer !== false;
  if (input.outcome === 'failed' && notify) {
    await publishCommerceEvent({
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      topic: 'subscription.payment_failed',
      data: {
        subscriptionId: input.subscriptionId,
        paymentRef: input.paymentRef,
        nextRetryAt: input.nextRetryAt,
        reason: input.reason,
        finalAttempt: input.finalAttempt === true,
      },
    });
  }
}

// ─── helpers ─────────────────────────────────────────────────────────

async function assertSubscription(tx: TxClient, subscriptionId: string): Promise<Subscription> {
  const sub = await tx.subscription.findFirst({ where: { id: subscriptionId } });
  if (!sub) throw new CommerceNotFoundError('Subscription', subscriptionId);
  return sub;
}

async function recordSubscriptionEvent(
  tx: TxClient,
  ctx: ServiceContext,
  subscriptionId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  await tx.subscriptionEvent.create({
    data: {
      tenantId: ctx.tenantId,
      subscriptionId,
      event,
      payload: payload as Prisma.InputJsonValue,
      actorUserId: ctx.userId ?? null,
    },
  });
}

function computeNextOccurrence(from: Date, unit: string, count: number): Date {
  const next = new Date(from);
  switch (unit) {
    case 'day':
      next.setUTCDate(next.getUTCDate() + count);
      break;
    case 'week':
      next.setUTCDate(next.getUTCDate() + 7 * count);
      break;
    case 'month':
      next.setUTCMonth(next.getUTCMonth() + count);
      break;
    case 'year':
      next.setUTCFullYear(next.getUTCFullYear() + count);
      break;
    default:
      throw new CommerceValidationError(`Unknown interval unit: ${unit}`);
  }
  return next;
}

function toSummary(
  row: Subscription & { items: SubscriptionItem[]; customer?: CustomerNameParts | null }
): SubscriptionSummary {
  // MRR estimate — sum of (unitPriceCents * quantity * deliveriesPerCycle)
  // normalized to a monthly cadence. Keeps the dashboard's MRR strip honest.
  const perCycleCents = row.items.reduce((sum, it) => sum + it.unitPriceCents * it.quantity, 0);
  const monthlyFactor = monthlyFactorFor(row.intervalUnit, row.intervalCount);
  return {
    id: row.id,
    customerId: row.customerId,
    customerName: customerDisplayName(row.customer ?? null),
    status: row.status as SubscriptionStatus,
    nextOccurrenceAt: row.nextOccurrenceAt?.toISOString() ?? null,
    itemCount: row.items.length,
    monthlyRecurringRevenueCents: Math.round(
      perCycleCents * row.deliveriesPerCycle * monthlyFactor
    ),
    currency: row.currency,
    providerSlug: row.providerSlug,
    billingMode: row.billingMode,
  };
}

function monthlyFactorFor(unit: string, count: number): number {
  if (count <= 0) return 0;
  switch (unit) {
    case 'day':
      return 30 / count;
    case 'week':
      return 30 / (7 * count);
    case 'month':
      return 1 / count;
    case 'year':
      return 1 / (12 * count);
    default:
      return 0;
  }
}
