// sparx Pay — Stripe Connect destination charges (docs/94 ADR §6). The charge is
// created on sparx's PLATFORM account with on_behalf_of + transfer_data.destination →
// the merchant's connected account; application_fee_amount collects the flat 0.5%
// platform fee before the remainder settles to the merchant. sparx owns the charge +
// dispute surface; the merchant never touches Stripe beyond Express onboarding.

import type Stripe from 'stripe';

import { getPlatformStripe } from '../client';
import { sparxPayFeeCents } from '../fee';
import type {
  ChargeStoredMethodParams,
  CompleteVaultParams,
  CreatePaymentIntentParams,
  CreatePaymentLinkParams,
  CreateSetupSessionParams,
  PaymentGateway,
  PaymentIntent,
  PaymentResult,
  ParsedWebhookEvent,
  RefundParams,
  RefundResult,
  SetupSession,
  StoredChargeResult,
  VaultedMethod,
  WebhookEvent,
} from '../gateway';
import { credentialRef, getPaymentSecretReader } from '../secrets';
import { normalizeStripeEvent, toPaymentIntent, toPaymentResult } from '../stripe-util';
import {
  chargeStripeStoredMethod,
  completeStripeVault,
  createStripeSetupSession,
} from '../stripe-vault';
import { constructEventWithAnySecret, parseWebhookSecrets } from '../webhook-secrets';

export const SPARX_PAY_ID = 'sparx_pay';

class SparxPayUnconfiguredError extends Error {
  constructor() {
    super('Card payments are unavailable — the platform Stripe key is not configured.');
    this.name = 'SparxPayUnconfiguredError';
  }
}

export class SparxPayGateway implements PaymentGateway {
  readonly id = SPARX_PAY_ID;
  readonly name = 'sparx Pay';

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
        // Stamp the intent (not just the session) so the payment webhook can resolve
        // the tenant + invoice from payment_intent.succeeded.
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

  // ── Stored methods (docs/142 §5) ───────────────────────────────────────────
  // The Customer and PaymentMethod live on the PLATFORM account, same as the
  // charge does — sparx Pay is destination charges, so the money is routed at
  // charge time rather than the card being held by the merchant. The storefront
  // already loads Stripe.js with the platform publishable key, so no per-request
  // key is needed here (unlike stripe_direct).

  async createSetupSession(params: CreateSetupSessionParams): Promise<SetupSession> {
    return createStripeSetupSession(this.platform(), params);
  }

  completeVault(params: CompleteVaultParams): Promise<VaultedMethod | null> {
    return completeStripeVault(this.platform(), params.setupRef);
  }

  async chargeStoredMethod(params: ChargeStoredMethodParams): Promise<StoredChargeResult> {
    const destination = await this.merchantAccountId(params.tenantId);
    // The same destination-charge shape createPaymentIntent uses: the renewal
    // settles to the merchant and sparx's flat fee comes off it. A subscription
    // charge is not a different KIND of payment, so it must not earn different
    // economics by taking a different code path.
    return chargeStripeStoredMethod(this.platform(), params, {
      on_behalf_of: destination,
      transfer_data: { destination },
      application_fee_amount: sparxPayFeeCents(params.amount),
    });
  }

  /** Every secret configured for this endpoint. Comma-separated because ONE URL takes
   *  events from two Stripe endpoints (account-scoped payment/charge events + the
   *  connected-account `account.updated`), each with its own signing secret — and
   *  because a rolled secret overlaps with its predecessor. See webhook-secrets.ts. */
  private secrets(): string[] {
    return parseWebhookSecrets(process.env.STRIPE_WEBHOOK_SECRET_SPARX_PAY);
  }

  verifyWebhookSignature(body: Buffer, signature: string): boolean {
    return constructEventWithAnySecret(body, signature, this.secrets()) !== null;
  }

  parseWebhook(event: WebhookEvent): Promise<ParsedWebhookEvent> {
    const stripeEvent = constructEventWithAnySecret(event.rawBody, event.signature, this.secrets());
    if (!stripeEvent) {
      // The route verifies before calling this, so reaching here means the secrets
      // changed mid-request — surface it rather than silently dropping a payment.
      throw new Error('Webhook signature did not match any configured secret');
    }
    return Promise.resolve(normalizeStripeEvent(stripeEvent));
  }
}
