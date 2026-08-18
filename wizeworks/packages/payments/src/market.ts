// sparx.market payments — sparx as MERCHANT OF RECORD (docs/106 §4.7).
//
// Unlike every other payment flow (which resolves the TENANT's gateway — sparx Pay
// destination charge or the merchant's own Stripe), a sparx.market charge is a
// plain DIRECT charge on sparx's OWN platform Stripe account: NO on_behalf_of, NO
// transfer_data, NO application_fee. The funds stay in sparx's balance, and the
// seller is paid weekly by ACH (the settlement run) `gross − commission − refunds`.
// So this bypasses PaymentService.getGatewayForTenant entirely.
//
// The ledger row is still written on the SELLER tenant (gatewayId='sparx_market')
// so the order's payment reconciles and the commission is recorded. The intent
// carries `metadata.tenantId` + `metadata.market='true'` so the SAME platform
// webhook (STRIPE_WEBHOOK_SECRET_SPARX_PAY) reconciles it via the existing path.

import { withTenant } from '@wizeworks/db';

import { getPlatformStripe } from './client';
import type { PaymentIntent, RefundResult } from './gateway';
import { toPaymentIntent } from './stripe-util';

/** The gateway id stamped on sparx.market payment-intent ledger rows + OrderPayments. */
export const SPARX_MARKET_GATEWAY_ID = 'sparx_market';

export class MarketPaymentsUnconfiguredError extends Error {
  constructor() {
    super(
      'sparx.market payments are unavailable — the platform Stripe key (STRIPE_SECRET_KEY) is not configured.'
    );
    this.name = 'MarketPaymentsUnconfiguredError';
  }
}

function platform() {
  const stripe = getPlatformStripe();
  if (!stripe) throw new MarketPaymentsUnconfiguredError();
  return stripe;
}

export interface CreateMarketPaymentIntentParams {
  /** The SELLER tenant (the order + ledger row belong to it). */
  tenantId: string;
  /** Order total in cents. */
  amountCents: number;
  currency: string;
  /** The commission sparx will retain at settlement (cents) — recorded on the
   *  ledger row as the platform fee, for reconciliation. NOT a Stripe fee. */
  commissionCents: number;
  customerId?: string;
  /** Extra metadata stamped on the intent (cart id, merchant slug, …). */
  metadata?: Record<string, string>;
}

/** Open a sparx.market payment intent — a direct charge on sparx's platform Stripe
 *  account — and record the ledger row on the seller tenant. Returns the intent
 *  (with clientSecret) for browser confirmation via Stripe.js. */
export async function createMarketPaymentIntent(
  params: CreateMarketPaymentIntentParams
): Promise<PaymentIntent> {
  const stripe = platform();
  const intent = await stripe.paymentIntents.create({
    amount: params.amountCents,
    currency: params.currency.toLowerCase(),
    automatic_payment_methods: { enabled: true },
    metadata: {
      // tenantId drives webhook tenant resolution (normalizeStripeEvent reads it);
      // `market` flags this as a first-party MoR charge (no destination/transfer).
      tenantId: params.tenantId,
      market: 'true',
      customerId: params.customerId ?? '',
      ...params.metadata,
    },
  });

  await withTenant({ tenantId: params.tenantId }, (tx) =>
    tx.paymentIntent.create({
      data: {
        tenantId: params.tenantId,
        gatewayId: SPARX_MARKET_GATEWAY_ID,
        externalId: intent.id,
        amount: params.amountCents,
        currency: params.currency.toLowerCase(),
        // What sparx retains (informational; the settlement run is the source of truth).
        platformFee: params.commissionCents,
        status: intent.status,
        ...(params.customerId ? { customerId: params.customerId } : {}),
        metadata: params.metadata ?? {},
      },
    })
  );

  return toPaymentIntent(intent);
}

/** Retrieve a market intent to confirm its status (e.g. before marking an order
 *  paid at checkout-complete, rather than trusting the client). Returns null if the
 *  platform key is unset (dev) — the caller then leaves the order for the webhook. */
export async function retrieveMarketPaymentIntent(intentId: string): Promise<PaymentIntent | null> {
  const stripe = getPlatformStripe();
  if (!stripe) return null;
  const intent = await stripe.paymentIntents.retrieve(intentId);
  return toPaymentIntent(intent);
}

export interface RefundMarketPaymentParams {
  /** The platform PaymentIntent id (pi_…) or charge id to refund. */
  chargeId: string;
  /** Partial refund (cents); full refund when omitted. */
  amountCents?: number;
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  metadata?: Record<string, string>;
}

/** Refund a sparx.market charge on the platform account. The seller's settlement
 *  net reverses separately (the MarketSettlement.refundedCents accrual). */
export async function refundMarketPayment(
  params: RefundMarketPaymentParams
): Promise<RefundResult> {
  try {
    const refund = await platform().refunds.create({
      ...(params.chargeId.startsWith('pi_')
        ? { payment_intent: params.chargeId }
        : { charge: params.chargeId }),
      ...(params.amountCents !== undefined ? { amount: params.amountCents } : {}),
      ...(params.reason ? { reason: params.reason } : {}),
      ...(params.metadata ? { metadata: params.metadata } : {}),
    });
    return { success: true, refundId: refund.id, amount: refund.amount };
  } catch (err) {
    return {
      success: false,
      amount: params.amountCents ?? 0,
      errorMessage: err instanceof Error ? err.message : 'refund failed',
    };
  }
}
