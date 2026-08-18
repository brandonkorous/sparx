// Square gateway (docs/111) — the merchant's own Square account. Bring-your-own:
// sparx routes checkout to a Square-hosted payment-link page (a GET redirect), so the
// card form is Square's and sparx stays at SAQ-A. No sparx fee. REST over `fetch`
// against the Square Connect API (no SDK). Credentials (access token + location +
// application id) are merchant-entered, encrypted at rest, read via the credential
// reader.
//
// Live exercise is the go-live strand (docs/111 §4): run against a Square SANDBOX
// account (connect.squareupsandbox.com) — connect → payment-link → webhook → refund.

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
import { GatewayApiError, loadCredentials, orderReference, postJson } from './adapter-util';

export const SQUARE_ID = 'square';

// Must be >= 2023-08-16 for `customer_details` on CreatePayment (the
// card-on-file / MOTO flags). Lowering this silently drops the off-session
// signal rather than erroring.
const SQUARE_VERSION = '2024-10-17';

/** Square rejects an idempotency key over 45 characters outright. Truncating
 *  from the FRONT keeps the most-varying end of a composite key, so two
 *  different renewals cannot collapse onto one key and skip a charge. */
function idempotency(key: string): string {
  return key.length <= 45 ? key : key.slice(key.length - 45);
}

/** Square's CreateCard requires a cardholder name. Blank, absent and
 *  all-whitespace all have to become a real value or the vault is rejected. */
function cardholderName(name: string | undefined): string {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : 'Cardholder';
}

/**
 * Square `ErrorCode` values that mean the stored card is finished, not just
 * unlucky — the same distinction Stripe's decline codes draw.
 *
 * Taken from Square's ErrorCode enum, and deliberately NARROW: every code here
 * describes the card itself being unusable, so no amount of waiting fixes it.
 * Everything else Square can answer with — GENERIC_DECLINE, INSUFFICIENT_FUNDS,
 * CVV_FAILURE, CARD_DECLINED_CALL_ISSUER, TRANSACTION_LIMIT, TEMPORARY_ERROR —
 * is an issuer having a bad day, and the ladder should retry it.
 *
 * The nonce codes (CARD_TOKEN_EXPIRED / CARD_TOKEN_USED) are NOT here: they
 * describe a single-use token from the payment form, which is a vaulting-time
 * problem, not a card-on-file one. Listing them made a shopper's card look dead
 * for a mistake that could only happen before it was ever stored.
 */
const SQUARE_PERMANENT_CODES = new Set([
  'CARD_EXPIRED',
  'INVALID_CARD',
  'INVALID_EXPIRATION',
  'INVALID_EXPIRATION_YEAR',
  'INVALID_EXPIRATION_DATE',
  'PAN_FAILURE',
  'CARD_NOT_SUPPORTED',
  'UNSUPPORTED_CARD_BRAND',
  // The card-on-file itself is gone at Square — disabled by the shopper, or
  // deleted. Retrying cannot bring it back.
  'CARD_NOT_ENABLED',
  'NOT_FOUND',
]);

function baseUrl(env: string): string {
  return env === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com';
}

interface PaymentLinkResponse {
  payment_link: { id: string; url: string; order_id?: string };
}

export class SquareGateway implements PaymentGateway {
  readonly id = SQUARE_ID;
  readonly name = 'Square';

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent> {
    const creds = await loadCredentials(params.tenantId, SQUARE_ID);
    const token = creds.secrets.access_token;
    const locationId = creds.publicMeta.location_id;
    const ref = orderReference(params);

    const body = {
      idempotency_key: ref,
      quick_pay: {
        name: `Order ${ref}`,
        price_money: { amount: params.amount, currency: params.currency.toUpperCase() },
        location_id: locationId,
      },
      ...(params.returnUrl ? { checkout_options: { redirect_url: params.returnUrl } } : {}),
      payment_note: ref,
    };

    const res = await postJson<PaymentLinkResponse>(
      `${baseUrl(creds.environment)}/v2/online-checkout/payment-links`,
      body,
      { authorization: `Bearer ${token}`, 'square-version': SQUARE_VERSION }
    );

    return {
      id: res.payment_link.order_id ?? res.payment_link.id,
      clientSecret: '',
      redirectUrl: res.payment_link.url,
      amount: params.amount,
      currency: params.currency,
      status: 'requires_action',
      metadata: {
        tenantId: params.tenantId,
        ...(params.orderId ? { orderId: params.orderId } : {}),
      },
    };
  }

  // Hosted-redirect gateways confirm at Square's page; there is no server-side confirm/
  // capture/cancel step (Square auto-captures on the hosted page). The webhook is the
  // source of truth for success.
  confirmPayment(): Promise<PaymentResult> {
    return Promise.resolve({ success: false, errorMessage: 'square confirms on its hosted page' });
  }
  capturePayment(): Promise<PaymentResult> {
    return Promise.resolve({
      success: false,
      errorMessage: 'square auto-captures on its hosted page',
    });
  }
  cancelPayment(): Promise<PaymentResult> {
    return Promise.resolve({ success: false, errorMessage: 'square cancel is not supported' });
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    try {
      const creds = await loadCredentials(params.tenantId, SQUARE_ID);
      const res = await postJson<{ refund: { id: string; amount_money: { amount: number } } }>(
        `${baseUrl(creds.environment)}/v2/refunds`,
        {
          idempotency_key: `${params.chargeId}-refund`,
          payment_id: params.chargeId,
          ...(params.amount !== undefined
            ? { amount_money: { amount: params.amount, currency: 'USD' } }
            : {}),
        },
        { authorization: `Bearer ${creds.secrets.access_token}`, 'square-version': SQUARE_VERSION }
      );
      return { success: true, refundId: res.refund.id, amount: res.refund.amount_money.amount };
    } catch (err) {
      return {
        success: false,
        amount: params.amount ?? 0,
        errorMessage: err instanceof Error ? err.message : 'square refund failed',
      };
    }
  }

  async createPaymentLink(params: CreatePaymentLinkParams): Promise<string | null> {
    const creds = await loadCredentials(params.tenantId, SQUARE_ID);
    const res = await postJson<PaymentLinkResponse>(
      `${baseUrl(creds.environment)}/v2/online-checkout/payment-links`,
      {
        idempotency_key: params.invoiceId,
        quick_pay: {
          name: params.description,
          price_money: { amount: params.amount, currency: params.currency.toUpperCase() },
          location_id: creds.publicMeta.location_id,
        },
        checkout_options: { redirect_url: params.successUrl },
      },
      { authorization: `Bearer ${creds.secrets.access_token}`, 'square-version': SQUARE_VERSION }
    );
    return res.payment_link.url;
  }

  // ── Stored methods (docs/142 §5) ───────────────────────────────────────────
  //
  // Square has no server-created "setup intent". Its Web Payments SDK runs in the
  // browser (mounted with the application id + location id below), collects the
  // card, and hands back a single-use token; the SERVER then exchanges that for a
  // permanent card-on-file via the Cards API. So `createSetupSession` returns no
  // client secret and no redirect — only the keys the SDK needs — and the real
  // work happens in `completeVault`.
  //
  // Checkout stays a hosted redirect (Square's page, sparx at SAQ-A). This is a
  // second, narrower browser surface used ONLY to vault a card, which is the one
  // thing a hosted redirect page cannot do for later use.

  async createSetupSession(params: CreateSetupSessionParams): Promise<SetupSession> {
    const creds = await loadCredentials(params.tenantId, SQUARE_ID);
    const customerRef = params.customerRef ?? (await this.ensureCustomer(creds, params));
    return {
      clientSecret: null,
      redirectUrl: null,
      publishableKey: creds.publicMeta.application_id ?? '',
      customerRef,
      // Square's flow is token-in, so there is no server-side object to point
      // back at. The customer ref doubles as the correlation id.
      setupRef: customerRef,
    };
  }

  async completeVault(params: CompleteVaultParams): Promise<VaultedMethod | null> {
    // No token means the shopper never completed the SDK's card form.
    if (!params.token) return null;

    const creds = await loadCredentials(params.tenantId, SQUARE_ID);
    const customerRef =
      params.customerRef ??
      (await this.ensureCustomer(creds, {
        tenantId: params.tenantId,
        customerId: params.customerId,
      }));

    const res = await postJson<{
      card: {
        id: string;
        card_brand?: string;
        last_4?: string;
        exp_month?: number;
        exp_year?: number;
      };
    }>(
      `${baseUrl(creds.environment)}/v2/cards`,
      {
        // Square caps this at 45 characters and rejects anything longer. The
        // token is what makes it unique, so it is what survives the truncation.
        idempotency_key: idempotency(`${params.customerId}-${params.token}`),
        source_id: params.token,
        card: {
          customer_id: customerRef,
          // REQUIRED by CreateCard. Square rejects the request without it, so
          // the fallback is a real value rather than an empty string — a card
          // saved under "Cardholder" is recoverable, a failed vault is a
          // shopper who could not save their card at all. An all-whitespace
          // name has to fall back too, which is why this is not `??`.
          cardholder_name: cardholderName(params.cardholderName),
          // Square matches this against the postal code entered in the payment
          // form; sending a WRONG one fails the vault, so it is only sent when
          // the caller actually knows it.
          ...(params.postalCode ? { billing_address: { postal_code: params.postalCode } } : {}),
          reference_id: params.customerId.slice(0, 40),
        },
      },
      { authorization: `Bearer ${creds.secrets.access_token}`, 'square-version': SQUARE_VERSION }
    );

    return {
      methodRef: res.card.id,
      customerRef,
      brand: res.card.card_brand ?? null,
      last4: res.card.last_4 ?? null,
      expMonth: res.card.exp_month ?? null,
      expYear: res.card.exp_year ?? null,
    };
  }

  async chargeStoredMethod(params: ChargeStoredMethodParams): Promise<StoredChargeResult> {
    try {
      const creds = await loadCredentials(params.tenantId, SQUARE_ID);
      const res = await postJson<{ payment: { id: string; status: string } }>(
        `${baseUrl(creds.environment)}/v2/payments`,
        {
          idempotency_key: idempotency(params.idempotencyKey),
          source_id: params.methodRef,
          // NOT optional for a card-on-file charge: Square's CreatePayment docs
          // state customer_id is "Required if the source_id refers to a card on
          // file created using the Cards API". Every charge from this method is
          // exactly that.
          customer_id: params.customerRef ?? undefined,
          amount_money: {
            amount: params.amount,
            currency: params.currency.toUpperCase(),
          },
          location_id: creds.publicMeta.location_id,
          autocomplete: true,
          // Square's flag for "the cardholder is not here", and it lives on the
          // `customer_details` OBJECT — not at the top level, where it was
          // silently ignored and the issuer therefore saw a scheduled renewal as
          // a stranger keying in a card number. Added to CreatePayment in
          // Square's 2023-08-16 API release.
          customer_details: { customer_initiated: false, seller_keyed_in: false },
          ...(params.orderId ? { reference_id: params.orderId.slice(0, 40) } : {}),
        },
        { authorization: `Bearer ${creds.secrets.access_token}`, 'square-version': SQUARE_VERSION }
      );

      const status = res.payment.status;
      // COMPLETED is the expected outcome with autocomplete: true. APPROVED is
      // authorised-not-captured, which should not happen here — but the money IS
      // guaranteed, so failing the renewal over it would dun a customer whose
      // card worked.
      if (status === 'COMPLETED' || status === 'APPROVED') {
        return { status: 'succeeded', paymentRef: res.payment.id };
      }
      return {
        status: 'failed',
        paymentRef: res.payment.id,
        failureCode: status,
        failureReason: `Square returned ${status}.`,
      };
    } catch (err) {
      // Codes read as DATA off the error body, not matched as substrings of a
      // formatted message — `INVALID_CARD` appearing inside an unrelated
      // sentence used to be enough to declare a working card dead.
      const dead = err instanceof GatewayApiError && err.hasCode(SQUARE_PERMANENT_CODES);
      return {
        status: 'failed',
        paymentRef: null,
        failureCode:
          err instanceof GatewayApiError ? (err.codes[0] ?? 'square_error') : 'square_error',
        failureReason: err instanceof Error ? err.message : 'square charge failed',
        ...(dead ? { methodDead: true } : {}),
      };
    }
  }

  /** A Square customer to hang cards off. Square requires one — a card-on-file
   *  is created against a customer, never standalone. */
  private async ensureCustomer(
    creds: Awaited<ReturnType<typeof loadCredentials>>,
    params: { tenantId: string; customerId: string }
  ): Promise<string> {
    const res = await postJson<{ customer: { id: string } }>(
      `${baseUrl(creds.environment)}/v2/customers`,
      {
        idempotency_key: `${params.tenantId}-${params.customerId}`.slice(0, 45),
        reference_id: params.customerId,
        note: `sparx tenant ${params.tenantId}`,
      },
      { authorization: `Bearer ${creds.secrets.access_token}`, 'square-version': SQUARE_VERSION }
    );
    return res.customer.id;
  }

  // Square signs webhooks with HMAC-SHA256 over (notificationUrl + rawBody) using the
  // subscription's signature key. The route resolves the tenant from its path, then
  // calls parseWebhookForTenant (the body alone doesn't carry our tenant).
  verifyWebhookSignature(): boolean {
    return false;
  }
  parseWebhook(): Promise<ParsedWebhookEvent> {
    return Promise.reject(new Error('square parses per-tenant — use parseWebhookForTenant'));
  }

  async parseWebhookForTenant(
    tenantId: string,
    event: WebhookEvent,
    notificationUrl: string
  ): Promise<ParsedWebhookEvent> {
    const creds = await loadCredentials(tenantId, SQUARE_ID);
    const sigKey = creds.secrets.webhook_signature_key;
    if (sigKey) {
      const expected = createHmac('sha256', sigKey)
        .update(notificationUrl + event.rawBody.toString('utf8'))
        .digest('base64');
      const ok =
        expected.length === event.signature.length &&
        timingSafeEqual(Buffer.from(expected), Buffer.from(event.signature));
      if (!ok) throw new Error('square webhook signature mismatch');
    }
    return normalizeSquareEvent(
      JSON.parse(event.rawBody.toString('utf8')) as SquareEventEnvelope,
      tenantId
    );
  }
}

interface SquareEventEnvelope {
  event_id?: string;
  type?: string;
  data?: { object?: { payment?: SquarePayment; refund?: SquareRefund } };
}
interface SquarePayment {
  id: string;
  status?: string;
  order_id?: string;
  amount_money?: { amount: number; currency: string };
}
interface SquareRefund {
  id: string;
  payment_id: string;
  amount_money?: { amount: number; currency: string };
}

/** Normalize a Square webhook into the platform vocabulary (docs/111 D5). */
export function normalizeSquareEvent(
  evt: SquareEventEnvelope,
  tenantId: string
): ParsedWebhookEvent {
  const base = {
    externalId: evt.event_id ?? '',
    providerEventType: evt.type ?? 'unknown',
    payload: evt,
    tenantId,
  };
  const payment = evt.data?.object?.payment;
  const refund = evt.data?.object?.refund;

  if (evt.type === 'payment.updated' && payment) {
    const succeeded = payment.status === 'COMPLETED' || payment.status === 'CAPTURED';
    return {
      ...base,
      type: succeeded
        ? 'payment.succeeded'
        : payment.status === 'FAILED'
          ? 'payment.failed'
          : 'ignored',
      data: {
        chargeId: payment.order_id ?? payment.id,
        amountCents: payment.amount_money?.amount ?? 0,
        currency: payment.amount_money?.currency ?? 'USD',
      },
    };
  }
  if (evt.type === 'refund.updated' && refund) {
    return {
      ...base,
      type: 'payment.refunded',
      data: {
        chargeId: refund.payment_id,
        amountCents: refund.amount_money?.amount ?? 0,
        currency: refund.amount_money?.currency ?? 'USD',
        refundId: refund.id,
        refundedCents: refund.amount_money?.amount ?? 0,
      },
    };
  }
  return { ...base, type: 'ignored' };
}
