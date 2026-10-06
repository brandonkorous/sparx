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
  LookedUpPayment,
  LookupPaymentParams,
  PaymentGateway,
  PaymentIntent,
  PaymentResult,
  ParsedWebhookEvent,
  RefundParams,
  RefundResult,
  SetupSession,
  StoredChargeResult,
  VaultFromPaymentParams,
  VaultedMethod,
  WebhookEvent,
} from '../gateway';
import { loadCredentials, paymentReference, postJson } from './adapter-util';

export const AUTHORIZE_NET_ID = 'authorize_net';

/**
 * Authorize.net response reason codes that mean this card will never work
 * again, so the dunning ladder should stop and ask for a new one rather than
 * spend four attempts and four decline fees proving it.
 *
 * Three codes were removed from this list after checking them against
 * Authorize.net's published reason codes, because each one was costing a
 * customer a working card:
 *   11 — DUPLICATE TRANSACTION. Not a card problem at all; it usually means our
 *        own idempotency did its job. Marking the card dead here revoked a
 *        perfectly good card because a charge was submitted twice.
 *   45 — AVS/CVV filter decline. A merchant FILTER setting, and documented as a
 *        temporary decline.
 *   54 — "referenced transaction does not meet criteria for refund". A refund
 *        code. It cannot occur on a charge, and says nothing about the card.
 */
const ANET_PERMANENT_ERROR_CODES = new Set([
  '4', // pick up card — lost or stolen
  '6', // invalid credit card number
  '7', // invalid expiration date
  '8', // the credit card has expired
  '37', // the credit card number is invalid
  '315', // invalid credit card number
  '316', // invalid expiration date
  '317', // the credit card has expired
  // 17 / 28 are "the merchant does not accept this card type". Retrying is
  // futile, but a DIFFERENT card would work — which is precisely what
  // `methodDead` asks the customer for, so they belong here even though the
  // fault is the merchant's configuration rather than the card's.
  '17',
  '28',
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

/** How many days of settled batches a payment lookup reads (see `lookupPayment`). */
const LOOKUP_DAYS = 4;
/** How far back a refund looks for a payment that kept no transaction id: the
 *  most Authorize.net lists in one ask. */
const REFUND_SEARCH_DAYS = 31;

/** Authorize.net `transactionStatus` values, from its Transaction Details API. */
const ANET_PAID = new Set(['capturedPendingSettlement', 'settledSuccessfully']);
const ANET_FAILED = new Set([
  'declined',
  'voided',
  'expired',
  'failedReview',
  'generalError',
  'settlementError',
  'communicationError',
  'couldNotVoid',
]);

/** One row of a transaction list. A refund carries the same invoice number as
 *  the payment it gives back, so refunds are not the payment being asked about. */
interface AnetListedTransaction {
  transId: string;
  invoiceNumber?: string;
  transactionStatus?: string;
  settleAmount?: number | string;
}

function paymentFor(
  transactions: AnetListedTransaction[] | undefined,
  invoiceNumber: string
): AnetListedTransaction | undefined {
  return transactions?.find(
    (row) =>
      row.invoiceNumber === invoiceNumber && !(row.transactionStatus ?? '').startsWith('refund')
  );
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
    const ref = paymentReference();

    const body = {
      getHostedPaymentPageRequest: {
        merchantAuthentication: this.auth(creds),
        transactionRequest: {
          transactionType: 'authCaptureTransaction',
          amount: dollars(params.amount),
          order: { invoiceNumber: ref, description: `Order ${ref}` },
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

  /**
   * Give money back.
   *
   * Authorize.net refunds a TRANSACTION, against the card's last 4 digits.
   * Every caller passed our invoice number where the transaction id belongs,
   * and none passed the last 4, so every refund was refused before it was sent
   * (issue 917). The transaction is the one the order's payment kept, or the
   * one carrying our invoice number in the last month; its details give the
   * card's last 4 and whether it has settled.
   *
   * A payment that has not settled yet cannot be refunded at Authorize.net,
   * only cancelled whole (a void), so a full refund before settlement is a
   * void, and a part refund says to wait for settlement.
   */
  async refund(params: RefundParams): Promise<RefundResult> {
    const failed = (errorMessage: string): RefundResult => ({
      success: false,
      amount: params.amount ?? 0,
      errorMessage,
    });
    try {
      const creds = await loadCredentials(params.tenantId, AUTHORIZE_NET_ID);
      const url = apiUrl(creds.environment);
      const merchantAuthentication = this.auth(creds);
      const transId =
        params.transactionRef ??
        (await this.findPayment(creds, params.chargeId, REFUND_SEARCH_DAYS))?.transId;
      if (!transId) {
        return failed(
          'Authorize.net has no record of this payment in the last month. Give the money back from your Authorize.net account instead.'
        );
      }

      const details = await postJson<
        AnetMessages & {
          transaction?: {
            transactionStatus?: string;
            settleAmount?: number | string;
            payment?: { creditCard?: { cardNumber?: string } };
          };
        }
      >(url, { getTransactionDetailsRequest: { merchantAuthentication, transId } });
      assertAnetOk(details, 'find this payment');
      const txn = details.transaction;
      const paidCents = Math.round(Number(txn?.settleAmount ?? 0) * 100);
      const amountCents = params.amount ?? paidCents;

      if (txn?.transactionStatus === 'capturedPendingSettlement') {
        if (amountCents !== paidCents) {
          return failed(
            'This payment has not settled at Authorize.net yet, so today only the whole amount can be given back. Part of it can be given back once it settles, usually overnight.'
          );
        }
        const voided = await postJson<
          { transactionResponse?: { transId?: string } } & AnetMessages
        >(url, {
          createTransactionRequest: {
            merchantAuthentication,
            transactionRequest: { transactionType: 'voidTransaction', refTransId: transId },
          },
        });
        assertAnetOk(voided, 'cancel this payment');
        return {
          success: true,
          refundId: voided.transactionResponse?.transId ?? transId,
          amount: paidCents,
        };
      }

      const last4 = (txn?.payment?.creditCard?.cardNumber ?? params.metadata?.last4 ?? '').slice(
        -4
      );
      const res = await postJson<
        { transactionResponse?: { transId?: string; responseCode?: string } } & AnetMessages
      >(url, {
        createTransactionRequest: {
          merchantAuthentication,
          transactionRequest: {
            transactionType: 'refundTransaction',
            amount: dollars(amountCents),
            payment: { creditCard: { cardNumber: last4, expirationDate: 'XXXX' } },
            refTransId: transId,
          },
        },
      });
      const refund = res.transactionResponse;
      if (res.messages.resultCode !== 'Ok' || !refund?.transId) {
        throw new Error(res.messages.message?.[0]?.text ?? 'refund declined');
      }
      return { success: true, refundId: refund.transId, amount: amountCents };
    } catch (err) {
      return failed(err instanceof Error ? err.message : 'authorize_net refund failed');
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

  /**
   * Keep the card a hosted-page payment was made with (issue 739).
   *
   * Authorize.net makes a stored profile FROM a finished transaction with
   * `createCustomerProfileFromTransactionRequest`: a new customer profile for a
   * first card, or one more payment profile inside an existing one. The hosted
   * page needs no change, and the card is the one the shopper actually paid
   * with. It needs the transaction id, which the webhook reports separately
   * from our invoice reference and the reconciler keeps as `transactionRef`.
   */
  async vaultFromPayment(params: VaultFromPaymentParams): Promise<VaultedMethod | null> {
    if (!params.chargeRef) return null;
    const creds = await loadCredentials(params.tenantId, AUTHORIZE_NET_ID);
    const res = await postJson<
      AnetMessages & { customerProfileId?: string; customerPaymentProfileIdList?: string[] }
    >(apiUrl(creds.environment), {
      createCustomerProfileFromTransactionRequest: {
        merchantAuthentication: this.auth(creds),
        transId: params.chargeRef,
        ...(params.customerRef
          ? { customerProfileId: params.customerRef }
          : { customer: { merchantCustomerId: params.customerId.slice(0, 20) } }),
      },
    });
    assertAnetOk(res, 'keep the card from this payment');
    const profileId = res.customerProfileId ?? params.customerRef;
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

      // ── The stored-credential chain (Authorize.net "Card-On-File") ────────
      //
      // A merchant-initiated charge has to say which transaction ESTABLISHED
      // the stored credential, and the networks enforce it: originalNetworkTransId
      // is required outright for Discover / Diners / JCB / China UnionPay, for
      // Visa on every recurring MIT, and in the EEA for Mastercard. Without it
      // the issuer sees an unmandated charge on a card nobody is holding, which
      // is a soft decline.
      //
      // So the FIRST charge against a newly vaulted card declares itself as the
      // establishing transaction and returns a networkTransId; every later
      // charge quotes it back. Two shapes, one decision:
      const firstCharge = params.isFirstCharge === true || !params.networkTransId;
      const processingOptions = firstCharge
        ? { isFirstRecurringPayment: true }
        : { isSubsequentAuth: true };
      // `reason` is deliberately ABSENT. Its allowed values are resubmission /
      // reauthorization / delayedcharge / noshow — none of which is a scheduled
      // subscription renewal, and Authorize.net's card-on-file guidance says
      // recurring and unscheduled payments do not specify one. It previously
      // said `resubmission`, which claims this is a retry of a declined charge.
      const subsequentAuthInformation = firstCharge
        ? undefined
        : {
            originalNetworkTransId: params.networkTransId,
            ...(params.originalAuthAmount !== undefined
              ? { originalAuthAmount: dollars(params.originalAuthAmount) }
              : {}),
          };

      const res = await postJson<
        AnetMessages & {
          transactionResponse?: {
            responseCode?: string;
            transId?: string;
            networkTransId?: string;
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
            ...(params.orderId ? { order: { invoiceNumber: params.orderId.slice(0, 20) } } : {}),
            processingOptions,
            ...(subsequentAuthInformation ? { subsequentAuthInformation } : {}),
            // Marks the charge as recurring billing, which is a separate signal
            // from the COF flags above and is what Authorize.net's own guidance
            // pairs with isSubsequentAuth for a subscription.
            transactionSettings: {
              setting: [{ settingName: 'recurringBilling', settingValue: 'true' }],
            },
          },
        },
      });

      const tx = res.transactionResponse;
      // responseCode 1 = approved, 2 = declined, 3 = error, 4 = held for review
      // (the money IS captured pending the merchant's own fraud check, so it is
      // a success from our side — treating it as a decline would dun a customer
      // who has paid).
      if (tx?.responseCode === '1' || tx?.responseCode === '4') {
        return {
          status: 'succeeded',
          paymentRef: tx.transId ?? null,
          // Persisted by the caller and quoted back on the next renewal. Only
          // the establishing charge produces one worth keeping, but returning it
          // every time is harmless and self-healing if a row lost it.
          ...(tx.networkTransId ? { networkTransId: tx.networkTransId } : {}),
        };
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

  /**
   * Where a payment stands at Authorize.net, in the words its webhook would use.
   *
   * The reference is our own invoice number, which is what the webhook reports
   * as the charge. Authorize.net cannot be asked for a transaction by invoice
   * number, so this reads the transactions not yet settled, then the batches
   * settled in the last few days, and takes the one carrying it. The stranded
   * payment sweep only asks about the last 3 days, so 4 days of batches covers
   * every question it can put. Without this, a shop that never set up the
   * webhook left every order unpaid (issue 739).
   *
   * It needs the Transaction Details API, which a merchant can switch off in
   * their Authorize.net account; then this throws with Authorize.net's own
   * words and the caller logs it.
   */
  async lookupPayment(params: LookupPaymentParams): Promise<LookedUpPayment | null> {
    const creds = await loadCredentials(params.tenantId, AUTHORIZE_NET_ID);
    const found = await this.findPayment(creds, params.paymentRef, LOOKUP_DAYS);
    if (!found) return null;

    // The same fields `normalizeAuthorizeNetEvent` reports for a capture.
    const data = {
      chargeId: params.paymentRef,
      transactionRef: found.transId,
      amountCents: Math.round(Number(found.settleAmount ?? 0) * 100),
      currency: 'USD',
    };
    const status = found.transactionStatus ?? '';
    if (ANET_PAID.has(status)) return { status: 'succeeded', data };
    if (ANET_FAILED.has(status)) return { status: 'failed', data };
    // Held for fraud review, or waiting on its capture: not settled either way.
    return { status: 'pending', data };
  }

  /**
   * The payment carrying our invoice number: the transactions not yet settled,
   * then the batches settled in the last `days` (Authorize.net lists at most
   * 31 days of batches at once). Refunds are skipped: one carries the same
   * invoice number as the payment it gives back.
   */
  private async findPayment(
    creds: Awaited<ReturnType<typeof loadCredentials>>,
    invoiceNumber: string,
    days: number
  ): Promise<AnetListedTransaction | undefined> {
    const url = apiUrl(creds.environment);
    const merchantAuthentication = this.auth(creds);
    // Newest first, so a retried attempt's latest try is the one read.
    const listing = { sorting: { orderBy: 'submitTimeUTC', orderDescending: true } };
    const page = { paging: { limit: 1000, offset: 1 } };

    const unsettled = await postJson<AnetMessages & { transactions?: AnetListedTransaction[] }>(
      url,
      { getUnsettledTransactionListRequest: { merchantAuthentication, ...listing, ...page } }
    );
    assertAnetOk(unsettled, 'look up this payment');
    const pending = paymentFor(unsettled.transactions, invoiceNumber);
    if (pending) return pending;

    const now = Date.now();
    const batches = await postJson<AnetMessages & { batchList?: { batchId: string }[] }>(url, {
      getSettledBatchListRequest: {
        merchantAuthentication,
        firstSettlementDate: new Date(now - days * 86_400_000).toISOString(),
        lastSettlementDate: new Date(now).toISOString(),
      },
    });
    assertAnetOk(batches, 'look up this payment');
    for (const batch of batches.batchList ?? []) {
      const settled = await postJson<AnetMessages & { transactions?: AnetListedTransaction[] }>(
        url,
        {
          getTransactionListRequest: {
            merchantAuthentication,
            batchId: batch.batchId,
            ...listing,
            ...page,
          },
        }
      );
      assertAnetOk(settled, 'look up this payment');
      const found = paymentFor(settled.transactions, invoiceNumber);
      if (found) return found;
    }
    return undefined;
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
    return Promise.reject(new Error('authorize_net parses per-tenant: use parseWebhookForTenant'));
  }

  // Authorize.net signs webhooks `X-ANET-Signature: sha512=HEX` (HMAC-SHA512 of the raw
  // body with the Signature Key). The route resolves the tenant from its path.
  async parseWebhookForTenant(tenantId: string, event: WebhookEvent): Promise<ParsedWebhookEvent> {
    const creds = await loadCredentials(tenantId, AUTHORIZE_NET_ID);
    // An unsigned message is refused, never trusted. Without a key there is
    // nothing to check it against, and anyone who knew this address could
    // otherwise mark an order paid or refunded. Paid status does not depend on
    // it: checkout and the stranded-payment sweep ask Authorize.net directly.
    const sigKey = creds.secrets.signature_key;
    if (!sigKey) throw new Error('authorize_net webhook refused: no signature key is set');
    const expected = createHmac('sha512', Buffer.from(sigKey, 'hex'))
      .update(event.rawBody)
      .digest('hex')
      .toUpperCase();
    const got = event.signature.replace(/^sha512=/i, '').toUpperCase();
    const ok =
      expected.length === got.length && timingSafeEqual(Buffer.from(expected), Buffer.from(got));
    if (!ok) throw new Error('authorize_net webhook signature mismatch');
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
        data: {
          chargeId: id,
          ...(evt.payload?.id ? { transactionRef: evt.payload.id } : {}),
          amountCents,
          currency: 'USD',
        },
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
