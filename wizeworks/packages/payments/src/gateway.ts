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

/* ── Stored payment methods (docs/142 §5) ─────────────────────────────────────
 *
 * Everything above assumes the customer is present: they are on the page, a card
 * form is mounted, and they click. A subscription renewal is the opposite — it
 * fires at 3am on a schedule with nobody watching. That needs two things the
 * interface above cannot express: vaulting a method for later, and charging one
 * without a browser in the loop.
 *
 * Gateways declare whether they can do this via `capabilities.storedMethods`;
 * both methods below are optional on the interface and required when it is true.
 */

export interface CreateSetupSessionParams {
  tenantId: string;
  /** The sparx customer this method will belong to. */
  customerId: string;
  /** The gateway-side customer to attach to, when one already exists for this
   *  shopper. Omitted on the first vault — the adapter creates one and returns
   *  it, and the caller persists it for next time. */
  customerRef?: string;
  /** Shown by hosted setup pages so the shopper knows what they are agreeing to. */
  description?: string;
  /** Where a hosted (redirect-style) setup page returns the shopper. */
  returnUrl?: string;
  metadata?: Record<string, string>;
}

export interface SetupSession {
  /** For inline gateways: the client secret the browser's card element confirms
   *  against. Null for redirect gateways. */
  clientSecret: string | null;
  /** For redirect gateways: the hosted page that collects the card. Null for
   *  inline. Exactly one of these two is set. */
  redirectUrl: string | null;
  /** The publishable/client key the BROWSER must mount with, when it is not the
   *  platform's own — same reason as `PaymentIntent.publishableKey`: a client
   *  secret is only confirmable by the SDK loaded with the key of the account
   *  that issued it. */
  publishableKey?: string;
  /** The gateway-side customer this session vaults onto. Persist it: an
   *  off-session charge needs the (customer, method) pair, not the method alone. */
  customerRef: string;
  /** The gateway's own id for the setup attempt, for reconciliation. */
  setupRef: string;
}

/** What the gateway knows about a method once it is vaulted — display metadata
 *  plus the token. `methodRef` is the only field that can charge anything, and
 *  it is useless outside the gateway that minted it. */
export interface VaultedMethod {
  methodRef: string;
  customerRef: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
}

/**
 * Finishing a vault, in the two shapes real gateways actually use.
 *
 * Stripe creates a SetupIntent server-side, the browser confirms it, and we read
 * the result back by its id — so `setupRef` carries everything. Square and
 * Authorize.net have no such object: their browser SDK hands back a single-use
 * card token which the SERVER then exchanges for a stored card, so `token` is
 * the payload and `setupRef` means nothing.
 *
 * Both are optional because which one is populated is the adapter's business.
 * An adapter reads the field it needs and ignores the other.
 */
export interface CompleteVaultParams {
  tenantId: string;
  /** The sparx customer, for gateways that create their customer at this step. */
  customerId: string;
  /** Stripe: the SetupIntent id returned by `createSetupSession`. */
  setupRef?: string;
  /** Square / Authorize.net / PayPal: the single-use token from the browser SDK
   *  or the approved setup token from a hosted vault redirect. */
  token?: string;
  /** The gateway-side customer to attach to, when one is already known. */
  customerRef?: string;
  /** The name on the card. REQUIRED by Square's CreateCard — a vault call
   *  without it is rejected outright — and useful billing metadata elsewhere.
   *  Resolved from the sparx customer by the caller, since a gateway adapter has
   *  no access to the customer record. */
  cardholderName?: string;
  /** Billing postal code, when known. Square matches it against the one entered
   *  in the payment form; a mismatch fails the vault. */
  postalCode?: string;
}

export interface ChargeStoredMethodParams {
  tenantId: string;
  /** Amount in cents. */
  amount: number;
  currency: string;
  methodRef: string;
  customerRef: string | null;
  orderId?: string;
  customerId?: string;
  /** Derived from (subscription, occurrence, attempt) by the caller. A retried
   *  HTTP request to the gateway must not become a second charge, and sparx
   *  crashing mid-request must not either. */
  idempotencyKey: string;
  /** Where to send the shopper if the issuer demands authentication. */
  returnUrl?: string;
  metadata?: Record<string, string>;

  // ── Stored-credential framework (card networks, not one vendor) ───────────
  //
  // Visa/Mastercard/Discover require a merchant-initiated charge to reference
  // the transaction that ESTABLISHED the stored credential. Stripe and PayPal
  // track that chain themselves; Authorize.net makes the merchant carry it, and
  // omitting it is what turns a routine renewal into a soft decline. So it
  // lives on the params, and the adapters that need it read it.

  /** The network transaction id from the charge that established this stored
   *  credential. Absent on the FIRST charge against a newly vaulted method —
   *  which is exactly what `isFirstCharge` below means. */
  networkTransId?: string;
  /** The amount (cents) authorised by that establishing transaction. */
  originalAuthAmount?: number;
  /** True when nothing has been charged against this method yet, so this call
   *  IS the establishing transaction. Adapters flag it differently (Authorize.net
   *  `isFirstRecurringPayment`, PayPal `usage: FIRST`). */
  isFirstCharge?: boolean;
}

export interface StoredChargeResult {
  /** `requires_action` is NOT a decline — the issuer wants the cardholder to
   *  authenticate (3-D Secure on a merchant-initiated charge). Treating it as a
   *  failure would cancel healthy subscriptions, so it is its own outcome. */
  status: 'succeeded' | 'failed' | 'requires_action';
  /** The gateway charge / intent id, when one was created. */
  paymentRef: string | null;
  /** Set on `requires_action` when the GATEWAY hosts the confirmation page. */
  actionUrl?: string;
  /** Set on `requires_action` when the confirmation happens on a sparx page
   *  instead (Stripe's 3-D Secure is confirmed by Stripe.js against this client
   *  secret). The caller composes the customer-facing URL, because the adapter
   *  has no idea what the tenant's storefront is called. */
  actionSecret?: string;
  failureCode?: string;
  failureReason?: string;
  /** True when the gateway says the method is PERMANENTLY dead — card closed,
   *  account revoked, mandate withdrawn — rather than transiently declined.
   *  Retrying a dead card three times over five days earns three more decline
   *  fees and three more emails, so this skips the ladder and asks for a new
   *  card instead. */
  methodDead?: boolean;
  /** The network transaction id this charge produced. Returned ONLY by gateways
   *  that make the merchant carry the stored-credential chain (Authorize.net);
   *  the caller persists it on the payment method and passes it back on the next
   *  charge. See `ChargeStoredMethodParams.networkTransId`. */
  networkTransId?: string;
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

  // Stored payment methods — present iff `capabilities.storedMethods` is true
  // for this gateway in GATEWAY_CATALOG. Callers reach them through
  // paymentService, which checks the capability and raises a clear error rather
  // than letting an undefined method throw.

  /** Begin vaulting a method. The card is collected by the GATEWAY's element,
   *  never by sparx. */
  createSetupSession?(params: CreateSetupSessionParams): Promise<SetupSession>;

  /** Turn a completed setup into a stored method — the display metadata plus the
   *  token to persist. Returns null when the shopper never finished. */
  completeVault?(params: CompleteVaultParams): Promise<VaultedMethod | null>;

  /** Charge a vaulted method with the customer absent (merchant-initiated). */
  chargeStoredMethod?(params: ChargeStoredMethodParams): Promise<StoredChargeResult>;

  // Webhook handling.
  parseWebhook(event: WebhookEvent): Promise<ParsedWebhookEvent>;
  verifyWebhookSignature(body: Buffer, signature: string): boolean;
}
