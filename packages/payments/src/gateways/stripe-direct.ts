// Stripe Direct — the merchant's OWN Stripe account (docs/94 ADR §7). sparx is not
// in the payment flow: no on_behalf_of, no application_fee, NO platform fee. The
// client is built from the merchant's secret key (Secret Manager, per tenant).

import type Stripe from 'stripe';

import { stripeForKey } from '../client';
import type {
  CreatePaymentIntentParams,
  CreatePaymentLinkParams,
  PaymentGateway,
  PaymentIntent,
  PaymentResult,
  ParsedWebhookEvent,
  RefundParams,
  RefundResult,
  WebhookEvent,
} from '../gateway';
import { credentialRef, getPaymentSecretReader } from '../secrets';
import { normalizeStripeEvent, toPaymentIntent } from '../stripe-util';

export const STRIPE_DIRECT_ID = 'stripe_direct';

export class StripeDirectGateway implements PaymentGateway {
  readonly id = STRIPE_DIRECT_ID;
  readonly name = 'Stripe (your account)';

  private async stripeFor(tenantId: string): Promise<Stripe> {
    const key = await getPaymentSecretReader().read(
      credentialRef(tenantId, STRIPE_DIRECT_ID, 'secret_key')
    );
    return stripeForKey(key);
  }

  /** The merchant's webhook signing secret (their account, their endpoint). */
  private async webhookSecret(tenantId: string): Promise<string> {
    return getPaymentSecretReader().read(
      credentialRef(tenantId, STRIPE_DIRECT_ID, 'webhook_secret')
    );
  }

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent> {
    const stripe = await this.stripeFor(params.tenantId);
    const intent = await stripe.paymentIntents.create({
      amount: params.amount,
      currency: params.currency,
      // No on_behalf_of, no application_fee — this IS the merchant's account.
      ...(params.captureMethod === 'manual' ? { capture_method: 'manual' as const } : {}),
      automatic_payment_methods: { enabled: true },
      metadata: {
        tenantId: params.tenantId,
        orderId: params.orderId ?? '',
        invoiceId: params.invoiceId ?? '',
        customerId: params.customerId ?? '',
        ...params.metadata,
      },
    });
    return toPaymentIntent(intent);
  }

  // Confirm / capture / cancel for Stripe Direct are driven client-side (Stripe.js
  // against the merchant's own publishable key) — the intent id alone doesn't carry
  // the tenant needed to build the server client, and the storefront confirms in the
  // browser. These return a clear unsupported result rather than guessing.
  confirmPayment(intentId: string): Promise<PaymentResult> {
    void intentId;
    return Promise.resolve({ success: false, errorMessage: 'stripe_direct confirms client-side' });
  }

  capturePayment(intentId: string, amount?: number): Promise<PaymentResult> {
    void intentId;
    void amount;
    return Promise.resolve({
      success: false,
      errorMessage: 'stripe_direct capture is not supported server-side',
    });
  }

  cancelPayment(intentId: string): Promise<PaymentResult> {
    void intentId;
    return Promise.resolve({
      success: false,
      errorMessage: 'stripe_direct cancel is not supported server-side',
    });
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    try {
      const stripe = await this.stripeFor(params.tenantId);
      const refund = await stripe.refunds.create({
        ...(params.chargeId.startsWith('pi_')
          ? { payment_intent: params.chargeId }
          : { charge: params.chargeId }),
        ...(params.amount !== undefined ? { amount: params.amount } : {}),
        ...(params.reason ? { reason: params.reason } : {}),
        ...(params.metadata ? { metadata: params.metadata } : {}),
      });
      return { success: true, refundId: refund.id, amount: refund.amount };
    } catch (err) {
      return {
        success: false,
        amount: params.amount ?? 0,
        errorMessage: err instanceof Error ? err.message : 'refund failed',
      };
    }
  }

  async createPaymentLink(params: CreatePaymentLinkParams): Promise<string | null> {
    const stripe = await this.stripeFor(params.tenantId);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_intent_data: {
        // Stamp the intent so the payment webhook can resolve the tenant + invoice.
        metadata: { tenantId: params.tenantId, invoiceId: params.invoiceId },
      },
      line_items: [
        {
          price_data: {
            currency: params.currency,
            unit_amount: params.amount,
            product_data: { name: params.description },
          },
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      ...(params.expiresAt ? { expires_at: Math.floor(params.expiresAt.getTime() / 1000) } : {}),
      metadata: { tenantId: params.tenantId, invoiceId: params.invoiceId },
    });
    return session.url;
  }

  // Webhook verification needs the tenant's secret, which the raw body doesn't carry
  // without the route resolving the tenant first; the stripe-direct webhook route
  // resolves the tenant from the path, then calls parseWebhookForTenant.
  verifyWebhookSignature(): boolean {
    return false;
  }

  parseWebhook(): Promise<ParsedWebhookEvent> {
    return Promise.reject(new Error('stripe_direct parses per-tenant — use parseWebhookForTenant'));
  }

  /** Tenant-scoped webhook parse (the stripe-direct route resolves the tenant from
   *  its path, then verifies against the merchant's own webhook secret). */
  async parseWebhookForTenant(tenantId: string, event: WebhookEvent): Promise<ParsedWebhookEvent> {
    const stripe = await this.stripeFor(tenantId);
    const secret = await this.webhookSecret(tenantId);
    const stripeEvent = stripe.webhooks.constructEvent(event.rawBody, event.signature, secret);
    return normalizeStripeEvent(stripeEvent);
  }
}
