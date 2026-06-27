// Custom gateway (docs/111 §1 D6) — the generic bring-your-own path for any processor
// sparx has no first-class adapter for. The tenant configures their gateway's hosted
// checkout URL (+ optional api key / webhook secret); sparx redirects the shopper there
// with the amount, a reference, and a return URL, and reconciles on the inbound webhook.
// No per-vendor code, SAQ-A (the card form is the processor's). For full control a
// developer implements PaymentGateway directly — this is the no-code path.
//
// The processor must POST sparx a webhook in this shape (signed with the webhook secret,
// `X-Sparx-Signature: <hex hmac-sha256 of the raw body>` when a secret is set):
//   { "event": "payment.succeeded" | "payment.failed" | "payment.refunded",
//     "charge_id": "<your charge id>", "reference": "<the sparx reference>",
//     "amount_cents": 1234, "currency": "USD", "refund_id"?: "<id>" }

import { createHmac, timingSafeEqual } from 'node:crypto';

import type {
  CreatePaymentIntentParams,
  CreatePaymentLinkParams,
  PaymentGateway,
  PaymentIntent,
  PaymentResult,
  ParsedWebhookEvent,
  RefundResult,
  WebhookEvent,
} from '../gateway';
import { loadCredentials, orderReference } from './adapter-util';

export const CUSTOM_ID = 'custom';

function buildHostedUrl(
  hostedUrl: string,
  params: {
    amountCents: number;
    currency: string;
    reference: string;
    returnUrl?: string;
    cancelUrl?: string;
  }
): string {
  const u = new URL(hostedUrl);
  u.searchParams.set('amount', String(params.amountCents));
  u.searchParams.set('currency', params.currency.toUpperCase());
  u.searchParams.set('reference', params.reference);
  if (params.returnUrl) u.searchParams.set('return_url', params.returnUrl);
  if (params.cancelUrl) u.searchParams.set('cancel_url', params.cancelUrl);
  return u.toString();
}

export class CustomRedirectGateway implements PaymentGateway {
  readonly id = CUSTOM_ID;
  readonly name = 'Custom gateway';

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent> {
    const creds = await loadCredentials(params.tenantId, CUSTOM_ID);
    const hostedUrl = creds.publicMeta.hosted_url;
    if (!hostedUrl) throw new Error('custom gateway has no hosted_url configured');
    const reference = orderReference(params);
    return {
      id: reference,
      clientSecret: '',
      redirectUrl: buildHostedUrl(hostedUrl, {
        amountCents: params.amount,
        currency: params.currency,
        reference,
        ...(params.returnUrl ? { returnUrl: params.returnUrl } : {}),
        ...(params.cancelUrl ? { cancelUrl: params.cancelUrl } : {}),
      }),
      amount: params.amount,
      currency: params.currency,
      status: 'requires_action',
      metadata: {
        tenantId: params.tenantId,
        ...(params.orderId ? { orderId: params.orderId } : {}),
      },
    };
  }

  confirmPayment(): Promise<PaymentResult> {
    return Promise.resolve({
      success: false,
      errorMessage: 'custom gateway confirms on its hosted page',
    });
  }
  capturePayment(): Promise<PaymentResult> {
    return Promise.resolve({
      success: false,
      errorMessage: 'custom gateway capture not supported',
    });
  }
  cancelPayment(): Promise<PaymentResult> {
    return Promise.resolve({ success: false, errorMessage: 'custom gateway cancel not supported' });
  }

  // Refunds vary per processor — the no-code path can't issue them generically. A
  // developer who needs API refunds implements a real PaymentGateway adapter instead.
  refund(): Promise<RefundResult> {
    return Promise.resolve({
      success: false,
      amount: 0,
      errorMessage: 'custom gateway refunds are issued at your processor',
    });
  }

  async createPaymentLink(params: CreatePaymentLinkParams): Promise<string | null> {
    const creds = await loadCredentials(params.tenantId, CUSTOM_ID);
    const hostedUrl = creds.publicMeta.hosted_url;
    if (!hostedUrl) return null;
    return buildHostedUrl(hostedUrl, {
      amountCents: params.amount,
      currency: params.currency,
      reference: params.invoiceId,
      returnUrl: params.successUrl,
    });
  }

  verifyWebhookSignature(): boolean {
    return false;
  }
  parseWebhook(): Promise<ParsedWebhookEvent> {
    return Promise.reject(
      new Error('custom gateway parses per-tenant — use parseWebhookForTenant')
    );
  }

  async parseWebhookForTenant(tenantId: string, event: WebhookEvent): Promise<ParsedWebhookEvent> {
    const creds = await loadCredentials(tenantId, CUSTOM_ID);
    const secret = creds.secrets.webhook_secret;
    if (secret) {
      const expected = createHmac('sha256', secret).update(event.rawBody).digest('hex');
      const got = event.signature.replace(/^sha256=/i, '');
      const ok =
        expected.length === got.length && timingSafeEqual(Buffer.from(expected), Buffer.from(got));
      if (!ok) throw new Error('custom gateway webhook signature mismatch');
    }
    return normalizeCustomEvent(
      JSON.parse(event.rawBody.toString('utf8')) as CustomWebhook,
      tenantId
    );
  }
}

interface CustomWebhook {
  event?: string;
  charge_id?: string;
  reference?: string;
  amount_cents?: number;
  currency?: string;
  refund_id?: string;
}

/** Normalize the sparx-defined custom webhook (docs/111 D6) into the platform vocabulary. */
export function normalizeCustomEvent(evt: CustomWebhook, tenantId: string): ParsedWebhookEvent {
  const base = {
    externalId: `${evt.charge_id ?? evt.reference ?? ''}:${evt.event ?? ''}`,
    providerEventType: evt.event ?? 'unknown',
    payload: evt,
    tenantId,
  };
  const chargeId = evt.reference ?? evt.charge_id ?? '';
  const amountCents = evt.amount_cents ?? 0;
  const currency = (evt.currency ?? 'USD').toUpperCase();

  switch (evt.event) {
    case 'payment.succeeded':
      return { ...base, type: 'payment.succeeded', data: { chargeId, amountCents, currency } };
    case 'payment.failed':
      return { ...base, type: 'payment.failed', data: { chargeId, amountCents, currency } };
    case 'payment.refunded':
      return {
        ...base,
        type: 'payment.refunded',
        data: {
          chargeId,
          amountCents,
          currency,
          refundId: evt.refund_id ?? '',
          refundedCents: amountCents,
        },
      };
    default:
      return { ...base, type: 'ignored' };
  }
}
