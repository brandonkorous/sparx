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
  ChargeStoredMethodParams,
  CompleteVaultParams,
  CreatePaymentIntentParams,
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
import { loadCredentials, orderReference, postJson } from './adapter-util';

export const AUTHORIZE_NET_ID = 'authorize_net';

/** Authorize.net response codes that mean the stored card will never work
 *  again, so the dunning ladder should stop rather than spend its remaining
 *  attempts proving it. */
const ANET_PERMANENT_ERROR_CODES = new Set([
  '6', // invalid card number
  '7', // invalid expiration date
  '8', // card has expired
  '11', // duplicate transaction
  '37', // card number invalid
  '45', // card code / AVS mismatch, permanently blocked
  '54', // referenced transaction does not meet refund criteria
  '315', // invalid card number
  '316', // invalid expiration date
  '317', // card has expired
]);

/** Accept.js hands the browser a `{ dataDescriptor, dataValue }` pair; the
 *  storefront forwards it as a JSON string. Anything else is a caller wiring
 *  mistake, and a null return keeps that from becoming an unhandled throw in the
 *  middle of a card-saving flow. */
function parseOpaqueData(token: string): { dataDescriptor: string; dataValue: string } | null {
  try {
    const parsed = JSON.parse(token) as { dataDescriptor?: string; dataValue?: string };
    if (!parsed.dataDescriptor || !parsed.dataValue) return null;
    return { dataDescriptor: parsed.dataDescriptor, dataValue: parsed.dataValue };
  } catch {
    return null;
  }
}

/** Authorize.net answers 200 OK with `resultCode: 'Error'` in the body, so a
 *  non-throwing `postJson` is not the same as a success. */
function assertAnetOk(res: AnetMessages, action: string): void {
  if (res.messages?.resultCode === 'Ok') return;
  const message = res.messages?.message?.[0]?.text ?? 'unknown error';
  throw new Error(`Authorize.net could not ${action}: ${message}`);
}

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

  // ── Stored methods (docs/142 §5) ─────────────────────────────────────────────
  //
  // Authorize.net's Customer Information Manager. Like Square and unlike Stripe
  // there is no server-created setup object: Accept.js runs in the browser with
  // the API Login ID + Public Client Key, exchanges the card for one-time
  // `opaqueData`, and the SERVER turns that into a permanent customer payment
  // profile. So `methodRef` is a customerPaymentProfileId and `customerRef` is
  // the customerProfileId it lives inside — a charge needs both.
  //
  // Requires `public_client_key` to be configured. Without it Accept.js cannot
  // mount, so this reports itself unavailable and subscriptions invoice instead
  // of failing.

  async createSetupSession(params: CreateSetupSessionParams): Promise<SetupSession> {
    const creds = await loadCredentials(params.tenantId, AUTHORIZE_NET_ID);
    const clientKey = creds.publicMeta.public_client_key;
    if (!clientKey) {
      throw new Error(
        'Saving a card on Authorize.net needs the Public Client Key. Add it under Finance → Payments to let customers set up repeat orders.'
      );
    }
    return {
      clientSecret: null,
      redirectUrl: null,
      // Accept.js needs BOTH the login id and the client key. The login id is
      // already public (it identifies the merchant on the hosted page), so
      // pairing them here is safe and saves the storefront a second lookup.
      publishableKey: `${creds.publicMeta.api_login_id}:${clientKey}`,
      customerRef: params.customerRef ?? '',
      setupRef: params.customerId,
    };
  }

  async completeVault(params: CompleteVaultParams): Promise<VaultedMethod | null> {
    // No opaque data means the shopper never finished Accept.js.
    if (!params.token) return null;

    const creds = await loadCredentials(params.tenantId, AUTHORIZE_NET_ID);
    const opaque = parseOpaqueData(params.token);
    if (!opaque) return null;

    const payment = { opaqueData: opaque };

    // An existing profile takes a new payment profile; a first-time shopper gets
    // both in one call. Two shapes because Authorize.net has two endpoints, not
    // because the states differ meaningfully.
    if (params.customerRef) {
      const res = await postJson<
        AnetMessages & { customerPaymentProfileId?: string; validationDirectResponse?: string }
      >(apiUrl(creds.environment), {
        createCustomerPaymentProfileRequest: {
          merchantAuthentication: this.auth(creds),
          customerProfileId: params.customerRef,
          paymentProfile: { payment },
          validationMode: 'liveMode',
        },
      });
      assertAnetOk(res, 'save this card');
      if (!res.customerPaymentProfileId) return null;
      return this.readProfile(creds, params.customerRef, res.customerPaymentProfileId);
    }

    const res = await postJson<
      AnetMessages & {
        customerProfileId?: string;
        customerPaymentProfileIdList?: string[];
      }
    >(apiUrl(creds.environment), {
      createCustomerProfileRequest: {
        merchantAuthentication: this.auth(creds),
        profile: {
          merchantCustomerId: params.customerId.slice(0, 20),
          paymentProfiles: { customerType: 'individual', payment },
        },
        validationMode: 'liveMode',
      },
    });
    assertAnetOk(res, 'save this card');

    const profileId = res.customerProfileId;
    const paymentProfileId = res.customerPaymentProfileIdList?.[0];
    if (!profileId || !paymentProfileId) return null;
    return this.readProfile(creds, profileId, paymentProfileId);
  }

  async chargeStoredMethod(params: ChargeStoredMethodParams): Promise<StoredChargeResult> {
    try {
      const creds = await loadCredentials(params.tenantId, AUTHORIZE_NET_ID);
      if (!params.customerRef) {
        return {
          status: 'failed',
          paymentRef: null,
          failureCode: 'missing_profile',
          failureReason: 'The saved card is missing its customer profile.',
          // Unrecoverable without re-vaulting, so do not burn the retry ladder.
          methodDead: true,
        };
      }

      const res = await postJson<
        AnetMessages & {
          transactionResponse?: {
            responseCode?: string;
            transId?: string;
            errors?: { errorCode: string; errorText: string }[];
          };
        }
      >(apiUrl(creds.environment), {
        createTransactionRequest: {
          merchantAuthentication: this.auth(creds),
          refId: params.idempotencyKey.slice(0, 20),
          transactionRequest: {
            transactionType: 'authCaptureTransaction',
            amount: dollars(params.amount),
            profile: {
              customerProfileId: params.customerRef,
              paymentProfile: { paymentProfileId: params.methodRef },
            },
            order: { invoiceNumber: (params.orderId ?? '').slice(0, 20) },
            // Tells the issuer this is a scheduled charge against a stored
            // mandate rather than a stranger with the card number — the same
            // signal as Stripe's `off_session`, and what keeps decline rates
            // where they should be.
            processingOptions: { isSubsequentAuth: true },
            subsequentAuthInformation: { reason: 'resubmission', originalNetworkTransId: '' },
          },
        },
      });

      const tx = res.transactionResponse;
      // responseCode 1 = approved, 4 = held for review (money is captured
      // pending the merchant's own fraud check — a success from our side).
      if (tx?.responseCode === '1' || tx?.responseCode === '4') {
        return { status: 'succeeded', paymentRef: tx.transId ?? null };
      }

      const error = tx?.errors?.[0];
      return {
        status: 'failed',
        paymentRef: tx?.transId ?? null,
        failureCode: error?.errorCode ?? `response_${tx?.responseCode ?? 'unknown'}`,
        failureReason: error?.errorText ?? 'The card was declined.',
        ...(error && ANET_PERMANENT_ERROR_CODES.has(error.errorCode) ? { methodDead: true } : {}),
      };
    } catch (err) {
      return {
        status: 'failed',
        paymentRef: null,
        failureCode: 'authorize_net_error',
        failureReason: err instanceof Error ? err.message : 'authorize_net charge failed',
      };
    }
  }

  /** Read a saved profile back for its display metadata. Authorize.net masks the
   *  number to `XXXX1111`, which is all that is wanted anyway. */
  private async readProfile(
    creds: Awaited<ReturnType<typeof loadCredentials>>,
    customerProfileId: string,
    paymentProfileId: string
  ): Promise<VaultedMethod> {
    const base: VaultedMethod = {
      methodRef: paymentProfileId,
      customerRef: customerProfileId,
      brand: null,
      last4: null,
      expMonth: null,
      expYear: null,
    };
    try {
      const res = await postJson<
        AnetMessages & {
          paymentProfile?: {
            payment?: {
              creditCard?: { cardNumber?: string; expirationDate?: string; cardType?: string };
            };
          };
        }
      >(apiUrl(creds.environment), {
        getCustomerPaymentProfileRequest: {
          merchantAuthentication: this.auth(creds),
          customerProfileId,
          customerPaymentProfileId: paymentProfileId,
        },
      });
      const card = res.paymentProfile?.payment?.creditCard;
      if (!card) return base;
      // `XXXX1111` → `1111`; `YYYY-MM` → month + year, or `XXXX` when masked.
      const [year, month] = (card.expirationDate ?? '').split('-');
      // A fully-masked number strips to an empty string, which is NOT a last4 —
      // hence the explicit length check rather than `?? null`, which would keep
      // the empty string and render "Card ending ".
      const digits = (card.cardNumber ?? '').replace(/[^0-9]/g, '').slice(-4);
      return {
        ...base,
        brand: card.cardType ?? null,
        last4: digits.length > 0 ? digits : null,
        expMonth: month && /^\d+$/.test(month) ? Number(month) : null,
        expYear: year && /^\d+$/.test(year) ? Number(year) : null,
      };
    } catch {
      // Display metadata is a nicety; the token is the thing that matters. A
      // card shown as "Card ending ••••" still charges perfectly well.
      return base;
    }
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
