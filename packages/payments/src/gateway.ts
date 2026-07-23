// The payment gateway abstraction (docs/94 ADR §3). Every payment flow in the
// platform — storefront checkout, invoice payment links, B2B order payments — calls
// this interface and never knows which vendor is behind it. Adding a vendor =
// implementing this interface + registering it; no flow changes.

export type PaymentIntentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'succeeded'
  | 'canceled';

export interface PaymentIntent {
  id: string;
  /** For client-side confirmation (Stripe.js / Elements) — `inline` checkout gateways. */
  clientSecret: string;
  /** For `redirect` checkout gateways (Square / Authorize.net / 1stPay / custom): the
   *  vendor-hosted payment page the storefront sends the shopper to. Empty for inline. */
  redirectUrl?: string;
  /** The publishable/client key the BROWSER must mount its card form with, when it
   *  isn't the platform's own. A `client_secret` is only confirmable by the Stripe.js
   *  instance loaded with the publishable key of the account that ISSUED it — so a
   *  `stripe_direct` tenant (intent on the merchant's own account) has to ship theirs
   *  per-request. Omitted for sparx Pay + sparx.market, whose intents live on the
   *  platform account the storefront's build-time key already matches. */
  publishableKey?: string;
  /** Amount in cents. */
  amount: number;
  currency: string;
  status: PaymentIntentStatus;
  metadata: Record<string, string>;
}

export interface PaymentResult {
  success: boolean;
  chargeId?: string;
  status?: PaymentIntentStatus;
  errorCode?: string;
  errorMessage?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  /** Amount refunded in cents. */
  amount: number;
  errorMessage?: string;
}

/** A raw inbound webhook handed to a gateway for verification + parsing. */
export interface WebhookEvent {
  rawBody: Buffer;
  signature: string;
}

/** The vendor-neutral payment facts the reconciler needs (docs/111 §1 D5). Every
 *  gateway's `parseWebhook` fills this for payment.* events so a Square / Authorize.net
 *  / 1stPay event reconciles through the SAME path as Stripe — the reconciler reads
 *  this, never a `Stripe.PaymentIntent`. */
export interface NormalizedPaymentData {
  /** The gateway charge / intent id — matches `payment_intents.external_id` and
   *  `order_payments.processor_ref` (what create stamped). */
  chargeId: string;
  /** Amount in cents (received amount for a success). */
  amountCents: number;
  currency: string;
  /** Stamped by the platform on create, echoed back by the gateway. */
  orderId?: string;
  invoiceId?: string;
  bookingId?: string;
  /** payment.refunded specifics. */
  refundId?: string;
  refundedCents?: number;
  /** payment.failed specifics. */
  failureCode?: string;
  failureMessage?: string;
}

/** The normalized event every gateway produces — the only payment vocabulary the
 *  rest of the platform sees (commerce/invoicing subscribe to these, never raw
 *  gateway webhooks). */
export interface ParsedWebhookEvent {
  type:
    | 'payment.succeeded'
    | 'payment.failed'
    | 'payment.refunded'
    | 'dispute.created'
    | 'dispute.closed'
    | 'account.updated'
    | 'ignored';
  /** Resolved tenant, when the event payload carries it. */
  tenantId?: string;
  /** The gateway's own event id — used for idempotent persistence. */
  externalId: string;
  /** The provider's raw event type (e.g. `payment_intent.succeeded`), for the log. */
  providerEventType: string;
  /** Vendor-neutral facts for payment.* events; absent for account/dispute/ignored. */
  data?: NormalizedPaymentData;
  payload: unknown;
}

export interface CreatePaymentIntentParams {
  tenantId: string;
  /** Amount in cents. */
  amount: number;
  currency: string;
  orderId?: string;
  invoiceId?: string;
  /** A scheduling booking this intent is a deposit / hold / fee for (docs/79 §9). */
  bookingId?: string;
  customerId?: string;
  metadata?: Record<string, string>;
  captureMethod?: 'automatic' | 'manual';
  /** Where the vendor-hosted page returns the shopper after paying — required by the
   *  `redirect` checkout gateways (Square / Authorize.net / 1stPay / custom); ignored
   *  by inline (Stripe) gateways. */
  returnUrl?: string;
  cancelUrl?: string;
}

export interface RefundParams {
  tenantId: string;
  /** The gateway charge / payment-intent id to refund. */
  chargeId: string;
  /** Partial refund (cents) if specified; full refund otherwise. */
  amount?: number;
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  metadata?: Record<string, string>;
}

export interface CreatePaymentLinkParams {
  tenantId: string;
  amount: number;
  currency: string;
  invoiceId: string;
  description: string;
  expiresAt?: Date;
  successUrl: string;
}

export interface PaymentGateway {
  /** Stable id: 'sparx_pay' | 'stripe_direct' | 'paypal' | 'square' | 'custom'. */
  readonly id: string;
  /** Display name for the dashboard. */
  readonly name: string;

  // Core payment operations.
  createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent>;
  confirmPayment(intentId: string): Promise<PaymentResult>;
  capturePayment(intentId: string, amount?: number): Promise<PaymentResult>;
  cancelPayment(intentId: string): Promise<PaymentResult>;
  refund(params: RefundParams): Promise<RefundResult>;

  /** Hosted payment link for invoices. Returns null when the gateway can't host one. */
  createPaymentLink(params: CreatePaymentLinkParams): Promise<string | null>;

  // Webhook handling.
  parseWebhook(event: WebhookEvent): Promise<ParsedWebhookEvent>;
  verifyWebhookSignature(body: Buffer, signature: string): boolean;
}
