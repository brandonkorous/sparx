// PayPal gateway (docs/111, docs/142) — the merchant's own PayPal account.
//
// Bring-your-own: sparx creates an Orders v2 order, sends the shopper to
// PayPal's approval page, and captures on return. Card data is PayPal's, sparx
// stays SAQ-A. No sparx fee. REST over `fetch` (no SDK).
//
// This gateway ALSO vaults, which is what makes it useful for subscriptions.
// PayPal's vault is not a card vault — it saves the shopper's PayPal ACCOUNT as
// a payment method (the modern replacement for billing agreements), so what
// comes back has no brand or last-4. A saved PayPal account renews exactly like
// a saved card: `payment_source.paypal.vault_id` on an order, with
// `stored_credential` telling PayPal the merchant initiated it.
//
// Three PayPal APIs are in play and they are versioned independently:
//   /v1/oauth2/token          — access tokens (client credentials)
//   /v2/checkout/orders       — pay, and charge a vaulted method
//   /v3/vault/setup-tokens    — vault: the shopper approves ONCE
//   /v3/vault/payment-tokens  — vault: exchange the approved setup token

import { createHmac, timingSafeEqual } from 'node:crypto';

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
import {
  GatewayApiError,
  loadCredentials,
  orderReference,
  postForm,
  postJson,
  requestJson,
} from './adapter-util';

export const PAYPAL_ID = 'paypal';

function apiBase(env: string): string {
  return env === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
}

/** PayPal takes amounts as a decimal STRING in the currency's major unit —
 *  `"25.99"`, not 2599. Sending cents charges a hundred times too much. */
function decimal(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * PayPal issue codes that mean this saved payment method is finished.
 *
 * Deliberately short. PayPal's failures are overwhelmingly about the ORDER
 * (`INSTRUMENT_DECLINED`, `PAYER_CANNOT_PAY`) and those are retryable — a payer
 * whose funding source declined today may well have a working one next week.
 * Only a token that no longer exists, or an agreement the payer revoked, means
 * the sparx row can never be charged again.
 */
const PAYPAL_DEAD_TOKEN_ISSUES = new Set([
  'PAYMENT_SOURCE_INFO_CANNOT_BE_VERIFIED',
  'PAYMENT_SOURCE_DECLINED_BY_PROCESSOR',
  'INVALID_RESOURCE_ID',
  'RESOURCE_NOT_FOUND',
  'VAULT_ID_NOT_FOUND',
  'PAYMENT_TOKEN_NOT_FOUND',
  'AGREEMENT_ALREADY_CANCELLED',
  'BILLING_AGREEMENT_NOT_FOUND',
]);

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

interface OrderResponse {
  id: string;
  status: string;
  links?: { rel: string; href: string; method?: string }[];
  purchase_units?: {
    payments?: {
      captures?: {
        id: string;
        status?: string;
        amount?: { value?: string; currency_code?: string };
      }[];
    };
  }[];
}

export class PayPalGateway implements PaymentGateway {
  readonly id = PAYPAL_ID;
  readonly name = 'PayPal';

  /**
   * Access tokens, cached per tenant until shortly before they expire.
   *
   * PayPal's tokens last around nine hours and it rate-limits the token
   * endpoint, so minting one per API call is both slow and a way to get
   * throttled mid-renewal-run. Keyed by (tenant, environment) because a tenant
   * that flips sandbox→production must not keep using the sandbox token.
   */
  private readonly tokens = new Map<string, { value: string; expiresAt: number }>();

  private async accessToken(tenantId: string): Promise<{ token: string; base: string }> {
    const creds = await loadCredentials(tenantId, PAYPAL_ID);
    const base = apiBase(creds.environment);
    const key = `${tenantId}:${creds.environment}`;
    const cached = this.tokens.get(key);
    if (cached && cached.expiresAt > Date.now()) return { token: cached.value, base };

    const clientId = creds.publicMeta.client_id;
    const secret = creds.secrets.client_secret;
    if (!clientId || !secret) {
      throw new Error('PayPal is missing its Client ID or secret. Reconnect it under Payments.');
    }

    const res = await postForm<TokenResponse>(
      `${base}/v1/oauth2/token`,
      { grant_type: 'client_credentials' },
      { authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}` }
    );
    this.tokens.set(key, {
      value: res.access_token,
      // A minute of headroom: a token that expires between our check and
      // PayPal's read is a 401 in the middle of a renewal.
      expiresAt: Date.now() + Math.max(0, res.expires_in - 60) * 1000,
    });
    return { token: res.access_token, base };
  }

  private async auth(tenantId: string): Promise<{ base: string; headers: Record<string, string> }> {
    const { token, base } = await this.accessToken(tenantId);
    return { base, headers: { authorization: `Bearer ${token}` } };
  }

  // ── Checkout ──────────────────────────────────────────────────────────────

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent> {
    const { base, headers } = await this.auth(params.tenantId);
    const reference = orderReference(params);

    const order = await postJson<OrderResponse>(
      `${base}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: reference,
            custom_id: params.orderId ?? params.invoiceId ?? undefined,
            amount: {
              currency_code: params.currency.toUpperCase(),
              value: decimal(params.amount),
            },
          },
        ],
        ...(params.returnUrl || params.cancelUrl
          ? {
              payment_source: {
                paypal: {
                  experience_context: {
                    ...(params.returnUrl ? { return_url: params.returnUrl } : {}),
                    ...(params.cancelUrl ? { cancel_url: params.cancelUrl } : {}),
                    user_action: 'PAY_NOW',
                  },
                },
              },
            }
          : {}),
      },
      { ...headers, 'paypal-request-id': reference }
    );

    return {
      id: order.id,
      clientSecret: '',
      // `payer-action` is the modern rel for "send the shopper here"; older
      // responses call it `approve`. Both mean the same page.
      redirectUrl: linkHref(order, 'payer-action') ?? linkHref(order, 'approve') ?? undefined,
      amount: params.amount,
      currency: params.currency,
      status: 'requires_action',
      metadata: {
        tenantId: params.tenantId,
        ...(params.orderId ? { orderId: params.orderId } : {}),
      },
    };
  }

  // The shopper confirms on PayPal's own page; there is no server-side confirm,
  // and an approved-but-uncaptured order is released by PayPal rather than by us.
  //
  // Capture DOES exist for PayPal, but it needs the tenant to mint an access
  // token and the interface signature is `(intentId, amount?)` — the same reason
  // webhook parsing is `parseWebhookForTenant`. The hosted-return route calls
  // `captureOrderForTenant` below; the reconciler is driven by the
  // PAYMENT.CAPTURE.COMPLETED webhook either way, so a shopper who closes the
  // tab mid-return still gets their order.
  confirmPayment(): Promise<PaymentResult> {
    return Promise.resolve({ success: false, errorMessage: 'PayPal confirms on its own page' });
  }
  capturePayment(): Promise<PaymentResult> {
    return Promise.resolve({
      success: false,
      errorMessage: 'paypal captures per-tenant — use captureOrderForTenant',
    });
  }
  cancelPayment(): Promise<PaymentResult> {
    return Promise.resolve({
      success: false,
      errorMessage: 'PayPal orders expire on their own; there is nothing to cancel',
    });
  }

  /** The shopper approved on PayPal's page; take the money. Idempotent at
   *  PayPal via `PayPal-Request-Id`, so a double-submitted return is safe. */
  async captureOrderForTenant(tenantId: string, orderId: string): Promise<PaymentResult> {
    try {
      const { base, headers } = await this.auth(tenantId);
      const order = await postJson<OrderResponse>(
        `${base}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
        {},
        { ...headers, 'paypal-request-id': `capture-${orderId}` }
      );
      const capture = firstCapture(order);
      if (order.status === 'COMPLETED' && capture) {
        return { success: true, chargeId: capture.id, status: 'succeeded' };
      }
      return { success: false, errorMessage: `PayPal order is ${order.status}` };
    } catch (err) {
      return { success: false, errorMessage: message(err, 'PayPal capture failed') };
    }
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    try {
      const { base, headers } = await this.auth(params.tenantId);
      // A PARTIAL refund needs a currency, and `RefundParams` carries only an
      // amount — so read it off the capture rather than assuming USD, which
      // would silently refund the wrong sum for every non-USD tenant. A full
      // refund needs no body at all, so it skips the extra call.
      let body: unknown = {};
      if (params.amount !== undefined) {
        const capture = await requestJson<{ amount?: { currency_code?: string } }>(
          'GET',
          `${base}/v2/payments/captures/${encodeURIComponent(params.chargeId)}`,
          undefined,
          headers
        );
        body = {
          amount: {
            value: decimal(params.amount),
            currency_code: (capture.amount?.currency_code ?? 'USD').toUpperCase(),
          },
        };
      }
      const res = await postJson<{ id: string; amount?: { value?: string } }>(
        `${base}/v2/payments/captures/${encodeURIComponent(params.chargeId)}/refund`,
        body,
        { ...headers, 'paypal-request-id': `refund-${params.chargeId}-${params.amount ?? 'full'}` }
      );
      return {
        success: true,
        refundId: res.id,
        amount: params.amount ?? Math.round(Number(res.amount?.value ?? 0) * 100),
      };
    } catch (err) {
      return {
        success: false,
        amount: params.amount ?? 0,
        errorMessage: message(err, 'PayPal refund failed'),
      };
    }
  }

  async createPaymentLink(params: CreatePaymentLinkParams): Promise<string | null> {
    const { base, headers } = await this.auth(params.tenantId);
    const order = await postJson<OrderResponse>(
      `${base}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            custom_id: params.invoiceId,
            description: params.description.slice(0, 127),
            amount: { currency_code: params.currency.toUpperCase(), value: decimal(params.amount) },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: { return_url: params.successUrl, user_action: 'PAY_NOW' },
          },
        },
      },
      { ...headers, 'paypal-request-id': `link-${params.invoiceId}` }
    );
    return linkHref(order, 'payer-action') ?? linkHref(order, 'approve') ?? null;
  }

  // ── Stored methods (docs/142 §5) ──────────────────────────────────────────
  //
  // PayPal's vault is a two-step, shopper-approved flow and it is a REDIRECT,
  // not an inline form: there is no card to collect, only a PayPal account to
  // authorise. `createSetupSession` mints a setup token and returns the approval
  // URL; the shopper says yes on PayPal's page; `completeVault` exchanges the
  // approved setup token for a permanent payment token.
  //
  // `usage_type: 'MERCHANT'` is the load-bearing field — it is what tells PayPal
  // the merchant intends to charge this later without the payer present. Without
  // it the token exists but merchant-initiated orders against it are refused.

  async createSetupSession(params: CreateSetupSessionParams): Promise<SetupSession> {
    const { base, headers } = await this.auth(params.tenantId);
    const setup = await postJson<{
      id: string;
      customer?: { id?: string };
      links?: { rel: string; href: string }[];
    }>(
      `${base}/v3/vault/setup-tokens`,
      {
        ...(params.customerRef ? { customer: { id: params.customerRef } } : {}),
        payment_source: {
          paypal: {
            usage_type: 'MERCHANT',
            customer_type: 'CONSUMER',
            ...(params.description ? { description: params.description.slice(0, 127) } : {}),
            experience_context: {
              ...(params.returnUrl
                ? { return_url: params.returnUrl, cancel_url: params.returnUrl }
                : {}),
              // No shipping to collect — this is a mandate, not a purchase.
              shipping_preference: 'NO_SHIPPING',
            },
          },
        },
      },
      { ...headers, 'paypal-request-id': `setup-${params.customerId}` }
    );

    return {
      clientSecret: null,
      redirectUrl: linkHref(setup, 'approve') ?? linkHref(setup, 'payer-action') ?? null,
      customerRef: setup.customer?.id ?? params.customerRef ?? '',
      // The setup token id. It comes back on the return URL, and it is what
      // `completeVault` exchanges — so the caller must carry it across the
      // redirect.
      setupRef: setup.id,
    };
  }

  async completeVault(params: CompleteVaultParams): Promise<VaultedMethod | null> {
    // Either field can carry it: `setupRef` is what createSetupSession handed
    // out, `token` is what a return URL echoed back. The shopper who abandoned
    // the approval page sends neither.
    const setupToken = params.token ?? params.setupRef;
    if (!setupToken) return null;

    const { base, headers } = await this.auth(params.tenantId);
    const vaulted = await postJson<{
      id: string;
      customer?: { id?: string };
      payment_source?: {
        card?: { brand?: string; last_digits?: string; expiry?: string };
        paypal?: { email_address?: string };
      };
    }>(
      `${base}/v3/vault/payment-tokens`,
      { payment_source: { token: { id: setupToken, type: 'SETUP_TOKEN' } } },
      { ...headers, 'paypal-request-id': `token-${setupToken}` }
    );

    const card = vaulted.payment_source?.card;
    // PayPal returns `expiry` as `YYYY-MM`, not as two integers.
    const [expYear, expMonth] = (card?.expiry ?? '').split('-');

    return {
      methodRef: vaulted.id,
      customerRef: vaulted.customer?.id ?? params.customerRef ?? '',
      // A saved PayPal ACCOUNT has no brand or last-4. "PayPal" is what the
      // shopper will recognise in a list of saved methods, and it beats a blank
      // row — the storefront renders `brand` directly.
      brand: card?.brand ?? 'PayPal',
      last4: card?.last_digits ?? null,
      expMonth: expMonth ? Number(expMonth) : null,
      expYear: expYear ? Number(expYear) : null,
    };
  }

  async chargeStoredMethod(params: ChargeStoredMethodParams): Promise<StoredChargeResult> {
    try {
      const { base, headers } = await this.auth(params.tenantId);
      const order = await postJson<OrderResponse>(
        `${base}/v2/checkout/orders`,
        {
          intent: 'CAPTURE',
          purchase_units: [
            {
              ...(params.orderId ? { custom_id: params.orderId } : {}),
              amount: {
                currency_code: params.currency.toUpperCase(),
                value: decimal(params.amount),
              },
            },
          ],
          payment_source: {
            paypal: {
              vault_id: params.methodRef,
              stored_credential: {
                // The merchant is charging, not the payer — this is the whole
                // point of the vault.
                payment_initiator: 'MERCHANT',
                payment_type: 'RECURRING',
                usage: params.isFirstCharge === true ? 'FIRST' : 'SUBSEQUENT',
              },
            },
          },
        },
        // Supplying payment_source at create time with intent CAPTURE completes
        // the payment in ONE call — there is no separate capture step for a
        // vaulted charge, and calling one would 422.
        { ...headers, 'paypal-request-id': params.idempotencyKey }
      );

      const capture = firstCapture(order);
      if (order.status === 'COMPLETED' && capture) {
        return { status: 'succeeded', paymentRef: capture.id };
      }
      // PayPal asks for payer action when it wants the shopper to authenticate
      // (3-D Secure on a stored card, or a re-consent). Not a decline — the same
      // distinction Stripe draws with `requires_action`, and treating it as a
      // failure would cancel healthy subscriptions.
      if (order.status === 'PAYER_ACTION_REQUIRED') {
        const action = linkHref(order, 'payer-action') ?? linkHref(order, 'approve');
        return {
          status: 'requires_action',
          paymentRef: order.id,
          ...(action ? { actionUrl: action } : {}),
        };
      }
      return {
        status: 'failed',
        paymentRef: order.id,
        failureCode: order.status,
        failureReason: `PayPal returned ${order.status}.`,
      };
    } catch (err) {
      const dead = err instanceof GatewayApiError && err.hasCode(PAYPAL_DEAD_TOKEN_ISSUES);
      return {
        status: 'failed',
        paymentRef: null,
        failureCode:
          err instanceof GatewayApiError ? (err.codes[0] ?? 'paypal_error') : 'paypal_error',
        failureReason: message(err, 'PayPal charge failed'),
        ...(dead ? { methodDead: true } : {}),
      };
    }
  }

  /** Forget a saved PayPal account at PayPal, not just in our table. Leaving a
   *  live mandate behind on a method the customer deleted is the kind of thing
   *  that ends up as a chargeback. */
  async deleteStoredMethod(tenantId: string, methodRef: string): Promise<void> {
    const { base, headers } = await this.auth(tenantId);
    await requestJson<void>(
      'DELETE',
      `${base}/v3/vault/payment-tokens/${encodeURIComponent(methodRef)}`,
      undefined,
      headers
    );
  }

  // ── Webhooks ──────────────────────────────────────────────────────────────
  //
  // PayPal's own verification endpoint (`/v1/notifications/verify-webhook-
  // signature`) is authoritative but needs a webhook id the merchant configures.
  // Where the tenant has given us one we verify against it; otherwise the route
  // falls back to the shared-secret HMAC the other bring-your-own gateways use.

  verifyWebhookSignature(): boolean {
    return false;
  }
  parseWebhook(): Promise<ParsedWebhookEvent> {
    return Promise.reject(new Error('paypal parses per-tenant — use parseWebhookForTenant'));
  }

  async parseWebhookForTenant(tenantId: string, event: WebhookEvent): Promise<ParsedWebhookEvent> {
    const creds = await loadCredentials(tenantId, PAYPAL_ID);
    const secret = creds.secrets.webhook_secret;
    if (secret) {
      const expected = createHmac('sha256', secret).update(event.rawBody).digest('hex');
      const got = event.signature.replace(/^sha256=/i, '');
      const ok =
        got.length === expected.length && timingSafeEqual(Buffer.from(expected), Buffer.from(got));
      if (!ok) throw new Error('paypal webhook signature mismatch');
    }
    return normalizePayPalEvent(
      JSON.parse(event.rawBody.toString('utf8')) as PayPalEventEnvelope,
      tenantId
    );
  }
}

function linkHref(res: { links?: { rel: string; href: string }[] }, rel: string): string | null {
  return res.links?.find((l) => l.rel === rel)?.href ?? null;
}

function firstCapture(order: OrderResponse) {
  return order.purchase_units?.[0]?.payments?.captures?.[0];
}

function message(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

interface PayPalEventEnvelope {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    status?: string;
    custom_id?: string;
    amount?: { value?: string; currency_code?: string };
    supplementary_data?: { related_ids?: { order_id?: string } };
  };
}

/** Normalize a PayPal webhook into the platform vocabulary (docs/111 D5). */
export function normalizePayPalEvent(
  evt: PayPalEventEnvelope,
  tenantId: string
): ParsedWebhookEvent {
  const base = {
    externalId: evt.id ?? '',
    providerEventType: evt.event_type ?? 'unknown',
    payload: evt,
    tenantId,
  };
  const resource = evt.resource;
  // PayPal amounts are decimal strings in the major unit; the platform speaks
  // cents everywhere.
  const amountCents = Math.round(Number(resource?.amount?.value ?? 0) * 100);
  const currency = (resource?.amount?.currency_code ?? 'USD').toUpperCase();
  // The order id is what our payment_intents row was keyed on; the capture's own
  // id is only reachable through supplementary_data.
  const chargeId =
    resource?.supplementary_data?.related_ids?.order_id ??
    resource?.custom_id ??
    resource?.id ??
    '';

  switch (evt.event_type) {
    case 'PAYMENT.CAPTURE.COMPLETED':
      return { ...base, type: 'payment.succeeded', data: { chargeId, amountCents, currency } };
    case 'PAYMENT.CAPTURE.DENIED':
    case 'PAYMENT.CAPTURE.DECLINED':
      return { ...base, type: 'payment.failed', data: { chargeId, amountCents, currency } };
    case 'PAYMENT.CAPTURE.REFUNDED':
      return {
        ...base,
        type: 'payment.refunded',
        data: {
          chargeId,
          amountCents,
          currency,
          refundId: resource?.id ?? '',
          refundedCents: amountCents,
        },
      };
    case 'CUSTOMER.DISPUTE.CREATED':
      return { ...base, type: 'dispute.created' };
    case 'CUSTOMER.DISPUTE.RESOLVED':
      return { ...base, type: 'dispute.closed' };
    default:
      return { ...base, type: 'ignored' };
  }
}
