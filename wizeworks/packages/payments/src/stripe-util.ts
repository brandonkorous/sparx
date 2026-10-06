// Stripe → gateway-interface mapping, shared by the sparx Pay + Stripe Direct
// gateways. Collapses Stripe's wider vocabulary into the interface's enums and
// normalizes raw Stripe events into the platform's payment vocabulary (ADR §10).

import type Stripe from 'stripe';

import type {
  LookedUpPayment,
  NormalizedPaymentData,
  ParsedWebhookEvent,
  PaymentIntent,
  PaymentIntentStatus,
  PaymentResult,
} from './gateway';

export function mapIntentStatus(s: Stripe.PaymentIntent.Status): PaymentIntentStatus {
  switch (s) {
    case 'requires_payment_method':
      return 'requires_payment_method';
    case 'requires_confirmation':
      return 'requires_confirmation';
    case 'requires_action':
      return 'requires_action';
    case 'requires_capture':
      // Held, not charged. It used to read as `requires_confirmation`, which said a
      // card the shopper HAD confirmed was still waiting on them (sparx persona
      // issue 087).
      return 'requires_capture';
    case 'processing':
      return 'processing';
    case 'succeeded':
      return 'succeeded';
    case 'canceled':
      return 'canceled';
    default:
      return 'requires_payment_method';
  }
}

function chargeId(intent: Stripe.PaymentIntent): string | undefined {
  return typeof intent.latest_charge === 'string'
    ? intent.latest_charge
    : (intent.latest_charge?.id ?? undefined);
}

export function toPaymentIntent(intent: Stripe.PaymentIntent): PaymentIntent {
  return {
    id: intent.id,
    clientSecret: intent.client_secret ?? '',
    amount: intent.amount,
    currency: intent.currency,
    status: mapIntentStatus(intent.status),
    metadata: intent.metadata ?? {},
  };
}

export function toPaymentResult(intent: Stripe.PaymentIntent): PaymentResult {
  const status = mapIntentStatus(intent.status);
  const id = chargeId(intent);
  return {
    success: status === 'succeeded',
    status,
    ...(id ? { chargeId: id } : {}),
  };
}

/** A released hold, as a result. `toPaymentResult` counts only a charge as a
 *  success, so a cancel that worked came back `success: false`: the ledger was
 *  never marked canceled and every caller read a released card as a failure. */
export function toCancelResult(intent: Stripe.PaymentIntent): PaymentResult {
  const result = toPaymentResult(intent);
  return { ...result, success: result.status === 'canceled' };
}

function meta(obj: unknown): Record<string, string> {
  return (obj as { metadata?: Record<string, string> } | null)?.metadata ?? {};
}

function intentData(intent: Stripe.PaymentIntent): NormalizedPaymentData {
  const m = intent.metadata ?? {};
  const err = intent.last_payment_error;
  return {
    chargeId: intent.id,
    amountCents: intent.amount_received ?? intent.amount,
    currency: intent.currency,
    ...(m.orderId ? { orderId: m.orderId } : {}),
    ...(m.invoiceId ? { invoiceId: m.invoiceId } : {}),
    ...(m.booking_id ? { bookingId: m.booking_id } : {}),
    ...(err?.code ? { failureCode: err.code } : {}),
    ...(err?.message ? { failureMessage: err.message } : {}),
  };
}

/**
 * Where an intent stands, in the words the webhook would have used for it, so
 * the reconcile handlers cannot tell which of the two told them. The amounts
 * follow `normalizeStripeEvent` exactly: received for a charge, capturable for
 * a hold.
 */
export function lookedUpIntent(intent: Stripe.PaymentIntent): LookedUpPayment {
  const data = intentData(intent);
  switch (intent.status) {
    case 'succeeded':
      return { status: 'succeeded', data };
    case 'requires_capture':
      return {
        status: 'authorized',
        data: { ...data, amountCents: intent.amount_capturable || intent.amount },
      };
    case 'requires_payment_method':
      // Back to asking for a card after a try: the card was declined. Never
      // tried at all is still pending.
      return { status: intent.last_payment_error ? 'failed' : 'pending', data };
    default:
      return { status: 'pending', data };
  }
}

/** Look a payment up on the account `stripe` is built for. Only an intent id
 *  can be looked up; anything else is a reference this gateway did not mint. */
export async function lookupStripePayment(
  stripe: Stripe,
  paymentRef: string
): Promise<LookedUpPayment | null> {
  if (!paymentRef.startsWith('pi_')) return null;
  return lookedUpIntent(await stripe.paymentIntents.retrieve(paymentRef));
}

function chargeRefundData(charge: Stripe.Charge): NormalizedPaymentData {
  const refund = charge.refunds?.data?.[0];
  const pi =
    typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  return {
    chargeId: pi ?? charge.id,
    amountCents: charge.amount,
    currency: charge.currency,
    ...(refund?.id ? { refundId: refund.id } : {}),
    ...(refund ? { refundedCents: refund.amount } : {}),
  };
}

/** Normalize a verified raw Stripe event into the platform's payment vocabulary.
 *  The tenant id rides in metadata.tenantId (set by the gateways on create); the
 *  vendor-neutral `data` lets the reconciler stay off Stripe types (docs/111 D5). */
export function normalizeStripeEvent(event: Stripe.Event): ParsedWebhookEvent {
  const base = { externalId: event.id, providerEventType: event.type, payload: event };

  switch (event.type) {
    case 'payment_intent.succeeded':
      return {
        ...base,
        type: 'payment.succeeded',
        tenantId: meta(event.data.object).tenantId,
        data: intentData(event.data.object),
      };
    case 'payment_intent.amount_capturable_updated':
      // A manual-capture intent the shopper confirmed: the card is held for the
      // amount and nothing is charged until it is captured (sparx persona issue
      // 087). `amount_received` is 0 here, so the held amount is the intent's.
      return {
        ...base,
        type: 'payment.authorized',
        tenantId: meta(event.data.object).tenantId,
        data: {
          ...intentData(event.data.object),
          amountCents: event.data.object.amount_capturable || event.data.object.amount,
        },
      };
    case 'payment_intent.payment_failed':
      return {
        ...base,
        type: 'payment.failed',
        tenantId: meta(event.data.object).tenantId,
        data: intentData(event.data.object),
      };
    case 'charge.refunded':
      return {
        ...base,
        type: 'payment.refunded',
        tenantId: meta(event.data.object).tenantId,
        data: chargeRefundData(event.data.object),
      };
    case 'charge.dispute.created':
      return { ...base, type: 'dispute.created' };
    case 'charge.dispute.closed':
      return { ...base, type: 'dispute.closed' };
    case 'account.updated':
      return { ...base, type: 'account.updated' };
    default:
      return { ...base, type: 'ignored' };
  }
}
