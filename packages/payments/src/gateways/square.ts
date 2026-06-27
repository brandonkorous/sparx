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
import { loadCredentials, orderReference, postJson } from './adapter-util';

export const SQUARE_ID = 'square';

const SQUARE_VERSION = '2024-10-17';

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
