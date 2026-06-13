// Shared Stripe payment-event reconciliation (docs/92 §B-G1). The SAME post-Stripe
// reconciliation runs for two ingress points: the single-account commerce webhook
// (`webhooks/stripe.ts`, one global secret) and the per-installation provider webhook
// (`webhooks/providers.ts`, each tenant's own BYO-keys Stripe account + secret). Both
// resolve the tenant from `payment_intent.metadata.sparx_tenant_id` (set by
// @sparx/provider-stripe.createPaymentIntent) and look the OrderPayment up with the
// UNSCOPED client — the established pattern for public webhooks that arrive with no
// tenant context. Every write is `withTenant`-scoped + idempotent (status guards), so
// duplicate deliveries can't double-apply.

import type Stripe from 'stripe';
import type { FastifyBaseLogger } from 'fastify';

import { prisma, withTenant } from '@sparx/db';
import { publish } from '@sparx/api-core/pubsub';

import { sendTenantEmailByKey } from './tenant-email.js';

/** Dispatch a verified Stripe payment event to its reconciliation handler. Unhandled
 *  types are a no-op (the caller still acks). Handlers never throw into the caller for
 *  a missing/duplicate row — they log and return. */
export async function dispatchStripePaymentEvent(
  log: FastifyBaseLogger,
  event: Stripe.Event
): Promise<void> {
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSucceeded(log, event.data.object);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailed(log, event.data.object);
      break;
    case 'charge.refunded':
      await handleChargeRefunded(log, event.data.object);
      break;
    default:
      log.debug({ type: event.type }, 'stripe webhook: unhandled event type — ignored');
  }
}

// ─── payment_intent.succeeded ────────────────────────────────────────────────

async function handlePaymentSucceeded(
  log: FastifyBaseLogger,
  intent: Stripe.PaymentIntent
): Promise<void> {
  const tenantId = intent.metadata?.sparx_tenant_id;
  if (!tenantId) {
    log.warn(
      { intentId: intent.id },
      'stripe webhook: payment_intent.succeeded missing sparx_tenant_id — skipping'
    );
    return;
  }

  // Find the OrderPayment row. Use the unscoped client to look it up across
  // the full table; withTenant handles all subsequent reads/writes under RLS.
  const payment = await prisma.orderPayment.findFirst({
    where: { tenantId, processorRef: intent.id, processor: 'stripe' },
    select: { id: true, orderId: true, status: true },
  });

  if (!payment) {
    log.warn(
      { intentId: intent.id, tenantId },
      'stripe webhook: no OrderPayment found for succeeded intent — skipping'
    );
    return;
  }

  // Idempotency: already captured means this event was already processed.
  if (payment.status === 'captured') {
    log.debug({ paymentId: payment.id }, 'stripe webhook: payment already captured — skipping');
    return;
  }

  const amountCents = intent.amount_received ?? intent.amount;
  const currency = intent.currency.toUpperCase();

  // Fetch the order and customer details we need for the email.
  const order = await withTenant({ tenantId }, (tx) =>
    tx.order.findFirst({
      where: { id: payment.orderId },
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        propertyId: true,
        customer: {
          select: { email: true },
        },
      },
    })
  );

  if (!order) {
    log.warn(
      { orderId: payment.orderId, tenantId },
      'stripe webhook: order not found — skipping email'
    );
  }

  const now = new Date();

  await withTenant({ tenantId }, async (tx) => {
    await tx.orderPayment.update({
      where: { id: payment.id },
      data: {
        status: 'captured',
        capturedAt: now,
      },
    });

    await tx.order.update({
      where: { id: payment.orderId },
      data: {
        paymentStatus: 'paid',
        paidAt: now,
        amountPaid: amountCents / 100,
      },
    });
  });

  log.info(
    { paymentId: payment.id, orderId: payment.orderId, amountCents },
    'stripe webhook: payment captured'
  );

  // Publish the authoritative post-Stripe payment signal.
  await publish(log, 'payment.captured', tenantId, null, {
    orderId: payment.orderId,
    orderNumber: order?.orderNumber ?? '',
    paymentRef: intent.id,
    amountCents,
    currency,
    providerSlug: 'stripe',
  });

  // The order is now fully paid (the storefront paid edge — the early
  // already-captured guard above makes this fire once). Drives the
  // high-value-order automation + any paid-order consumer; api-core's publish
  // tees it to the automation fan-in. Best-effort: an automation-trigger event is
  // additive (one missed trigger is recoverable), and it must NOT block the
  // order-confirmation email below — so a publish failure (e.g. the topic not yet
  // provisioned) is logged, not thrown. Decouples this deploy from the TF apply.
  try {
    await publish(log, 'order.paid', tenantId, null, {
      orderId: payment.orderId,
      orderNumber: order?.orderNumber ?? '',
    });
  } catch (err) {
    log.error({ err, orderId: payment.orderId }, 'stripe webhook: order.paid publish failed');
  }

  // Order confirmation email — the tenant's Builder-authored `order-confirmation`
  // tree, rendered by key at dispatch (docs/93). Best-effort: a render/publish
  // failure must not fail payment reconciliation (already committed above).
  if (order?.customer?.email) {
    try {
      await sendTenantEmailByKey(log, tenantId, {
        key: 'order-confirmation',
        to: order.customer.email,
        propertyId: order.propertyId,
        ref: { customerId: order.customerId, orderId: payment.orderId },
      });
    } catch (err) {
      log.error(
        { err, orderId: payment.orderId },
        'stripe webhook: order-confirmation send failed'
      );
    }
  }
}

// ─── payment_intent.payment_failed ───────────────────────────────────────────

async function handlePaymentFailed(
  log: FastifyBaseLogger,
  intent: Stripe.PaymentIntent
): Promise<void> {
  const tenantId = intent.metadata?.sparx_tenant_id;
  if (!tenantId) {
    log.warn(
      { intentId: intent.id },
      'stripe webhook: payment_intent.payment_failed missing sparx_tenant_id — skipping'
    );
    return;
  }

  const payment = await prisma.orderPayment.findFirst({
    where: { tenantId, processorRef: intent.id, processor: 'stripe' },
    select: { id: true, orderId: true, status: true },
  });

  if (!payment) {
    log.warn(
      { intentId: intent.id, tenantId },
      'stripe webhook: no OrderPayment found for failed intent — skipping'
    );
    return;
  }

  if (payment.status === 'failed') {
    log.debug(
      { paymentId: payment.id },
      'stripe webhook: payment already marked failed — skipping'
    );
    return;
  }

  const lastError = intent.last_payment_error;
  const failureReason = lastError
    ? `${lastError.code ?? 'unknown'}: ${lastError.message ?? ''}`.slice(0, 500)
    : null;

  await withTenant({ tenantId }, (tx) =>
    tx.orderPayment.update({
      where: { id: payment.id },
      data: {
        status: 'failed',
        ...(failureReason ? { failureReason } : {}),
      },
    })
  );

  log.info({ paymentId: payment.id, orderId: payment.orderId }, 'stripe webhook: payment failed');

  await publish(log, 'payment.failed', tenantId, null, {
    orderId: payment.orderId,
    paymentRef: intent.id,
    failureCode: lastError?.code ?? null,
    failureMessage: lastError?.message ?? null,
    providerSlug: 'stripe',
  });
}

// ─── charge.refunded ─────────────────────────────────────────────────────────

async function handleChargeRefunded(log: FastifyBaseLogger, charge: Stripe.Charge): Promise<void> {
  const paymentIntentId =
    typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;

  if (!paymentIntentId) {
    log.warn(
      { chargeId: charge.id },
      'stripe webhook: charge.refunded has no payment_intent — skipping'
    );
    return;
  }

  // Look up via OrderPayment to resolve the tenant ID.
  const payment = await prisma.orderPayment.findFirst({
    where: { processorRef: paymentIntentId, processor: 'stripe' },
    select: { id: true, tenantId: true, orderId: true },
  });

  if (!payment) {
    log.warn(
      { paymentIntentId },
      'stripe webhook: no OrderPayment found for refunded charge — skipping'
    );
    return;
  }

  const { tenantId, orderId } = payment;

  // Find the most-recently processed refund from Stripe.
  const latestRefund = charge.refunds?.data?.[0];
  if (!latestRefund) {
    log.warn(
      { chargeId: charge.id },
      'stripe webhook: charge.refunded has no refund rows — skipping'
    );
    return;
  }

  const now = new Date();

  const updated = await withTenant({ tenantId }, async (tx) => {
    // Update any OrderRefund row that matches this Stripe refund ID.
    const refundRow = await tx.orderRefund.findFirst({
      where: { tenantId, orderId, processorRef: latestRefund.id },
      select: { id: true, status: true },
    });

    if (refundRow && refundRow.status !== 'completed') {
      await tx.orderRefund.update({
        where: { id: refundRow.id },
        data: { status: 'completed', refundedAt: now },
      });
    }

    // Flip order paymentStatus based on refund amount vs. order total.
    const order = await tx.order.findFirst({
      where: { id: orderId },
      select: { total: true, amountPaid: true },
    });

    if (order) {
      const refundedCents = latestRefund.amount; // Stripe amounts are cents
      const totalCents = Math.round(Number(order.total) * 100);

      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: refundedCents >= totalCents ? 'refunded' : 'partially_paid',
          refundTotal: refundedCents / 100,
        },
      });
    }

    return true;
  });

  if (updated) {
    log.info(
      { orderId, paymentIntentId, refundId: latestRefund.id },
      'stripe webhook: charge refunded — OrderRefund updated'
    );
  }
}
