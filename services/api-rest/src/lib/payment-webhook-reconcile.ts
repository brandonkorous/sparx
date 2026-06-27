// Go-forward payment-webhook reconciliation (docs/94 ADR §10). Every gateway webhook
// route hands us a NORMALIZED event (the gateway already verified the signature and
// collapsed the vendor's vocabulary into payment.succeeded / payment.failed /
// payment.refunded / dispute.* / account.updated). The rest of the platform never sees
// a raw gateway webhook.
//
// Tenant resolution is RLS-correct: intent events carry metadata.tenantId; charge /
// account events resolve from the connected account id on the tenant ROOT row. We
// NEVER read a FORCE-RLS table (orders, payment_*) without a tenant context — every
// read/write here runs inside withTenant. (The old single-account webhook read
// order_payments unscoped, which silently returns 0 rows under FORCE RLS in prod; this
// path does not repeat that.)
//
// Handlers are idempotent (status guards) and best-effort: the route acks 200 on a
// valid signature regardless, so a duplicate delivery can't double-apply and a partial
// failure self-heals on the next event rather than triggering Stripe retries.

import type { FastifyBaseLogger } from 'fastify';

import { prisma, withTenant } from '@sparx/db';
import { billingPaymentService } from '@sparx/crm';
import { publish } from '@sparx/api-core/pubsub';
import type { NormalizedPaymentData, ParsedWebhookEvent } from '@sparx/payments';

import { sendTenantEmailByKey } from './tenant-email.js';
import { reconcileSparxPayAccount } from './payments-onboarding.js';

interface ReconcileOptions {
  /** The gateway the event came from ('sparx_pay' | 'stripe_direct'). */
  gatewayId: string;
  /** Tenant resolved from the route (stripe-direct carries it in the path). */
  fallbackTenantId?: string;
}

/** Reconcile one verified, normalized payment event. */
export async function reconcilePaymentEvent(
  log: FastifyBaseLogger,
  parsed: ParsedWebhookEvent,
  opts: ReconcileOptions
): Promise<void> {
  if (parsed.type === 'ignored') {
    log.debug(
      { providerEventType: parsed.providerEventType },
      'payment webhook: ignored event type'
    );
    return;
  }

  const tenantId = await resolveTenantId(parsed, opts.fallbackTenantId);
  if (!tenantId) {
    log.warn(
      { type: parsed.type, externalId: parsed.externalId },
      'payment webhook: could not resolve tenant — skipping'
    );
    return;
  }

  // Dedupe + audit: the unique (gateway_id, external_id) makes a redelivery a no-op.
  const novel = await recordEvent(tenantId, opts.gatewayId, parsed);
  if (!novel) {
    log.debug(
      { externalId: parsed.externalId },
      'payment webhook: duplicate event — already recorded'
    );
    return;
  }

  // account.updated is sparx Pay Connect only — it carries no normalized payment data;
  // reconcile it off the raw account object. Every payment.* event reconciles off the
  // vendor-neutral `data` (docs/111 D5) so Square / Authorize.net / 1stPay flow through
  // the same handlers as Stripe.
  if (parsed.type === 'account.updated') {
    await reconcileSparxPayAccount(
      eventObject(parsed) as { id: string; charges_enabled?: boolean }
    );
    await markProcessed(tenantId, opts.gatewayId, parsed.externalId);
    return;
  }

  if (parsed.type === 'dispute.created' || parsed.type === 'dispute.closed') {
    // No automated action yet — disputes are handled at the gateway dashboard (sparx
    // owns the dispute surface for sparx Pay). Recorded above for audit.
    log.info(
      { type: parsed.type, externalId: parsed.externalId },
      'payment webhook: dispute event recorded'
    );
    await markProcessed(tenantId, opts.gatewayId, parsed.externalId);
    return;
  }

  const data = parsed.data;
  if (!data) {
    log.warn(
      { type: parsed.type, externalId: parsed.externalId },
      'payment webhook: payment event missing normalized data — skipping'
    );
    return;
  }

  switch (parsed.type) {
    case 'payment.succeeded':
      await handleSucceeded(log, tenantId, opts.gatewayId, data);
      break;
    case 'payment.failed':
      await handleFailed(log, tenantId, opts.gatewayId, data);
      break;
    case 'payment.refunded':
      await handleRefunded(log, tenantId, data);
      break;
  }

  await markProcessed(tenantId, opts.gatewayId, parsed.externalId);
}

// ─── tenant resolution ───────────────────────────────────────────────────────

/** The event's subject object (Stripe wraps it in data.object; gateways that hand us a
 *  plain object set payload to the object). Generic shape — no Stripe types. */
function eventObject(parsed: ParsedWebhookEvent): Record<string, unknown> {
  const payload = parsed.payload as { data?: { object?: unknown } } | null;
  const nested = payload?.data?.object;
  if (nested && typeof nested === 'object') return nested as Record<string, unknown>;
  return (parsed.payload as Record<string, unknown>) ?? {};
}

/** intent events carry metadata.tenantId; charge/account events resolve from the
 *  connected account id on the (non-RLS) tenant root row. */
async function resolveTenantId(
  parsed: ParsedWebhookEvent,
  fallbackTenantId?: string
): Promise<string | null> {
  if (parsed.tenantId) return parsed.tenantId;
  if (fallbackTenantId) return fallbackTenantId;

  const object = eventObject(parsed);
  const accountId =
    parsed.type === 'account.updated'
      ? (object.id as string | undefined)
      : refString(object.on_behalf_of);
  if (!accountId) return null;

  const tenant = await prisma.tenant.findUnique({
    where: { stripeAccountId: accountId },
    select: { id: true },
  });
  return tenant?.id ?? null;
}

function refString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value) return (value as { id: string }).id;
  return undefined;
}

// ─── event ledger (payment_events) ─────────────────────────────────────────────

async function recordEvent(
  tenantId: string,
  gatewayId: string,
  parsed: ParsedWebhookEvent
): Promise<boolean> {
  try {
    await withTenant({ tenantId }, (tx) =>
      tx.paymentEvent.create({
        data: {
          tenantId,
          gatewayId,
          externalId: parsed.externalId,
          eventType: parsed.type,
          payload: parsed.payload as object,
        },
      })
    );
    return true;
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') return false;
    throw err;
  }
}

async function markProcessed(
  tenantId: string,
  gatewayId: string,
  externalId: string
): Promise<void> {
  await withTenant({ tenantId }, (tx) =>
    tx.paymentEvent.updateMany({
      where: { gatewayId, externalId },
      data: { processedAt: new Date() },
    })
  );
}

// ─── payment.succeeded ─────────────────────────────────────────────────────────

async function handleSucceeded(
  log: FastifyBaseLogger,
  tenantId: string,
  gatewayId: string,
  data: NormalizedPaymentData
): Promise<void> {
  const amountCents = data.amountCents;
  const currency = data.currency.toUpperCase();

  const result = await withTenant({ tenantId }, async (tx) => {
    const payment = await tx.orderPayment.findFirst({
      where: { processorRef: data.chargeId },
      select: { id: true, orderId: true, status: true },
    });
    // The ledger row (informational source of truth for "what sparx earned").
    await tx.paymentIntent.updateMany({
      where: { externalId: data.chargeId },
      data: { status: 'succeeded' },
    });

    if (!payment) return { kind: 'none' as const };
    if (payment.status === 'captured') return { kind: 'already' as const };

    const order = await tx.order.findFirst({
      where: { id: payment.orderId },
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        propertyId: true,
        customer: { select: { email: true } },
      },
    });

    const now = new Date();
    await tx.orderPayment.update({
      where: { id: payment.id },
      data: { status: 'captured', capturedAt: now },
    });
    await tx.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: 'paid', paidAt: now, amountPaid: amountCents / 100 },
    });

    return {
      kind: 'captured' as const,
      orderId: payment.orderId,
      orderNumber: order?.orderNumber ?? '',
      email: order?.customer?.email ?? null,
      customerId: order?.customerId ?? null,
      propertyId: order?.propertyId ?? null,
    };
  });

  if (result.kind === 'already') return;
  if (result.kind === 'none') {
    // A scheduling deposit/prepay charge confirmed (docs/79 §9): the booking's
    // intent carries metadata.booking_id. Advance the booking's deposit from `held`
    // (set at creation) to `captured`. A card hold is captured by us in
    // settleBookingPayment (which already sets `captured`), so the guard makes this
    // a no-op there; this branch is the real confirmation for deposit/prepay.
    const bookingId = data.bookingId;
    if (bookingId) {
      const moved = await withTenant({ tenantId }, (tx) =>
        tx.booking.updateMany({
          where: { id: bookingId, depositStatus: 'held' },
          data: { depositStatus: 'captured' },
        })
      );
      if (moved.count > 0) log.info({ bookingId }, 'payment webhook: booking deposit captured');
      return;
    }
    // No OrderPayment — an invoice payment-link intent carries metadata.invoiceId and
    // is recorded against its BillingDocument (which fires crm.billing_document.paid on
    // the balance-clearing edge). Anything else is noise. The PaymentEvent dedupe above
    // makes this record-once even on redelivery.
    const invoiceId = data.invoiceId;
    if (invoiceId) {
      try {
        await billingPaymentService.recordPayment({ tenantId }, invoiceId, {
          kind: 'payment',
          method: 'card',
          amount: amountCents / 100,
          providerRef: data.chargeId,
        });
        log.info({ invoiceId, amountCents }, 'payment webhook: invoice paid via gateway');
      } catch (err) {
        log.error({ err, invoiceId }, 'payment webhook: invoice payment record failed');
      }
    } else {
      log.info(
        { chargeId: data.chargeId },
        'payment webhook: succeeded intent has no order or invoice'
      );
    }
    return;
  }

  log.info({ orderId: result.orderId, amountCents }, 'payment webhook: order paid');

  await publish(log, 'payment.captured', tenantId, null, {
    orderId: result.orderId,
    orderNumber: result.orderNumber,
    paymentRef: data.chargeId,
    amountCents,
    currency,
    providerSlug: gatewayId,
  });

  // Drives the paid-order automations + any paid-order consumer. Best-effort: a missed
  // trigger is recoverable and must not block the confirmation email.
  try {
    await publish(log, 'order.paid', tenantId, null, {
      orderId: result.orderId,
      orderNumber: result.orderNumber,
    });
  } catch (err) {
    log.error({ err, orderId: result.orderId }, 'payment webhook: order.paid publish failed');
  }

  // Order-confirmation email — the tenant's Builder-authored tree, rendered by key.
  if (result.email) {
    try {
      await sendTenantEmailByKey(log, tenantId, {
        key: 'order-confirmation',
        to: result.email,
        propertyId: result.propertyId,
        ref: { customerId: result.customerId, orderId: result.orderId },
      });
    } catch (err) {
      log.error(
        { err, orderId: result.orderId },
        'payment webhook: order-confirmation send failed'
      );
    }
  }
}

// ─── payment.failed ────────────────────────────────────────────────────────────

async function handleFailed(
  log: FastifyBaseLogger,
  tenantId: string,
  gatewayId: string,
  data: NormalizedPaymentData
): Promise<void> {
  const failureReason =
    data.failureCode || data.failureMessage
      ? `${data.failureCode ?? 'unknown'}: ${data.failureMessage ?? ''}`.slice(0, 500)
      : null;

  const result = await withTenant({ tenantId }, async (tx) => {
    await tx.paymentIntent.updateMany({
      where: { externalId: data.chargeId },
      data: { status: 'failed' },
    });
    const payment = await tx.orderPayment.findFirst({
      where: { processorRef: data.chargeId },
      select: { id: true, orderId: true, status: true },
    });
    if (!payment) {
      // A scheduling deposit charge that failed: clear the optimistic `held` so the
      // booking shows no live deposit (staff can re-request). docs/79 §9.
      const bookingId = data.bookingId;
      if (bookingId) {
        await tx.booking.updateMany({
          where: { id: bookingId, depositStatus: 'held' },
          data: { depositStatus: 'none' },
        });
      }
      return null;
    }
    if (payment.status === 'failed') return null;
    await tx.orderPayment.update({
      where: { id: payment.id },
      data: { status: 'failed', ...(failureReason ? { failureReason } : {}) },
    });
    return { orderId: payment.orderId };
  });

  if (!result) return;
  log.info({ orderId: result.orderId, chargeId: data.chargeId }, 'payment webhook: payment failed');

  await publish(log, 'payment.failed', tenantId, null, {
    orderId: result.orderId,
    paymentRef: data.chargeId,
    failureCode: data.failureCode ?? null,
    failureMessage: data.failureMessage ?? null,
    providerSlug: gatewayId,
  });
}

// ─── payment.refunded ──────────────────────────────────────────────────────────

async function handleRefunded(
  log: FastifyBaseLogger,
  tenantId: string,
  data: NormalizedPaymentData
): Promise<void> {
  if (!data.refundId) {
    log.warn(
      { chargeId: data.chargeId },
      'payment webhook: refunded event has no refund id — skipping'
    );
    return;
  }
  const refundId = data.refundId;
  const refundedCents = data.refundedCents ?? 0;

  await withTenant({ tenantId }, async (tx) => {
    const payment = await tx.orderPayment.findFirst({
      where: { processorRef: data.chargeId },
      select: { orderId: true },
    });
    if (!payment) {
      log.warn(
        { chargeId: data.chargeId, refundId },
        'payment webhook: no order payment for refunded charge'
      );
      return;
    }
    const { orderId } = payment;

    const refundRow = await tx.orderRefund.findFirst({
      where: { orderId, processorRef: refundId },
      select: { id: true, status: true },
    });
    const now = new Date();
    if (refundRow && refundRow.status !== 'completed') {
      await tx.orderRefund.update({
        where: { id: refundRow.id },
        data: { status: 'completed', refundedAt: now },
      });
    }

    const order = await tx.order.findFirst({ where: { id: orderId }, select: { total: true } });
    if (order) {
      const totalCents = Math.round(Number(order.total) * 100);
      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: refundedCents >= totalCents ? 'refunded' : 'partially_paid',
          refundTotal: refundedCents / 100,
        },
      });
    }

    log.info({ orderId, refundId }, 'payment webhook: charge refunded');
  });
}
