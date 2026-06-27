// Authorize.net gateway (docs/111) — the merchant's own Authorize.net account.
// Bring-your-own: sparx requests an Accept Hosted payment page token and the storefront
// posts it to Authorize.net's hosted page (a form POST, not a GET — so the redirect
// contract carries the token in `clientSecret` and the hosted endpoint in `redirectUrl`;
// the storefront auto-submits). Card data is Authorize.net's, sparx stays SAQ-A. No
// sparx fee. REST/JSON over `fetch` (no SDK).
//
// Live exercise is the go-live strand (docs/111 §4): a SANDBOX account
// (apitest.authorize.net + test.authorize.net) — token → hosted-pay → webhook → refund.

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

export const AUTHORIZE_NET_ID = 'authorize_net';

function apiUrl(env: string): string {
  return env === 'sandbox'
    ? 'https://apitest.authorize.net/xml/v1/request.api'
    : 'https://api.authorize.net/xml/v1/request.api';
}

function hostedPageUrl(env: string): string {
  return env === 'sandbox'
    ? 'https://test.authorize.net/payment/payment'
    : 'https://accept.authorize.net/payment/payment';
}

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

interface AnetMessages {
  messages: { resultCode: string; message: { code: string; text: string }[] };
}

export class AuthorizeNetGateway implements PaymentGateway {
  readonly id = AUTHORIZE_NET_ID;
  readonly name = 'Authorize.net';

  private auth(creds: { secrets: Record<string, string>; publicMeta: Record<string, string> }) {
    return { name: creds.publicMeta.api_login_id, transactionKey: creds.secrets.transaction_key };
  }

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent> {
    const creds = await loadCredentials(params.tenantId, AUTHORIZE_NET_ID);
    const ref = orderReference(params);

    const body = {
      getHostedPaymentPageRequest: {
        merchantAuthentication: this.auth(creds),
        transactionRequest: {
          transactionType: 'authCaptureTransaction',
          amount: dollars(params.amount),
          order: { invoiceNumber: ref.slice(0, 20), description: `sparx order ${ref}` },
        },
        hostedPaymentSettings: {
          setting: [
            {
              settingName: 'hostedPaymentReturnOptions',
              settingValue: JSON.stringify({
                showReceipt: false,
                url: params.returnUrl ?? '',
                urlText: 'Continue',
                cancelUrl: params.cancelUrl ?? '',
                cancelUrlText: 'Cancel',
              }),
            },
            {
              settingName: 'hostedPaymentButtonOptions',
              settingValue: JSON.stringify({ text: 'Pay' }),
            },
          ],
        },
      },
    };

    const res = await postJson<{ token: string } & AnetMessages>(apiUrl(creds.environment), body);
    if (res.messages.resultCode !== 'Ok' || !res.token) {
      throw new Error(`authorize_net token error: ${res.messages.message?.[0]?.text ?? 'unknown'}`);
    }

    return {
      id: ref,
      // The storefront POSTs this token to `redirectUrl` (Accept Hosted needs a form
      // POST, not a GET — docs/111 D4); inline gateways leave clientSecret for Elements.
      clientSecret: res.token,
      redirectUrl: hostedPageUrl(creds.environment),
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
      errorMessage: 'authorize_net confirms on its hosted page',
    });
  }
  capturePayment(): Promise<PaymentResult> {
    return Promise.resolve({
      success: false,
      errorMessage: 'authorize_net capture not supported here',
    });
  }
  cancelPayment(): Promise<PaymentResult> {
    return Promise.resolve({
      success: false,
      errorMessage: 'authorize_net cancel not supported here',
    });
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    // Authorize.net refunds require the original transaction id + the card's last 4 +
    // expiration; the caller passes last4 in metadata (stored at capture). Without it,
    // a refund cannot be issued via the API — surfaced honestly, not silently swallowed.
    const last4 = params.metadata?.last4;
    if (!last4) {
      return {
        success: false,
        amount: params.amount ?? 0,
        errorMessage: 'authorize_net refund requires the card last4 (metadata.last4)',
      };
    }
    try {
      const creds = await loadCredentials(params.tenantId, AUTHORIZE_NET_ID);
      const body = {
        createTransactionRequest: {
          merchantAuthentication: this.auth(creds),
          transactionRequest: {
            transactionType: 'refundTransaction',
            ...(params.amount !== undefined ? { amount: dollars(params.amount) } : {}),
            payment: { creditCard: { cardNumber: last4, expirationDate: 'XXXX' } },
            refTransId: params.chargeId,
          },
        },
      };
      const res = await postJson<
        { transactionResponse?: { transId?: string; responseCode?: string } } & AnetMessages
      >(apiUrl(creds.environment), body);
      const txn = res.transactionResponse;
      if (res.messages.resultCode !== 'Ok' || !txn?.transId) {
        throw new Error(res.messages.message?.[0]?.text ?? 'refund declined');
      }
      return { success: true, refundId: txn.transId, amount: params.amount ?? 0 };
    } catch (err) {
      return {
        success: false,
        amount: params.amount ?? 0,
        errorMessage: err instanceof Error ? err.message : 'authorize_net refund failed',
      };
    }
  }

  // Authorize.net has no per-invoice hosted link distinct from the checkout token flow;
  // an invoice is paid through the same hosted page created at intent time.
  createPaymentLink(): Promise<string | null> {
    return Promise.resolve(null);
  }

  verifyWebhookSignature(): boolean {
    return false;
  }
  parseWebhook(): Promise<ParsedWebhookEvent> {
    return Promise.reject(new Error('authorize_net parses per-tenant — use parseWebhookForTenant'));
  }

  // Authorize.net signs webhooks `X-ANET-Signature: sha512=HEX` (HMAC-SHA512 of the raw
  // body with the Signature Key). The route resolves the tenant from its path.
  async parseWebhookForTenant(tenantId: string, event: WebhookEvent): Promise<ParsedWebhookEvent> {
    const creds = await loadCredentials(tenantId, AUTHORIZE_NET_ID);
    const sigKey = creds.secrets.signature_key;
    if (sigKey) {
      const expected = createHmac('sha512', Buffer.from(sigKey, 'hex'))
        .update(event.rawBody)
        .digest('hex')
        .toUpperCase();
      const got = event.signature.replace(/^sha512=/i, '').toUpperCase();
      const ok =
        expected.length === got.length && timingSafeEqual(Buffer.from(expected), Buffer.from(got));
      if (!ok) throw new Error('authorize_net webhook signature mismatch');
    }
    return normalizeAuthorizeNetEvent(
      JSON.parse(event.rawBody.toString('utf8')) as AnetWebhook,
      tenantId
    );
  }
}

interface AnetWebhook {
  notificationId?: string;
  eventType?: string;
  payload?: { id?: string; authAmount?: number; invoiceNumber?: string };
}

/** Normalize an Authorize.net webhook into the platform vocabulary (docs/111 D5).
 *  Amounts arrive in dollars; we convert to cents. */
export function normalizeAuthorizeNetEvent(evt: AnetWebhook, tenantId: string): ParsedWebhookEvent {
  const base = {
    externalId: evt.notificationId ?? '',
    providerEventType: evt.eventType ?? 'unknown',
    payload: evt,
    tenantId,
  };
  const id = evt.payload?.invoiceNumber ?? evt.payload?.id ?? '';
  const amountCents = Math.round((evt.payload?.authAmount ?? 0) * 100);

  switch (evt.eventType) {
    case 'net.authorize.payment.authcapture.created':
    case 'net.authorize.payment.capture.created':
    case 'net.authorize.payment.priorAuthCapture.created':
      return {
        ...base,
        type: 'payment.succeeded',
        data: { chargeId: id, amountCents, currency: 'USD' },
      };
    case 'net.authorize.payment.refund.created':
      return {
        ...base,
        type: 'payment.refunded',
        data: {
          chargeId: id,
          amountCents,
          currency: 'USD',
          refundId: evt.payload?.id ?? '',
          refundedCents: amountCents,
        },
      };
    case 'net.authorize.payment.void.created':
    case 'net.authorize.payment.fraud.declined':
      return {
        ...base,
        type: 'payment.failed',
        data: { chargeId: id, amountCents, currency: 'USD' },
      };
    default:
      return { ...base, type: 'ignored' };
  }
}
