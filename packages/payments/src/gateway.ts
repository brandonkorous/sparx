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
  /** For client-side confirmation (Stripe.js / Elements). */
  clientSecret: string;
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
