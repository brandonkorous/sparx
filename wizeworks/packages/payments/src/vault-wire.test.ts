// Wire shapes for the three bring-your-own vaults, pinned against each vendor's
// published API contract (docs/111 §4.1, docs/142 §5.4).
//
// These stub `fetch` and assert the exact body, URL and headers each adapter
// builds — Square Cards + Payments, Authorize.net CIM + Card-On-File, PayPal
// Vault v3 + Orders v2. They cannot prove a vendor ACCEPTS the body; only a
// sandbox run does that. What they can prove is that what we send matches what
// the vendor documents, which is where the first pass went wrong:
//
//   · Square's CreateCard REQUIRES `cardholder_name`. It was not being sent, so
//     every vault would have been rejected outright.
//   · Square's off-session flag lives on the `customer_details` OBJECT. It was
//     being sent top-level, where it is ignored — so the issuer saw every
//     scheduled renewal as a stranger keying in a card number.
//   · Authorize.net recurring charges must NOT set `subsequentAuthInformation.
//     reason`, and must reference the establishing transaction's
//     `networkTransId`. It sent `reason: 'resubmission'` and an EMPTY id.
//   · Authorize.net response code 11 (duplicate transaction) was on the
//     permanently-dead list, which revoked a working card whenever a charge was
//     submitted twice.
//
// Every assertion below traces to a documented requirement, and the comments say
// which — a test that only mirrors the implementation would have passed on all
// four of those.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setGatewayCredentialReader, type GatewayCredentials } from './credentials';
import { AuthorizeNetGateway } from './gateways/authorize-net';
import { PayPalGateway } from './gateways/paypal';
import { SquareGateway } from './gateways/square';
import { gatewayCatalog } from './catalog';

// Resolved with no brand, which is the default brand — the capability assertions
// below are about SHAPE, and shape does not vary by brand.
const CATALOG = gatewayCatalog();

/* ── Harness ──────────────────────────────────────────────────────────────── */

interface Call {
  url: string;
  method: string;
  body: Record<string, unknown>;
  raw: string;
  headers: Record<string, string>;
}

let calls: Call[] = [];
/** Queued responses, one per call in order. */
let responses: unknown[] = [];

function stubFetch(): void {
  vi.stubGlobal(
    'fetch',
    (url: string, init: { method?: string; body?: string; headers: Record<string, string> }) => {
      const raw = init.body ?? '';
      let body: Record<string, unknown> = {};
      try {
        body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      } catch {
        // PayPal's OAuth call is form-encoded, not JSON.
        body = Object.fromEntries(new URLSearchParams(raw));
      }
      calls.push({ url, method: init.method ?? 'POST', body, raw, headers: init.headers });
      const next = responses.shift() ?? {};
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(next)),
      });
    }
  );
}

/** Make the NEXT call fail with a vendor error body, the way a decline arrives. */
function failWith(status: number, body: unknown): void {
  vi.stubGlobal('fetch', () =>
    Promise.resolve({
      ok: false,
      status,
      text: () => Promise.resolve(JSON.stringify(body)),
    })
  );
}

function credentials(over: Partial<GatewayCredentials> = {}): GatewayCredentials {
  return { gatewayId: 'test', environment: 'production', secrets: {}, publicMeta: {}, ...over };
}

function useCredentials(creds: GatewayCredentials): void {
  setGatewayCredentialReader({ read: () => Promise.resolve(creds) });
}

/** Read a nested value by dotted path — keeps assertions readable against
 *  Authorize.net's deeply wrapped envelopes. */
function at(body: Record<string, unknown>, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], body);
}

beforeEach(() => {
  calls = [];
  responses = [];
  stubFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  setGatewayCredentialReader({ read: () => Promise.resolve(null) });
});

/* ── The catalog claim ────────────────────────────────────────────────────── */

describe('gateways that claim a vault have one', () => {
  // `PaymentService` refuses to vault or charge unless the DESCRIPTOR says
  // storedMethods, so this is the single switch that routes a subscription to a
  // card charge rather than to invoice mode.
  it.each(['sparx_pay', 'stripe_direct', 'square', 'authorize_net', 'paypal'])(
    '%s reports storedMethods true',
    (id) => {
      expect(CATALOG.find((g) => g.id === id)?.capabilities.storedMethods).toBe(true);
    }
  );

  it.each(['first_pay', 'custom', 'manual'])('%s honestly reports it cannot vault', (id) => {
    expect(CATALOG.find((g) => g.id === id)?.capabilities.storedMethods).toBe(false);
  });

  it('no longer lists PayPal as unbuilt', () => {
    // The adapter exists, so the catalog must not tell a tenant to wait for it.
    expect(CATALOG.find((g) => g.id === 'paypal')?.availability).toBeUndefined();
  });
});

/* ── Square ───────────────────────────────────────────────────────────────── */

describe('Square vault wire shape', () => {
  const gateway = new SquareGateway();
  const creds = credentials({
    secrets: { access_token: 'EAAA-token' },
    publicMeta: { application_id: 'sq0idp-app', location_id: 'L123' },
  });

  it('sends the cardholder name CreateCard requires', async () => {
    useCredentials(creds);
    responses = [
      {
        card: {
          id: 'ccof:card1',
          card_brand: 'VISA',
          last_4: '4242',
          exp_month: 4,
          exp_year: 2030,
        },
      },
    ];

    const method = await gateway.completeVault({
      tenantId: 't1',
      customerId: 'cus-sparx',
      token: 'cnon:card-nonce',
      customerRef: 'SQ-CUST',
      cardholderName: 'Amelia Earhart',
      postalCode: '95131',
    });

    const [call] = calls;
    expect(call?.url).toBe('https://connect.squareup.com/v2/cards');
    expect(call?.body).toMatchObject({
      source_id: 'cnon:card-nonce',
      card: {
        customer_id: 'SQ-CUST',
        // REQUIRED by Square. Omitting it fails the whole vault.
        cardholder_name: 'Amelia Earhart',
        billing_address: { postal_code: '95131' },
      },
    });
    expect(call?.headers.authorization).toBe('Bearer EAAA-token');
    expect(method).toEqual({
      methodRef: 'ccof:card1',
      customerRef: 'SQ-CUST',
      brand: 'VISA',
      last4: '4242',
      expMonth: 4,
      expYear: 2030,
    });
  });

  it('still sends a name when the customer record has none', async () => {
    useCredentials(creds);
    responses = [{ card: { id: 'ccof:c' } }];
    await gateway.completeVault({
      tenantId: 't1',
      customerId: 'cus',
      token: 'cnon:n',
      customerRef: 'SQ',
    });
    // A card saved under a placeholder name is recoverable; a rejected vault is
    // a shopper who could not save their card at all.
    expect(at(calls[0]!.body, 'card.cardholder_name')).toBeTruthy();
  });

  it('omits billing_address when the postal code is unknown', async () => {
    useCredentials(creds);
    responses = [{ card: { id: 'ccof:c' } }];
    await gateway.completeVault({
      tenantId: 't1',
      customerId: 'cus',
      token: 'cnon:n',
      customerRef: 'SQ',
      cardholderName: 'A E',
    });
    // Square matches this against the payment form. Sending a GUESS fails the
    // vault, so absent beats wrong.
    expect(at(calls[0]!.body, 'card.billing_address')).toBeUndefined();
  });

  it('keeps the idempotency key inside Square’s 45-character limit', async () => {
    useCredentials(creds);
    responses = [{ card: { id: 'ccof:c' } }];
    await gateway.completeVault({
      tenantId: 't1',
      customerId: 'a-very-long-sparx-customer-uuid-000000000000',
      token: 'cnon:another-very-long-single-use-card-token-value',
      customerRef: 'SQ',
      cardholderName: 'A E',
    });
    expect(String(calls[0]?.body.idempotency_key).length).toBeLessThanOrEqual(45);
  });

  it('creates the Square customer first when the shopper has none', async () => {
    useCredentials(creds);
    responses = [{ customer: { id: 'SQ-NEW' } }, { card: { id: 'ccof:card2' } }];

    const method = await gateway.completeVault({
      tenantId: 't1',
      customerId: 'cus-sparx',
      token: 'cnon:nonce',
      cardholderName: 'A E',
    });

    expect(calls.map((c) => c.url)).toEqual([
      'https://connect.squareup.com/v2/customers',
      'https://connect.squareup.com/v2/cards',
    ]);
    // A card-on-file hangs off a customer at Square; vaulting onto the wrong one
    // is how a shopper ends up unable to see their own card.
    expect(at(calls[1]!.body, 'card.customer_id')).toBe('SQ-NEW');
    expect(method?.customerRef).toBe('SQ-NEW');
  });

  it('does not call Square at all when the shopper never finished the form', async () => {
    useCredentials(creds);
    expect(await gateway.completeVault({ tenantId: 't1', customerId: 'cus' })).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('routes to the sandbox host when the merchant is in sandbox', async () => {
    useCredentials(credentials({ ...creds, environment: 'sandbox' }));
    responses = [{ card: { id: 'ccof:x' } }];
    await gateway.completeVault({
      tenantId: 't1',
      customerId: 'cus',
      token: 'cnon:n',
      customerRef: 'SQ',
      cardholderName: 'A E',
    });
    expect(calls[0]?.url).toBe('https://connect.squareupsandbox.com/v2/cards');
  });

  it('puts customer_initiated inside customer_details, where Square reads it', async () => {
    useCredentials(creds);
    responses = [{ payment: { id: 'pay_1', status: 'COMPLETED' } }];

    const result = await gateway.chargeStoredMethod({
      tenantId: 't1',
      amount: 2599,
      currency: 'usd',
      methodRef: 'ccof:card1',
      customerRef: 'SQ-CUST',
      orderId: 'order-9',
      idempotencyKey: 'sub-1:occ-3:attempt-1',
    });

    const [call] = calls;
    expect(call?.url).toBe('https://connect.squareup.com/v2/payments');
    expect(call?.body).toMatchObject({
      source_id: 'ccof:card1',
      // "Required if the source_id refers to a card on file created using the
      // Cards API" — which is every charge this method makes.
      customer_id: 'SQ-CUST',
      amount_money: { amount: 2599, currency: 'USD' },
      location_id: 'L123',
      autocomplete: true,
      customer_details: { customer_initiated: false, seller_keyed_in: false },
    });
    // The regression this file exists for: a top-level flag is silently ignored,
    // and the issuer never learns the charge was merchant-initiated.
    expect(call?.body.customer_initiated).toBeUndefined();
    expect(result).toEqual({ status: 'succeeded', paymentRef: 'pay_1' });
  });

  it('counts an APPROVED payment as collected, not declined', async () => {
    useCredentials(creds);
    // Authorised-but-uncaptured should not happen with autocomplete: true, but
    // the money is guaranteed — failing the renewal would dun a paying customer.
    responses = [{ payment: { id: 'pay_2', status: 'APPROVED' } }];
    const result = await gateway.chargeStoredMethod({
      tenantId: 't1',
      amount: 100,
      currency: 'usd',
      methodRef: 'ccof:c',
      customerRef: 'SQ',
      idempotencyKey: 'k',
    });
    expect(result.status).toBe('succeeded');
  });

  it('marks the card dead ONLY for codes that mean the card itself is finished', async () => {
    useCredentials(creds);
    // Square's ErrorCode enum: the card cannot be validated. No retry fixes it.
    failWith(400, { errors: [{ category: 'CARD_ERROR', code: 'INVALID_CARD' }] });
    const dead = await gateway.chargeStoredMethod({
      tenantId: 't1',
      amount: 100,
      currency: 'usd',
      methodRef: 'ccof:c',
      customerRef: 'SQ',
      idempotencyKey: 'k',
    });
    expect(dead).toMatchObject({ status: 'failed', methodDead: true, failureCode: 'INVALID_CARD' });
  });

  it.each(['GENERIC_DECLINE', 'INSUFFICIENT_FUNDS', 'CVV_FAILURE', 'TEMPORARY_ERROR'])(
    'leaves the card alive for %s, which is an issuer having a bad day',
    async (code) => {
      useCredentials(creds);
      failWith(402, { errors: [{ code }] });
      const result = await gateway.chargeStoredMethod({
        tenantId: 't1',
        amount: 100,
        currency: 'usd',
        methodRef: 'ccof:c',
        customerRef: 'SQ',
        idempotencyKey: 'k',
      });
      expect(result.methodDead).toBeUndefined();
    }
  );

  it('does not treat a nonce code as a dead card on file', async () => {
    useCredentials(creds);
    // CARD_TOKEN_USED describes a single-use payment-form token, which cannot
    // occur on a card-on-file charge. Listing it revoked working cards.
    failWith(400, { errors: [{ code: 'CARD_TOKEN_USED' }] });
    const result = await gateway.chargeStoredMethod({
      tenantId: 't1',
      amount: 100,
      currency: 'usd',
      methodRef: 'ccof:c',
      customerRef: 'SQ',
      idempotencyKey: 'k',
    });
    expect(result.methodDead).toBeUndefined();
  });
});

/* ── Authorize.net ────────────────────────────────────────────────────────── */

describe('Authorize.net vault wire shape', () => {
  const gateway = new AuthorizeNetGateway();
  const creds = credentials({
    secrets: { transaction_key: 'txn-key' },
    publicMeta: { api_login_id: 'login123', public_client_key: 'client-key' },
  });
  const opaque = JSON.stringify({
    dataDescriptor: 'COMMON.ACCEPT.INAPP.PAYMENT',
    dataValue: 'eyJjb2Rl',
  });
  const TX = 'createTransactionRequest.transactionRequest';

  const charge = (over: Record<string, unknown> = {}) => ({
    tenantId: 't1',
    amount: 2599,
    currency: 'usd',
    methodRef: 'pp-1',
    customerRef: 'cim-42',
    orderId: 'order-9',
    idempotencyKey: 'sub-1:occ-3:attempt-1',
    ...over,
  });

  it('refuses to start a setup session without the Public Client Key', async () => {
    useCredentials(credentials({ ...creds, publicMeta: { api_login_id: 'login123' } }));
    await expect(gateway.createSetupSession({ tenantId: 't1', customerId: 'cus' })).rejects.toThrow(
      /Public Client Key/
    );
  });

  it('hands Accept.js both keys it needs to mount', async () => {
    useCredentials(creds);
    const session = await gateway.createSetupSession({ tenantId: 't1', customerId: 'cus' });
    expect(session.publishableKey).toBe('login123:client-key');
    expect(session.clientSecret).toBeNull();
    expect(session.redirectUrl).toBeNull();
  });

  it('adds a payment profile to an existing CIM profile', async () => {
    useCredentials(creds);
    responses = [
      { messages: { resultCode: 'Ok' }, customerPaymentProfileId: 'pp-1' },
      {
        messages: { resultCode: 'Ok' },
        paymentProfile: {
          payment: {
            creditCard: { cardNumber: 'XXXX1111', expirationDate: 'XXXX', cardType: 'Visa' },
          },
        },
      },
    ];

    const method = await gateway.completeVault({
      tenantId: 't1',
      customerId: 'cus-sparx',
      token: opaque,
      customerRef: 'cim-42',
    });

    const [create] = calls;
    expect(create?.url).toBe('https://api.authorize.net/xml/v1/request.api');
    expect(at(create!.body, 'createCustomerPaymentProfileRequest.customerProfileId')).toBe(
      'cim-42'
    );
    expect(
      at(create!.body, 'createCustomerPaymentProfileRequest.paymentProfile.payment.opaqueData')
    ).toEqual({ dataDescriptor: 'COMMON.ACCEPT.INAPP.PAYMENT', dataValue: 'eyJjb2Rl' });
    expect(at(create!.body, 'createCustomerPaymentProfileRequest.merchantAuthentication')).toEqual({
      name: 'login123',
      transactionKey: 'txn-key',
    });
    // A charge needs BOTH ids — a payment profile is meaningless without the
    // customer profile it lives inside.
    expect(method).toMatchObject({ methodRef: 'pp-1', customerRef: 'cim-42', last4: '1111' });
  });

  it('creates the CIM profile and the payment profile together for a new shopper', async () => {
    useCredentials(creds);
    responses = [
      {
        messages: { resultCode: 'Ok' },
        customerProfileId: 'cim-new',
        customerPaymentProfileIdList: ['pp-new'],
      },
      { messages: { resultCode: 'Ok' } },
    ];

    const method = await gateway.completeVault({
      tenantId: 't1',
      customerId: 'cus-sparx',
      token: opaque,
    });

    expect(at(calls[0]!.body, 'createCustomerProfileRequest.profile.merchantCustomerId')).toBe(
      'cus-sparx'
    );
    expect(method).toMatchObject({ methodRef: 'pp-new', customerRef: 'cim-new' });
  });

  it('surfaces a 200-OK-but-Error body as a failure', async () => {
    useCredentials(creds);
    // Authorize.net answers HTTP 200 with resultCode Error; a non-throwing POST
    // is NOT a success, which is the trap assertAnetOk exists for.
    responses = [
      {
        messages: {
          resultCode: 'Error',
          message: [{ code: 'E00027', text: 'The card was declined.' }],
        },
      },
    ];
    await expect(
      gateway.completeVault({
        tenantId: 't1',
        customerId: 'cus',
        token: opaque,
        customerRef: 'cim-1',
      })
    ).rejects.toThrow(/The card was declined/);
  });

  it('returns null for a token that is not Accept.js opaque data', async () => {
    useCredentials(creds);
    expect(
      await gateway.completeVault({ tenantId: 't1', customerId: 'cus', token: 'not-json' })
    ).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('declares the FIRST charge as the establishing transaction', async () => {
    useCredentials(creds);
    responses = [
      {
        messages: { resultCode: 'Ok' },
        transactionResponse: { responseCode: '1', transId: 'tx-7', networkTransId: 'NET-123' },
      },
    ];

    const result = await gateway.chargeStoredMethod(charge({ isFirstCharge: true }));

    expect(at(calls[0]!.body, `${TX}.processingOptions`)).toEqual({
      isFirstRecurringPayment: true,
    });
    // Nothing to reference yet — quoting an empty originalNetworkTransId is what
    // the previous version did, and it is worse than omitting the block.
    expect(at(calls[0]!.body, `${TX}.subsequentAuthInformation`)).toBeUndefined();
    // The id the networks will want quoted back on every renewal after this.
    expect(result).toMatchObject({ status: 'succeeded', networkTransId: 'NET-123' });
  });

  it('quotes the establishing transaction back on every later charge', async () => {
    useCredentials(creds);
    responses = [
      {
        messages: { resultCode: 'Ok' },
        transactionResponse: { responseCode: '1', transId: 'tx-8' },
      },
    ];

    await gateway.chargeStoredMethod(
      charge({ networkTransId: 'NET-123', originalAuthAmount: 2599 })
    );

    expect(at(calls[0]!.body, `${TX}.processingOptions`)).toEqual({ isSubsequentAuth: true });
    expect(at(calls[0]!.body, `${TX}.subsequentAuthInformation`)).toEqual({
      originalNetworkTransId: 'NET-123',
      // Dollars as a string, like every other amount Authorize.net takes.
      originalAuthAmount: '25.99',
    });
  });

  it('does NOT send a subsequent-auth reason for a subscription renewal', async () => {
    useCredentials(creds);
    responses = [
      { messages: { resultCode: 'Ok' }, transactionResponse: { responseCode: '1', transId: 't' } },
    ];
    await gateway.chargeStoredMethod(charge({ networkTransId: 'NET-1' }));
    // Prove the path is real BEFORE asserting an absence on it — a mistyped
    // path makes `toBeUndefined()` pass for the wrong reason, which is the
    // vacuous-test shape worth guarding against explicitly.
    expect(at(calls[0]!.body, `${TX}.subsequentAuthInformation.originalNetworkTransId`)).toBe(
      'NET-1'
    );
    // Allowed values are resubmission / reauthorization / delayedcharge / noshow.
    // A scheduled renewal is none of them, and Authorize.net's card-on-file
    // guidance says recurring payments do not specify one. `resubmission` claimed
    // this was a retry of a declined charge.
    expect(at(calls[0]!.body, `${TX}.subsequentAuthInformation.reason`)).toBeUndefined();
  });

  it('flags the charge as recurring billing', async () => {
    useCredentials(creds);
    responses = [
      { messages: { resultCode: 'Ok' }, transactionResponse: { responseCode: '1', transId: 't' } },
    ];
    await gateway.chargeStoredMethod(charge({ networkTransId: 'NET-1' }));
    expect(at(calls[0]!.body, `${TX}.transactionSettings`)).toEqual({
      setting: [{ settingName: 'recurringBilling', settingValue: 'true' }],
    });
  });

  it('sends dollars, not cents', async () => {
    useCredentials(creds);
    responses = [
      { messages: { resultCode: 'Ok' }, transactionResponse: { responseCode: '1', transId: 't' } },
    ];
    await gateway.chargeStoredMethod(charge({ networkTransId: 'NET-1' }));
    // Sending 2599 here charges $2,599.
    expect(at(calls[0]!.body, `${TX}.amount`)).toBe('25.99');
    expect(at(calls[0]!.body, `${TX}.profile`)).toEqual({
      customerProfileId: 'cim-42',
      paymentProfile: { paymentProfileId: 'pp-1' },
    });
  });

  it('counts a held-for-review transaction as captured', async () => {
    useCredentials(creds);
    // responseCode 4: the money IS taken, pending the merchant's own review.
    // Reading it as a decline would dun a customer who has paid.
    responses = [
      {
        messages: { resultCode: 'Ok' },
        transactionResponse: { responseCode: '4', transId: 'tx-8' },
      },
    ];
    const result = await gateway.chargeStoredMethod(charge({ networkTransId: 'NET-1' }));
    expect(result.status).toBe('succeeded');
  });

  it.each([
    ['4', 'pick up card'],
    ['6', 'invalid card number'],
    ['8', 'expired card'],
    ['317', 'expired card'],
  ])('marks the card dead on reason code %s (%s)', async (errorCode) => {
    useCredentials(creds);
    responses = [
      {
        messages: { resultCode: 'Ok' },
        transactionResponse: {
          responseCode: '2',
          transId: 'tx-9',
          errors: [{ errorCode, errorText: 'declined' }],
        },
      },
    ];
    const result = await gateway.chargeStoredMethod(charge({ networkTransId: 'NET-1' }));
    expect(result).toMatchObject({ status: 'failed', methodDead: true });
  });

  it.each([
    ['2', 'general decline'],
    ['11', 'duplicate transaction'],
    ['27', 'AVS mismatch'],
    ['44', 'CVV decline'],
    ['45', 'AVS and CVV mismatch'],
  ])('leaves the card alive on reason code %s (%s)', async (errorCode) => {
    useCredentials(creds);
    responses = [
      {
        messages: { resultCode: 'Ok' },
        transactionResponse: {
          responseCode: '2',
          transId: 'tx-9',
          errors: [{ errorCode, errorText: 'declined' }],
        },
      },
    ];
    const result = await gateway.chargeStoredMethod(charge({ networkTransId: 'NET-1' }));
    // 11 in particular usually means our OWN idempotency worked. Revoking the
    // card for it threw away a working card over a duplicate submit.
    expect(result.methodDead).toBeUndefined();
  });

  it('refuses without a customer profile instead of calling the gateway', async () => {
    useCredentials(creds);
    const result = await gateway.chargeStoredMethod(charge({ customerRef: null }));
    // Unrecoverable without re-vaulting, so it must not spend retry attempts.
    expect(result).toMatchObject({ failureCode: 'missing_profile', methodDead: true });
    expect(calls).toHaveLength(0);
  });
});

/* ── PayPal ───────────────────────────────────────────────────────────────── */

describe('PayPal vault wire shape', () => {
  const creds = credentials({
    secrets: { client_secret: 'secret-xyz' },
    publicMeta: { client_id: 'AXXXclient' },
  });
  const token = { access_token: 'A21AA-access', expires_in: 32000 };

  /** A fresh gateway per test — the access-token cache is per instance. */
  const fresh = () => new PayPalGateway();

  it('mints an access token with client credentials and Basic auth', async () => {
    useCredentials(creds);
    responses = [token, { id: 'setup-1', links: [] }];

    await fresh().createSetupSession({ tenantId: 't1', customerId: 'cus' });

    const [auth] = calls;
    expect(auth?.url).toBe('https://api-m.paypal.com/v1/oauth2/token');
    expect(auth?.body).toEqual({ grant_type: 'client_credentials' });
    expect(auth?.headers.authorization).toBe(
      `Basic ${Buffer.from('AXXXclient:secret-xyz').toString('base64')}`
    );
    expect(auth?.headers['content-type']).toBe('application/x-www-form-urlencoded');
  });

  it('reuses the access token instead of minting one per call', async () => {
    useCredentials(creds);
    responses = [token, { id: 'setup-1', links: [] }, { id: 'setup-2', links: [] }];

    const gateway = fresh();
    await gateway.createSetupSession({ tenantId: 't1', customerId: 'a' });
    await gateway.createSetupSession({ tenantId: 't1', customerId: 'b' });

    // PayPal rate-limits the token endpoint; one token per renewal run, not one
    // per API call.
    expect(calls.filter((c) => c.url.endsWith('/v1/oauth2/token'))).toHaveLength(1);
  });

  it('vaults with usage_type MERCHANT and returns the approval URL', async () => {
    useCredentials(creds);
    responses = [
      token,
      {
        id: '4G4976650J0948357',
        customer: { id: 'customer_4029352050' },
        status: 'PAYER_ACTION_REQUIRED',
        links: [
          { rel: 'self', href: 'https://api-m.paypal.com/v3/vault/setup-tokens/4G4' },
          { rel: 'approve', href: 'https://paypal.com/agreements/approve?x=1' },
        ],
      },
    ];

    const session = await fresh().createSetupSession({
      tenantId: 't1',
      customerId: 'cus',
      returnUrl: 'https://shop.example/account/payment-methods',
    });

    const setup = calls[1];
    expect(setup?.url).toBe('https://api-m.paypal.com/v3/vault/setup-tokens');
    // MERCHANT is the load-bearing field: it is what permits a later
    // merchant-initiated charge. Without it the token exists and cannot be used.
    expect(at(setup!.body, 'payment_source.paypal.usage_type')).toBe('MERCHANT');
    expect(at(setup!.body, 'payment_source.paypal.experience_context.return_url')).toBe(
      'https://shop.example/account/payment-methods'
    );

    expect(session.redirectUrl).toBe('https://paypal.com/agreements/approve?x=1');
    expect(session.setupRef).toBe('4G4976650J0948357');
    expect(session.customerRef).toBe('customer_4029352050');
    // A hosted approval, not an inline card form.
    expect(session.clientSecret).toBeNull();
  });

  it('exchanges an approved setup token for a permanent payment token', async () => {
    useCredentials(creds);
    responses = [
      token,
      { id: 'jwgvx42', customer: { id: 'customer_402' }, payment_source: { paypal: {} } },
    ];

    const method = await fresh().completeVault({
      tenantId: 't1',
      customerId: 'cus',
      token: '4G4976650J0948357',
    });

    const exchange = calls[1];
    expect(exchange?.url).toBe('https://api-m.paypal.com/v3/vault/payment-tokens');
    expect(at(exchange!.body, 'payment_source.token')).toEqual({
      id: '4G4976650J0948357',
      type: 'SETUP_TOKEN',
    });
    // A saved PayPal ACCOUNT has no brand or last-4 — "PayPal" is what the
    // shopper recognises in a list of saved methods, and beats a blank row.
    expect(method).toMatchObject({ methodRef: 'jwgvx42', brand: 'PayPal', last4: null });
  });

  it('reads brand and expiry off a vaulted CARD', async () => {
    useCredentials(creds);
    responses = [
      token,
      {
        id: 'card-token',
        customer: { id: 'c1' },
        payment_source: { card: { brand: 'VISA', last_digits: '1111', expiry: '2027-11' } },
      },
    ];
    const method = await fresh().completeVault({
      tenantId: 't1',
      customerId: 'cus',
      setupRef: 'setup-1',
    });
    // PayPal returns `expiry` as YYYY-MM, not two integers.
    expect(method).toMatchObject({ brand: 'VISA', last4: '1111', expMonth: 11, expYear: 2027 });
  });

  it('does nothing when the shopper abandoned the approval page', async () => {
    useCredentials(creds);
    expect(await fresh().completeVault({ tenantId: 't1', customerId: 'cus' })).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('charges the vault as a merchant-initiated recurring order', async () => {
    useCredentials(creds);
    responses = [
      token,
      {
        id: 'ORDER-1',
        status: 'COMPLETED',
        purchase_units: [{ payments: { captures: [{ id: 'CAPTURE-1', status: 'COMPLETED' }] } }],
      },
    ];

    const result = await fresh().chargeStoredMethod({
      tenantId: 't1',
      amount: 2599,
      currency: 'usd',
      methodRef: 'jwgvx42',
      customerRef: 'customer_402',
      orderId: 'order-9',
      idempotencyKey: 'sub_1_order-9_1',
    });

    const order = calls[1];
    expect(order?.url).toBe('https://api-m.paypal.com/v2/checkout/orders');
    expect(order?.body).toMatchObject({ intent: 'CAPTURE' });
    // Major units as a string — sending 2599 charges $2,599.
    expect(at(order!.body, 'purchase_units.0.amount')).toEqual({
      currency_code: 'USD',
      value: '25.99',
    });
    expect(at(order!.body, 'payment_source.paypal.vault_id')).toBe('jwgvx42');
    expect(at(order!.body, 'payment_source.paypal.stored_credential')).toEqual({
      payment_initiator: 'MERCHANT',
      payment_type: 'RECURRING',
      usage: 'SUBSEQUENT',
    });
    // PayPal's idempotency header. Supplying payment_source at create time with
    // intent CAPTURE completes the payment in ONE call — a separate capture
    // would 422.
    expect(order?.headers['paypal-request-id']).toBe('sub_1_order-9_1');
    expect(result).toEqual({ status: 'succeeded', paymentRef: 'CAPTURE-1' });
  });

  it('marks the very first charge as usage FIRST', async () => {
    useCredentials(creds);
    responses = [
      token,
      { id: 'O', status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ id: 'C' }] } }] },
    ];
    await fresh().chargeStoredMethod({
      tenantId: 't1',
      amount: 100,
      currency: 'usd',
      methodRef: 'v',
      customerRef: 'c',
      idempotencyKey: 'k',
      isFirstCharge: true,
    });
    expect(at(calls[1]!.body, 'payment_source.paypal.stored_credential.usage')).toBe('FIRST');
  });

  it('treats PAYER_ACTION_REQUIRED as authentication, not a decline', async () => {
    useCredentials(creds);
    responses = [
      token,
      {
        id: 'ORDER-2',
        status: 'PAYER_ACTION_REQUIRED',
        links: [{ rel: 'payer-action', href: 'https://paypal.com/authenticate?x=2' }],
      },
    ];

    const result = await fresh().chargeStoredMethod({
      tenantId: 't1',
      amount: 100,
      currency: 'usd',
      methodRef: 'v',
      customerRef: 'c',
      idempotencyKey: 'k',
    });

    // Cancelling a healthy subscription because the bank asked a question is the
    // exact failure `requires_action` exists to prevent.
    expect(result).toMatchObject({
      status: 'requires_action',
      actionUrl: 'https://paypal.com/authenticate?x=2',
    });
  });

  it('keeps a declined funding source retryable', async () => {
    useCredentials(creds);
    responses = [token];
    const gateway = fresh();
    // Warm the token, then fail the order.
    await gateway.createSetupSession({ tenantId: 't1', customerId: 'x' }).catch(() => undefined);
    failWith(422, { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'INSTRUMENT_DECLINED' }] });

    const result = await gateway.chargeStoredMethod({
      tenantId: 't1',
      amount: 100,
      currency: 'usd',
      methodRef: 'v',
      customerRef: 'c',
      idempotencyKey: 'k',
    });
    // A payer whose funding source declined today may well have a working one
    // next week — that is what the dunning ladder is for.
    expect(result.methodDead).toBeUndefined();
  });

  it('marks a vault token that no longer exists as dead', async () => {
    useCredentials(creds);
    responses = [token];
    const gateway = fresh();
    await gateway.createSetupSession({ tenantId: 't1', customerId: 'x' }).catch(() => undefined);
    failWith(404, { name: 'RESOURCE_NOT_FOUND', details: [{ issue: 'VAULT_ID_NOT_FOUND' }] });

    const result = await gateway.chargeStoredMethod({
      tenantId: 't1',
      amount: 100,
      currency: 'usd',
      methodRef: 'gone',
      customerRef: 'c',
      idempotencyKey: 'k',
    });
    // The payer revoked the agreement. No retry brings it back; only a new one.
    expect(result.methodDead).toBe(true);
  });

  it('uses the sandbox host for a sandbox merchant', async () => {
    useCredentials(credentials({ ...creds, environment: 'sandbox' }));
    responses = [token, { id: 's', links: [] }];
    await fresh().createSetupSession({ tenantId: 't1', customerId: 'cus' });
    expect(calls[0]?.url).toBe('https://api-m.sandbox.paypal.com/v1/oauth2/token');
  });
});
