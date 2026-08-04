// Subscription billing — the money movement (docs/142 §7, §8).
//
// `subscription-service.ts` owns the LIFECYCLE: the schedule, the items, pause,
// skip, cancel. This module owns COLLECTION: charging the saved card when a
// renewal comes due, retrying on the dunning ladder when it fails, and falling
// back to an invoice + payment link when the tenant's gateway cannot hold a card
// at all. They are split because they fail for unrelated reasons and are read by
// different people — a schedule bug is a product question, a charge bug is a
// money question.
//
// Both entry points here (`runDueOccurrence`, `runDueRetry`) are what the
// subscription tick calls, and both are safe to call twice.

import { orderPaymentsService } from '@sparx/crm';
import { DunningPolicy } from '@sparx/commerce-schemas';
import { paymentService, PaymentConfigError, StoredMethodsUnsupportedError } from '@sparx/payments';
import { withTenant } from '@sparx/db';
import type { Order, Prisma, Subscription } from '@sparx/db';

import type { ServiceContext } from '../errors';
import { publishCommerceEvent } from '../events';
import * as paymentMethodService from './payment-method-service';
import * as subscriptionService from './subscription-service';

/* ── Dunning policy ───────────────────────────────────────────────────────── */

/**
 * The policy shape is `DunningPolicy` from @sparx/commerce-schemas — it was
 * already specified there (maxAttempts · retryDelaysHours · finalOutcome · the
 * two notify flags) and `commerce_site_settings.default_dunning_policy` was
 * already the per-tenant home for it. Neither had a reader. This module is that
 * reader; defining a second policy shape here would have been the fork.
 *
 * Resolution order: the subscription's own override → the tenant default →
 * the schema's defaults (4 attempts over 24h / 72h / 7d / 14d, then PAUSE).
 *
 * Pause rather than cancel is the load-bearing default. A paused subscription
 * comes back the moment the customer updates their card; a cancelled one has to
 * be re-sold. Ending a paying customer's subscription because their card expired
 * is a self-inflicted churn wound, so a tenant has to opt into it.
 */
export type ResolvedDunningPolicy = DunningPolicy;

/** Parse a stored policy, degrading to the schema defaults rather than throwing.
 *  A malformed JSON blob on ONE subscription must not be able to stop every
 *  renewal in the tenant. */
export function parseDunningPolicy(raw: unknown): ResolvedDunningPolicy {
  const parsed = DunningPolicy.safeParse(raw ?? {});
  return parsed.success ? parsed.data : DunningPolicy.parse({});
}

/** The policy in force for one subscription: its own override, else the tenant's
 *  default from commerce site settings, else the schema defaults. */
export async function resolveDunningPolicy(
  ctx: ServiceContext,
  sub: Subscription
): Promise<ResolvedDunningPolicy> {
  if (sub.dunningPolicy && Object.keys(sub.dunningPolicy).length > 0) {
    return parseDunningPolicy(sub.dunningPolicy);
  }
  const settings = await withTenant(ctx, (tx) =>
    tx.commerceSiteSettings.findFirst({ select: { defaultDunningPolicy: true } })
  );
  return parseDunningPolicy(settings?.defaultDunningPolicy);
}

/* ── Results ──────────────────────────────────────────────────────────────── */

export type CollectionOutcome =
  | 'charged'
  | 'invoiced'
  | 'action_required'
  | 'retry_scheduled'
  | 'exhausted'
  | 'unbillable'
  | 'skipped';

export interface CollectionResult {
  subscriptionId: string;
  orderId: string | null;
  outcome: CollectionOutcome;
  detail?: string;
}

/* ── Entry points ─────────────────────────────────────────────────────────── */

/**
 * A renewal has come due: create the order, then collect for it.
 *
 * Order creation and the schedule advance happen inside
 * `processOccurrence` — one transaction, so a double-fired tick cannot produce
 * two renewal orders. The charge deliberately runs AFTER that transaction
 * commits: a gateway call is a round-trip to a third party that can hang, and
 * holding a database transaction open across it is how connection pools die
 * under load.
 */
export async function runDueOccurrence(
  ctx: ServiceContext,
  subscriptionId: string
): Promise<CollectionResult> {
  const { orderId } = await subscriptionService.processOccurrence(ctx, subscriptionId);
  // Not due, paused, or already advanced by a concurrent tick.
  if (!orderId) return { subscriptionId, orderId: null, outcome: 'skipped' };

  return collectForOrder(ctx, subscriptionId, orderId, 1);
}

/**
 * A dunning retry has come due: charge the SAME unpaid order again.
 *
 * One occurrence produces one order and many attempts. Creating a second order
 * per retry would bill the customer twice the moment one of them succeeded, and
 * would make the orders list read as though they had ordered four times.
 */
export async function runDueRetry(
  ctx: ServiceContext,
  subscriptionId: string
): Promise<CollectionResult> {
  const order = await findUnpaidRenewalOrder(ctx, subscriptionId);
  if (!order) {
    // The order was paid or cancelled by another path (a customer paying a link,
    // an operator recording a manual payment). Nothing left to retry — clear the
    // past_due flag so the subscription stops looking broken.
    await clearRetrySchedule(ctx, subscriptionId);
    return { subscriptionId, orderId: null, outcome: 'skipped' };
  }

  const attemptNumber = await nextAttemptNumber(ctx, subscriptionId);
  return collectForOrder(ctx, subscriptionId, order.id, attemptNumber);
}

/* ── Collection ───────────────────────────────────────────────────────────── */

async function collectForOrder(
  ctx: ServiceContext,
  subscriptionId: string,
  orderId: string,
  attemptNumber: number
): Promise<CollectionResult> {
  const context = await loadBillingContext(ctx, subscriptionId, orderId);
  if (!context) return { subscriptionId, orderId, outcome: 'skipped' };

  const { sub, order, amountCents } = context;

  // Nothing to collect — a fully-discounted or zero-value renewal still shipped,
  // so it is a success, not a failure.
  if (amountCents <= 0) {
    await markOrderSettled(ctx, order, 0, 'zero_value');
    return { subscriptionId, orderId, outcome: 'charged' };
  }

  if (sub.billingMode === 'invoice') {
    return invoiceForOrder(ctx, sub, order, amountCents);
  }

  const method = sub.paymentMethodId
    ? await withTenant(ctx, (tx) =>
        tx.customerPaymentMethod.findFirst({ where: { id: sub.paymentMethodId ?? '' } })
      )
    : null;

  // A card subscription with no usable card. This is the state every
  // pre-migration subscription is in, and the state D7 stops new ones reaching.
  // It is reported, not failed: failing it would start a dunning ladder against
  // a card that does not exist, emailing the customer about a problem only the
  // merchant can fix.
  if (method?.status !== 'active') {
    return {
      subscriptionId,
      orderId,
      outcome: 'unbillable',
      detail: method ? `Saved card is ${method.status}.` : 'No saved card on this repeat order.',
    };
  }

  let result;
  try {
    result = await paymentService.chargeStoredMethod({
      tenantId: ctx.tenantId,
      amount: amountCents,
      currency: order.currency.toLowerCase(),
      methodRef: method.methodRef,
      customerRef: method.customerRef,
      orderId: order.id,
      customerId: sub.customerId,
      // (subscription, occurrence, attempt) — stable across retries of the same
      // HTTP call, different across real retry attempts.
      idempotencyKey: `sub_${subscriptionId}_${order.id}_${String(attemptNumber)}`,
      metadata: { commerceSubscriptionId: subscriptionId },
    });
  } catch (err) {
    // The tenant's gateway cannot vault (they switched processors after this
    // subscription was set up), or has no configuration at all. Neither is the
    // customer's problem and neither is a decline — fall back to invoicing so
    // the renewal still gets collected.
    if (err instanceof StoredMethodsUnsupportedError || err instanceof PaymentConfigError) {
      return invoiceForOrder(ctx, sub, order, amountCents);
    }
    throw err;
  }

  if (result.status === 'succeeded') {
    await markOrderSettled(ctx, order, amountCents, result.paymentRef ?? 'stored_method');
    await paymentMethodService.markUsed(ctx, method.id);
    await subscriptionService.recordDunningAttempt(ctx, {
      subscriptionId,
      paymentRef: result.paymentRef ?? '',
      outcome: 'succeeded',
    });
    return { subscriptionId, orderId, outcome: 'charged' };
  }

  if (result.status === 'requires_action') {
    return authenticationRequired(ctx, sub, order, result.paymentRef, result.actionSecret);
  }

  return handleFailure(ctx, sub, order, attemptNumber, {
    paymentRef: result.paymentRef,
    reason: result.failureReason ?? 'The card was declined.',
    methodDead: result.methodDead === true,
    methodId: method.id,
  });
}

/* ── Invoice mode ─────────────────────────────────────────────────────────── */

/**
 * Collect by sending a bill instead of taking a card.
 *
 * This is not a degraded card path. It is what a gateway without a vault gets,
 * and what a wholesale account on terms actually wants — a standing order that
 * invoices monthly. So the subscription stays `active` and the order stays
 * unpaid: an outstanding invoice is accounts receivable, not a payment failure,
 * and marking it `past_due` would show a customer on 30-day terms as broken
 * every single month.
 */
async function invoiceForOrder(
  ctx: ServiceContext,
  sub: Subscription,
  order: Order,
  amountCents: number
): Promise<CollectionResult> {
  let payUrl: string | null = null;
  try {
    payUrl = await paymentService.createPaymentLink({
      tenantId: ctx.tenantId,
      amount: amountCents,
      currency: order.currency.toLowerCase(),
      invoiceId: order.id,
      description: `Repeat order ${order.orderNumber}`,
      successUrl: `${storefrontBase()}/orders/${order.id}`,
    });
  } catch {
    // `manual` and gateways without hosted links land here. The order still
    // exists and the email still goes out — it just asks them to pay the way
    // they already pay this merchant, which for a terms account is the norm.
    payUrl = null;
  }

  await recordEvent(ctx, sub.id, 'invoiced', { orderId: order.id, amountCents, hasLink: !!payUrl });

  // The customer email is the automation seed's job, not this module's. Every
  // tenant→customer email in the platform is a Builder-authored template the
  // merchant can edit, dispatched by an automation listening on the event —
  // publishing a platform template here would be the one subscription email
  // nobody could change.
  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: null,
    topic: 'subscription.invoiced',
    data: {
      subscriptionId: sub.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amountCents,
      currency: order.currency,
      payUrl,
    },
  });

  return { subscriptionId: sub.id, orderId: order.id, outcome: 'invoiced' };
}

/* ── Failure handling ─────────────────────────────────────────────────────── */

interface FailureInput {
  paymentRef: string | null;
  reason: string;
  methodDead: boolean;
  methodId: string;
}

async function handleFailure(
  ctx: ServiceContext,
  sub: Subscription,
  order: Order,
  attemptNumber: number,
  failure: FailureInput
): Promise<CollectionResult> {
  const policy = await resolveDunningPolicy(ctx, sub);

  // A dead card and an exhausted ladder end the same way, for the same reason:
  // there is nothing left to try automatically, and only the customer can fix
  // it. Retrying a closed card on schedule earns more decline fees and more
  // emails and lands in exactly this place anyway.
  const ladderExhausted = attemptNumber >= policy.maxAttempts;
  const stop = failure.methodDead || ladderExhausted;

  if (failure.methodDead) {
    await paymentMethodService.markRevoked(ctx, failure.methodId, failure.reason);
  }

  if (stop) {
    await subscriptionService.recordDunningAttempt(ctx, {
      subscriptionId: sub.id,
      paymentRef: failure.paymentRef ?? '',
      outcome: 'failed',
      reason: failure.reason,
      finalAttempt: true,
      notifyCustomer: policy.notifyCustomerOnFinalFailure,
    });
    // Publishes `subscription.paused` / `subscription.cancelled` in its own
    // right, so the customer also gets the lifecycle email explaining what
    // happened to their subscription — not just that a payment failed.
    await applyFinalOutcome(ctx, sub, policy, failure.reason);
    return {
      subscriptionId: sub.id,
      orderId: order.id,
      outcome: 'exhausted',
      detail: failure.reason,
    };
  }

  // The delay for THIS attempt. Past the end of the list, the last interval
  // repeats — a policy with more attempts than delays should stretch out, not
  // collapse to retrying every hour.
  const waitHours =
    policy.retryDelaysHours[attemptNumber - 1] ??
    policy.retryDelaysHours[policy.retryDelaysHours.length - 1] ??
    24;
  const nextRetryAt = new Date(Date.now() + waitHours * 3_600_000);

  await subscriptionService.recordDunningAttempt(ctx, {
    subscriptionId: sub.id,
    paymentRef: failure.paymentRef ?? '',
    // `failed` is what flips the subscription to past_due, which is the state
    // the retry query selects on. `retry_scheduled` would leave it active and
    // the retry would never be found.
    outcome: 'failed',
    nextRetryAt: nextRetryAt.toISOString(),
    reason: failure.reason,
    // Only the FIRST failure notifies (and the final one, above). The middle
    // attempts retry silently, so a customer whose bank is having a bad week is
    // not emailed four times about one card.
    notifyCustomer: attemptNumber === 1 && policy.notifyCustomerOnFirstFailure,
  });

  return {
    subscriptionId: sub.id,
    orderId: order.id,
    outcome: 'retry_scheduled',
    detail: failure.reason,
  };
}

/**
 * The issuer wants the cardholder to authenticate.
 *
 * Emphatically NOT a decline — the card is good and the customer is willing.
 * Treating it as a failure would run healthy subscriptions down the dunning
 * ladder and cancel them. The renewal stays unpaid until they confirm; the
 * gateway webhook settles it through the interactive path that already exists,
 * and the retry is scheduled anyway in case the email goes unread.
 */
async function authenticationRequired(
  ctx: ServiceContext,
  sub: Subscription,
  order: Order,
  paymentRef: string | null,
  actionSecret: string | undefined
): Promise<CollectionResult> {
  const policy = await resolveDunningPolicy(ctx, sub);
  const waitHours = policy.retryDelaysHours[0] ?? 24;
  const nextRetryAt = new Date(Date.now() + waitHours * 3_600_000);

  await subscriptionService.recordDunningAttempt(ctx, {
    subscriptionId: sub.id,
    paymentRef: paymentRef ?? '',
    outcome: 'retry_scheduled',
    nextRetryAt: nextRetryAt.toISOString(),
  });

  await recordEvent(ctx, sub.id, 'authentication_required', {
    orderId: order.id,
    paymentRef,
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: null,
    topic: 'subscription.authentication_required',
    data: {
      subscriptionId: sub.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      confirmUrl: actionSecret
        ? `${storefrontBase()}/account/confirm-payment?secret=${encodeURIComponent(actionSecret)}`
        : `${storefrontBase()}/account/subscriptions`,
    },
  });

  return { subscriptionId: sub.id, orderId: order.id, outcome: 'action_required' };
}

async function applyFinalOutcome(
  ctx: ServiceContext,
  sub: Subscription,
  policy: ResolvedDunningPolicy,
  reason: string
): Promise<void> {
  // `mark_past_due` means "leave it where it is and let a human decide" — the
  // subscription is already past_due from the recorded failure, so there is
  // nothing further to do.
  if (policy.finalOutcome === 'mark_past_due') return;

  if (policy.finalOutcome === 'cancel') {
    await subscriptionService.cancel(ctx, {
      subscriptionId: sub.id,
      atPeriodEnd: false,
      reason: `Payment failed: ${reason}`,
    });
    return;
  }

  // Pause. Deliberately NOT via subscriptionService.pause — that refuses a
  // cancelled subscription and records an operator-flavoured event; this is the
  // system parking a customer we still want back.
  await withTenant(ctx, (tx) =>
    tx.subscription.update({
      where: { id: sub.id },
      data: { status: 'paused', pausedUntil: null },
    })
  );
  await recordEvent(ctx, sub.id, 'paused', { reason: `Payment failed: ${reason}`, bySystem: true });
  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: null,
    topic: 'subscription.paused',
    data: { subscriptionId: sub.id, reason },
  });
}

/* ── Shared helpers ───────────────────────────────────────────────────────── */

interface BillingContext {
  sub: Subscription;
  order: Order;
  amountCents: number;
}

async function loadBillingContext(
  ctx: ServiceContext,
  subscriptionId: string,
  orderId: string
): Promise<BillingContext | null> {
  return withTenant(ctx, async (tx) => {
    const sub = await tx.subscription.findFirst({ where: { id: subscriptionId } });
    if (!sub) return null;
    const order = await tx.order.findFirst({ where: { id: orderId } });
    if (!order) return null;
    // Settled between the tick reading it and getting here.
    if (order.paymentStatus === 'paid') return null;

    const outstanding = Number(order.total) - Number(order.amountPaid);
    return { sub, order, amountCents: Math.round(outstanding * 100) };
  });
}

/** The unpaid renewal order a retry is for. Newest first — a subscription that
 *  has been failing for months could have several, and the current period's is
 *  the one being collected. */
async function findUnpaidRenewalOrder(
  ctx: ServiceContext,
  subscriptionId: string
): Promise<Order | null> {
  return withTenant(ctx, (tx) =>
    tx.order.findFirst({
      where: {
        metadata: { path: ['commerceSubscriptionId'], equals: subscriptionId },
        paymentStatus: { not: 'paid' },
        status: { notIn: ['cancelled', 'refunded'] },
      },
      orderBy: { createdAt: 'desc' },
    })
  );
}

async function nextAttemptNumber(ctx: ServiceContext, subscriptionId: string): Promise<number> {
  const count = await withTenant(ctx, (tx) =>
    tx.dunningAttempt.count({ where: { subscriptionId } })
  );
  return count + 1;
}

/** Stop a subscription being picked up by the retry query without recording a
 *  new attempt — used when the order settled by some other route. */
async function clearRetrySchedule(ctx: ServiceContext, subscriptionId: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    await tx.dunningAttempt.updateMany({
      where: { subscriptionId, nextRetryAt: { not: null } },
      data: { nextRetryAt: null },
    });
    await tx.subscription.updateMany({
      where: { id: subscriptionId, status: 'past_due' },
      data: { status: 'active' },
    });
  });
}

/** Record the money against the order. `recordPayment` recomputes the order's
 *  paid/unpaid rollup and publishes `order.paid` on the unpaid→paid edge — which
 *  is what finally makes fulfilment run for a renewal. */
async function markOrderSettled(
  ctx: ServiceContext,
  order: Order,
  amountCents: number,
  processorRef: string
): Promise<void> {
  await orderPaymentsService.recordPayment(ctx, {
    orderId: order.id,
    processor: 'card',
    processorRef,
    amount: amountCents / 100,
    currency: order.currency,
    status: 'captured',
    metadata: { source: 'subscription_renewal' },
  });
}

async function recordEvent(
  ctx: ServiceContext,
  subscriptionId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  await withTenant(ctx, (tx) =>
    tx.subscriptionEvent.create({
      data: {
        tenantId: ctx.tenantId,
        subscriptionId,
        event,
        payload: payload as Prisma.InputJsonValue,
        actorUserId: null,
      },
    })
  );
}

function storefrontBase(): string {
  return (process.env.SPARX_STOREFRONT_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(
    /\/$/,
    ''
  );
}
