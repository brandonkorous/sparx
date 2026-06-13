// Sparx Pay — Stripe Connect destination charges (docs/94 ADR §6). The charge is
// created on Sparx's PLATFORM account with on_behalf_of + transfer_data.destination →
// the merchant's connected account; application_fee_amount collects the flat 0.5%
// platform fee before the remainder settles to the merchant. Sparx owns the charge +
// dispute surface; the merchant never touches Stripe beyond Express onboarding.

import type Stripe from 'stripe';

import { getPlatformStripe } from '../client';
import { sparxPayFeeCents } from '../fee';
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
import { normalizeStripeEvent, toPaymentIntent, toPaymentResult } from '../stripe-util';

export const SPARX_PAY_ID = 'sparx_pay';

class SparxPayUnconfiguredError extends Error {
  constructor() {
    super('Sparx Pay is unavailable — the platform Stripe key is not configured.');
    this.name = 'SparxPayUnconfiguredError';
  }
}

export class SparxPayGateway implements PaymentGateway {
  readonly id = SPARX_PAY_ID;
  readonly name = 'Sparx Pay';

  private platform(): Stripe {
    const stripe = getPlatformStripe();
    if (!stripe) throw new SparxPayUnconfiguredError();
    return stripe;
  }

  /** The merchant's connected account id (`acct_…`), from Secret Manager. */
  private async merchantAccountId(tenantId: string): Promise<string> {
    return getPaymentSecretReader().read(
      credentialRef(tenantId, SPARX_PAY_ID, 'stripe_account_id')
    );
  }

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent> {
    const stripe = this.platform();
    const destination = await this.merchantAccountId(params.tenantId);

    const intent = await stripe.paymentIntents.create({
      amount: params.amount,
      currency: params.currency,
      on_behalf_of: destination,
      transfer_data: { destination },
      application_fee_amount: sparxPayFeeCents(params.amount),
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

  async confirmPayment(intentId: string): Promise<PaymentResult> {
    try {
      return toPaymentResult(await this.platform().paymentIntents.confirm(intentId));
    } catch (err) {
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : 'confirm failed',
      };
    }
  }

  async capturePayment(intentId: string, amount?: number): Promise<PaymentResult> {
    try {
      const intent = await this.platform().paymentIntents.capture(
        intentId,
        amount !== undefined ? { amount_to_capture: amount } : {}
      );
      return toPaymentResult(intent);
    } catch (err) {
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : 'capture failed',
      };
    }
  }

  async cancelPayment(intentId: string): Promise<PaymentResult> {
    try {
      return toPaymentResult(await this.platform().paymentIntents.cancel(intentId));
    } catch (err) {
      return { success: false, errorMessage: err instanceof Error ? err.message : 'cancel failed' };
    }
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    try {
      const refund = await this.platform().refunds.create({
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
    const stripe = this.platform();
    const destination = await this.merchantAccountId(params.tenantId);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_intent_data: {
        application_fee_amount: sparxPayFeeCents(params.amount),
        on_behalf_of: destination,
        transfer_data: { destination },
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

  verifyWebhookSignature(body: Buffer, signature: string): boolean {
    const secret = process.env.STRIPE_WEBHOOK_SECRET_SPARX_PAY?.trim();
    if (!secret) return false;
    try {
      this.platform().webhooks.constructEvent(body, signature, secret);
      return true;
    } catch {
      return false;
    }
  }

  parseWebhook(event: WebhookEvent): Promise<ParsedWebhookEvent> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET_SPARX_PAY?.trim() ?? '';
    const stripeEvent = this.platform().webhooks.constructEvent(
      event.rawBody,
      event.signature,
      secret
    );
    return Promise.resolve(normalizeStripeEvent(stripeEvent));
  }
}
