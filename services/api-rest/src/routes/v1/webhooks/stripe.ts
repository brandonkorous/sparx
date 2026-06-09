// Stripe webhook receiver (public — Stripe signature is the auth, no bearer
// token). Lives under /v1/public/ so the auth plugin bypasses bearer checks.
//
//   POST /v1/public/webhooks/stripe
//
// Stripe signs each webhook with the `stripe-signature` header. We verify
// the raw bytes against STRIPE_WEBHOOK_SECRET (whsec_...). On success we
// dispatch by event type and publish the platform event that downstream
// consumers (inventory, email-worker, analytics) care about.
//
// Handled events:
//   payment_intent.succeeded     → mark OrderPayment captured, publish payment.captured
//                                   + email.send (order-confirmation)
//   payment_intent.payment_failed → mark OrderPayment failed, publish payment.failed
//   charge.refunded               → mark OrderRefund completed
//
// Always returns 200 on valid signature — even for unhandled types — so
// Stripe does not retry. 400 on a bad signature.

import Stripe from 'stripe';
import type { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import { prisma, withTenant } from '@sparx/db';
import { publish } from '@sparx/api-core/pubsub';
import { ApiError } from '@sparx/api-core/errors';
import { env } from '../../../env.js';

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const stripeWebhookRoutes: FastifyPluginAsync = async (app) => {
  // Override the JSON content-type parser in this plugin's scope so the raw
  // bytes reach the route handler intact for Stripe signature verification.
  // Routes outside this encapsulated plugin keep the default JSON parser.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body: Buffer, done) => {
      done(null, body);
    }
  );

  app.post('/v1/public/webhooks/stripe', async (request, reply) => {
    const sig = request.headers['stripe-signature'];
    if (!sig || typeof sig !== 'string') {
      throw new ApiError('VALIDATION_ERROR', 'Missing stripe-signature header');
    }

    const rawBody = request.body as Buffer;

    const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      // Dev-only: accept without verification when secret is not configured.
      request.log.warn(
        'STRIPE_WEBHOOK_SECRET unset — processing webhook without signature verification (dev only)'
      );
      await reply.code(200).send({ received: true });
      return;
    }

    let event: Stripe.Event;
    try {
      event = Stripe.webhooks.constructEvent(rawBody.toString('utf8'), sig, webhookSecret);
    } catch (err) {
      request.log.warn({ err }, 'stripe webhook: signature verification failed');
      throw new ApiError('FORBIDDEN', 'Invalid Stripe webhook signature');
    }

    try {
      await dispatch(request.log, event);
    } catch (err) {
      // Log but do not rethrow — Stripe would retry on any 5xx. We prefer
      // at-most-once delivery for payment events (duplicates cause double-paid
      // state); idempotency guards inside each handler protect against retries.
      request.log.error(
        { err, eventId: event.id, eventType: event.type },
        'stripe webhook: dispatch error'
      );
    }

    await reply.code(200).send({ received: true });
  });
};

export default stripeWebhookRoutes;

// ─── event dispatch ──────────────────────────────────────────────────────────

async function dispatch(log: FastifyBaseLogger, event: Stripe.Event): Promise<void> {
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
        total: true,
        currency: true,
        customer: {
          select: { email: true, firstName: true, lastName: true },
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

  // Order confirmation email — only send when we have a customer email.
  if (order?.customer?.email) {
    await publish(log, 'email.send', tenantId, null, {
      to: order.customer.email,
      template: 'order-confirmation',
      props: {
        orderNumber: order.orderNumber,
        customerName:
          [order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ') || 'there',
        totalCents: amountCents,
        currency,
        orderId: payment.orderId,
      },
    });
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
