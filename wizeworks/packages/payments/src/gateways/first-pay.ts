// 1stPayGateway (docs/111) — the merchant's own 1stPayGateway / Transaction Center.
// Bring-your-own: sparx redirects the shopper to a 1stPay hosted payment page and
// reconciles on the inbound transaction webhook; refunds go through the 1stPay REST
// gateway. Card data is 1stPay's, sparx stays SAQ-A. No sparx fee. REST over `fetch`
// (no SDK).
//
// Endpoint shapes follow the 1stPayGateway REST gateway (secure.1stpaygateway.net);
// the exact hosted-setup + webhook field names are confirmed at go-live (docs/111 §4)
// against the 1stPay test Transaction Center.

import { createHmac, timingSafeEqual } from 'node:crypto';

import type {
  CreatePaymentIntentParams,
  PaymentGateway,
  PaymentIntent,
  PaymentResult,
  ParsedWebhookEvent,
  RefundParams,
  RefundResult,
  WebhookEvent,
} from '../gateway';
import { loadCredentials, orderReference, postJson } from './adapter-util';

export const FIRST_PAY_ID = 'first_pay';

const REST_BASE = 'https://secure.1stpaygateway.net/secure/RestGW/Gateway/Transaction';
const HOSTED_BASE = 'https://secure.1stpaygateway.net/secure/HostedPayment';

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export class FirstPayGateway implements PaymentGateway {
  readonly id = FIRST_PAY_ID;
  readonly name = '1stPayGateway';

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent> {
    const creds = await loadCredentials(params.tenantId, FIRST_PAY_ID);
    const gatewayId = creds.publicMeta.gateway_id;
    if (!gatewayId) throw new Error('1stPay gateway has no Transaction Center ID configured');
    const reference = orderReference(params);

    const u = new URL(HOSTED_BASE);
    u.searchParams.set('gateway', gatewayId);
    u.searchParams.set('amount', dollars(params.amount));
    u.searchParams.set('reference', reference);
    if (params.returnUrl) u.searchParams.set('return_url', params.returnUrl);
    if (params.cancelUrl) u.searchParams.set('cancel_url', params.cancelUrl);

    return {
      id: reference,
      clientSecret: '',
      redirectUrl: u.toString(),
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
    return Promise.resolve({ success: false, errorMessage: '1stPay confirms on its hosted page' });
  }
  capturePayment(): Promise<PaymentResult> {
    return Promise.resolve({ success: false, errorMessage: '1stPay capture not supported here' });
  }
  cancelPayment(): Promise<PaymentResult> {
    return Promise.resolve({ success: false, errorMessage: '1stPay cancel not supported here' });
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    try {
      const creds = await loadCredentials(params.tenantId, FIRST_PAY_ID);
      const res = await postJson<{
        isError?: boolean;
        errorMessages?: string[];
        data?: { refundId?: string };
      }>(`${REST_BASE}/Refund`, {
        merchantKey: creds.publicMeta.gateway_id,
        processorId: creds.secrets.api_key,
        transactionId: params.chargeId,
        ...(params.amount !== undefined ? { transactionAmount: dollars(params.amount) } : {}),
      });
      if (res.isError || !res.data?.refundId) {
        throw new Error(res.errorMessages?.[0] ?? '1stPay refund declined');
      }
      return { success: true, refundId: res.data.refundId, amount: params.amount ?? 0 };
    } catch (err) {
      return {
        success: false,
        amount: params.amount ?? 0,
        errorMessage: err instanceof Error ? err.message : '1stPay refund failed',
      };
    }
  }

  createPaymentLink(): Promise<string | null> {
    return Promise.resolve(null);
  }

  verifyWebhookSignature(): boolean {
    return false;
  }
  parseWebhook(): Promise<ParsedWebhookEvent> {
    return Promise.reject(new Error('1stPay parses per-tenant — use parseWebhookForTenant'));
  }

  async parseWebhookForTenant(tenantId: string, event: WebhookEvent): Promise<ParsedWebhookEvent> {
    const creds = await loadCredentials(tenantId, FIRST_PAY_ID);
    const secret = creds.secrets.api_key;
    if (secret) {
      const expected = createHmac('sha256', secret).update(event.rawBody).digest('hex');
      const got = event.signature.replace(/^sha256=/i, '');
      const ok =
        got.length === expected.length && timingSafeEqual(Buffer.from(expected), Buffer.from(got));
      if (!ok) throw new Error('1stPay webhook signature mismatch');
    }
    return normalizeFirstPayEvent(
      JSON.parse(event.rawBody.toString('utf8')) as FirstPayWebhook,
      tenantId
    );
  }
}

interface FirstPayWebhook {
  eventId?: string;
  status?: string;
  reference?: string;
  transactionId?: string;
  amount?: number;
  currency?: string;
  refundId?: string;
}

/** Normalize a 1stPayGateway transaction webhook into the platform vocabulary. */
export function normalizeFirstPayEvent(evt: FirstPayWebhook, tenantId: string): ParsedWebhookEvent {
  const base = {
    externalId: evt.eventId ?? `${evt.transactionId ?? ''}:${evt.status ?? ''}`,
    providerEventType: evt.status ?? 'unknown',
    payload: evt,
    tenantId,
  };
  const chargeId = evt.reference ?? evt.transactionId ?? '';
  const amountCents = Math.round((evt.amount ?? 0) * 100);
  const currency = (evt.currency ?? 'USD').toUpperCase();

  switch (evt.status) {
    case 'approved':
    case 'captured':
    case 'settled':
      return { ...base, type: 'payment.succeeded', data: { chargeId, amountCents, currency } };
    case 'declined':
    case 'failed':
      return { ...base, type: 'payment.failed', data: { chargeId, amountCents, currency } };
    case 'refunded':
      return {
        ...base,
        type: 'payment.refunded',
        data: {
          chargeId,
          amountCents,
          currency,
          refundId: evt.refundId ?? '',
          refundedCents: amountCents,
        },
      };
    default:
      return { ...base, type: 'ignored' };
  }
}
