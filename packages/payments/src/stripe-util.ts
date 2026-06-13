// Stripe → gateway-interface mapping, shared by the Sparx Pay + Stripe Direct
// gateways. Collapses Stripe's wider vocabulary into the interface's enums and
// normalizes raw Stripe events into the platform's payment vocabulary (ADR §10).

import type Stripe from 'stripe';

import type {
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
      // The interface has no explicit capture state; manual-capture callers poll/act
      // on the same path as requires_confirmation.
      return 'requires_confirmation';
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

/** Normalize a verified raw Stripe event into the platform's payment vocabulary.
 *  The tenant id rides in metadata.tenantId (set by the gateways on create). */
export function normalizeStripeEvent(event: Stripe.Event): ParsedWebhookEvent {
  const base = { externalId: event.id, providerEventType: event.type, payload: event };

  const metaTenant = (obj: unknown): string | undefined => {
    const meta = (obj as { metadata?: Record<string, string> } | null)?.metadata;
    return meta?.tenantId;
  };

  switch (event.type) {
    case 'payment_intent.succeeded':
      return { ...base, type: 'payment.succeeded', tenantId: metaTenant(event.data.object) };
    case 'payment_intent.payment_failed':
      return { ...base, type: 'payment.failed', tenantId: metaTenant(event.data.object) };
    case 'charge.refunded':
      return { ...base, type: 'payment.refunded', tenantId: metaTenant(event.data.object) };
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
