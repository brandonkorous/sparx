// Stored payment methods on Stripe, shared by sparx Pay and Stripe Direct
// (docs/142 §5). Both gateways vault and charge identically — the only
// differences are WHICH Stripe client (platform vs the merchant's own) and, for
// sparx Pay, the destination-charge parameters that route the money and collect
// the platform fee. Both are passed in.
//
// The card never touches sparx. `createSetupSession` returns a client secret the
// browser's Stripe element confirms directly against Stripe; what comes back to
// us afterwards is a `pm_…` token plus the brand/last4 needed to render "Visa
// ending 4242" on a screen.

import type Stripe from 'stripe';

import type {
  ChargeStoredMethodParams,
  CreateSetupSessionParams,
  SetupSession,
  StoredChargeResult,
  VaultedMethod,
} from './gateway';

/**
 * Decline reasons that mean the card is DEAD, not merely uncooperative today.
 *
 * The distinction drives the dunning ladder: a transient decline (insufficient
 * funds, a fraud model having a bad day) is worth retrying in a day or three; a
 * closed, stolen or revoked card is not. Retrying one of these earns the
 * merchant three more decline fees and the customer three more emails, and ends
 * in exactly the same place — asking for a different card. So these skip the
 * ladder entirely.
 */
const PERMANENT_DECLINE_CODES = new Set([
  'lost_card',
  'stolen_card',
  'pickup_card',
  'restricted_card',
  'revocation_of_authorization',
  'revocation_of_all_authorizations',
  'no_account',
  'invalid_account',
  'card_velocity_exceeded',
]);

/** Top-level Stripe error codes that mean the same thing. `expired_card` counts:
 *  it will keep failing every retry until a human supplies a new one. */
const PERMANENT_ERROR_CODES = new Set([
  'expired_card',
  'card_decline_rate_limit_exceeded',
  'payment_method_unactivated',
  'setup_intent_authentication_failure',
]);

interface StripeErrorish {
  code?: string;
  decline_code?: string;
  message?: string;
  payment_intent?: Stripe.PaymentIntent;
  raw?: { code?: string; decline_code?: string; payment_intent?: Stripe.PaymentIntent };
}

function asStripeError(err: unknown): StripeErrorish {
  const e = err as StripeErrorish;
  return {
    code: e.code ?? e.raw?.code,
    decline_code: e.decline_code ?? e.raw?.decline_code,
    message: e.message,
    payment_intent: e.payment_intent ?? e.raw?.payment_intent,
  };
}

function isPermanent(err: StripeErrorish): boolean {
  if (err.decline_code && PERMANENT_DECLINE_CODES.has(err.decline_code)) return true;
  return Boolean(err.code && PERMANENT_ERROR_CODES.has(err.code));
}

/** The gateway-side customer a method hangs off. Stripe will not charge a
 *  PaymentMethod off-session unless it is attached to the Customer the mandate
 *  was captured against, so this is created up front and persisted by the
 *  caller — it is half of the (customer, method) pair a renewal needs. */
async function resolveCustomer(stripe: Stripe, params: CreateSetupSessionParams): Promise<string> {
  if (params.customerRef) return params.customerRef;
  const created = await stripe.customers.create({
    metadata: {
      tenantId: params.tenantId,
      customerId: params.customerId,
      ...params.metadata,
    },
  });
  return created.id;
}

export async function createStripeSetupSession(
  stripe: Stripe,
  params: CreateSetupSessionParams,
  publishableKey?: string | null
): Promise<SetupSession> {
  const customerRef = await resolveCustomer(stripe, params);

  const setupIntent = await stripe.setupIntents.create({
    customer: customerRef,
    // Cards only. `usage: off_session` is what captures the mandate — the
    // customer's agreement to be charged later without being present. Without
    // it Stripe treats a later charge as unauthorized and the issuer is far more
    // likely to decline it.
    payment_method_types: ['card'],
    usage: 'off_session',
    metadata: {
      tenantId: params.tenantId,
      customerId: params.customerId,
      ...params.metadata,
    },
  });

  return {
    clientSecret: setupIntent.client_secret,
    redirectUrl: null,
    ...(publishableKey ? { publishableKey } : {}),
    customerRef,
    setupRef: setupIntent.id,
  };
}

export async function completeStripeVault(
  stripe: Stripe,
  setupRef: string | undefined
): Promise<VaultedMethod | null> {
  // Stripe's whole flow hangs off the SetupIntent id. Without one there is
  // nothing to look up — which happens if a caller wired a Square-shaped
  // browser token to a Stripe tenant.
  if (!setupRef) return null;

  const intent = await stripe.setupIntents.retrieve(setupRef, {
    expand: ['payment_method'],
  });

  const pm = intent.payment_method;
  // Not an error: the shopper opened the card form and never finished. The
  // caller treats null as "nothing vaulted yet" and leaves no row behind.
  if (!pm || typeof pm === 'string') return null;

  const customerRef = typeof intent.customer === 'string' ? intent.customer : intent.customer?.id;
  if (!customerRef) return null;

  return {
    methodRef: pm.id,
    customerRef,
    brand: pm.card?.brand ?? null,
    last4: pm.card?.last4 ?? null,
    expMonth: pm.card?.exp_month ?? null,
    expYear: pm.card?.exp_year ?? null,
  };
}

/**
 * Charge a vaulted card with nobody watching.
 *
 * `off_session: true` tells Stripe this is merchant-initiated, which is what
 * makes the mandate captured at setup time count. `confirm: true` attempts it
 * immediately rather than handing a client secret to a browser that is not
 * there.
 *
 * The `idempotencyKey` is the safety net that makes the whole tick re-runnable:
 * a retried HTTP request, a pod that died mid-call, or a double-fired cron all
 * resolve to the same single charge.
 */
export async function chargeStripeStoredMethod(
  stripe: Stripe,
  params: ChargeStoredMethodParams,
  extra: Partial<Stripe.PaymentIntentCreateParams> = {}
): Promise<StoredChargeResult> {
  try {
    const intent = await stripe.paymentIntents.create(
      {
        amount: params.amount,
        currency: params.currency,
        ...(params.customerRef ? { customer: params.customerRef } : {}),
        payment_method: params.methodRef,
        off_session: true,
        confirm: true,
        metadata: {
          tenantId: params.tenantId,
          orderId: params.orderId ?? '',
          customerId: params.customerId ?? '',
          ...params.metadata,
        },
        ...extra,
      },
      { idempotencyKey: params.idempotencyKey }
    );

    if (intent.status === 'succeeded' || intent.status === 'processing') {
      return { status: 'succeeded', paymentRef: intent.id };
    }

    // `requires_action` reaching us HERE (rather than as a thrown
    // authentication_required error) happens when Stripe wants a redirect-based
    // step. Same handling: not a decline.
    if (intent.status === 'requires_action') {
      return {
        status: 'requires_action',
        paymentRef: intent.id,
        ...(intent.client_secret ? { actionSecret: intent.client_secret } : {}),
      };
    }

    return {
      status: 'failed',
      paymentRef: intent.id,
      failureCode: intent.last_payment_error?.code ?? 'unknown',
      failureReason: intent.last_payment_error?.message ?? 'The payment did not complete.',
    };
  } catch (err) {
    const stripeErr = asStripeError(err);

    // The issuer wants the cardholder to authenticate. This is the single most
    // important case to get right: it is NOT a failed payment, and counting it
    // as one would cancel subscriptions belonging to customers whose cards are
    // perfectly good.
    if (stripeErr.code === 'authentication_required') {
      const intent = stripeErr.payment_intent;
      return {
        status: 'requires_action',
        paymentRef: intent?.id ?? null,
        ...(intent?.client_secret ? { actionSecret: intent.client_secret } : {}),
        failureCode: 'authentication_required',
        failureReason: 'Your bank needs you to confirm this payment.',
      };
    }

    return {
      status: 'failed',
      paymentRef: stripeErr.payment_intent?.id ?? null,
      failureCode: stripeErr.decline_code ?? stripeErr.code ?? 'unknown',
      failureReason: stripeErr.message ?? 'The card was declined.',
      ...(isPermanent(stripeErr) ? { methodDead: true } : {}),
    };
  }
}
