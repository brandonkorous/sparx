// The bring-your-own gateways' payment references and payment lookups, pinned
// against each vendor's published API (issue 739).
//
// Two things are proved here, both with `fetch` stubbed:
//
//   · Every payment attempt carries its OWN reference. Checkout passes no order
//     id (the order is written after the payment), and the old reference fell
//     back to the word `sparx`, so every shop checkout on these five gateways
//     carried the same one: Authorize.net, 1stPay and the custom gateway stored
//     it as the payment's id, and Square and PayPal used it as the duplicate
//     guard, which they answer with the FIRST request's result.
//   · Square, PayPal and Authorize.net can say where a payment stands, in the
//     words their webhooks use, so a shop that never set up a webhook still
//     sees a paid order marked paid.
//
// They cannot prove a vendor accepts what is sent; a sandbox run does that.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setGatewayCredentialReader, type GatewayCredentials } from './credentials';
import type { CreatePaymentIntentParams } from './gateway';
import { AuthorizeNetGateway, normalizeAuthorizeNetEvent } from './gateways/authorize-net';
import { CustomRedirectGateway } from './gateways/custom-redirect';
import { FirstPayGateway } from './gateways/first-pay';
import { PayPalGateway } from './gateways/paypal';
import { SquareGateway } from './gateways/square';

/* ── Harness ──────────────────────────────────────────────────────────────── */

interface Call {
  url: string;
  method: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}

let calls: Call[] = [];
/** An answer with a status other than 200, the way a vendor says "not found". */
class Reply {
  constructor(
    readonly status: number,
    readonly body: unknown
  ) {}
}

/** Queued answers, one per call in order. A bare value is a 200. */
let answers: unknown[] = [];

function reply(status: number, body: unknown): Reply {
  return new Reply(status, body);
}

beforeEach(() => {
  calls = [];
  answers = [];
  vi.stubGlobal(
    'fetch',
    (url: string, init: { method?: string; body?: string; headers: Record<string, string> }) => {
      const raw = init.body ?? '';
      let body: Record<string, unknown> = {};
      try {
        body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      } catch {
        body = Object.fromEntries(new URLSearchParams(raw));
      }
      calls.push({ url, method: init.method ?? 'POST', body, headers: init.headers });
      const next = answers.shift() ?? {};
      const framed = next instanceof Reply ? next : new Reply(200, next);
      return Promise.resolve({
        ok: framed.status < 300,
        status: framed.status,
        text: () => Promise.resolve(JSON.stringify(framed.body)),
      });
    }
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  setGatewayCredentialReader({ read: () => Promise.resolve(null) });
});

function useCredentials(over: Partial<GatewayCredentials>): void {
  const creds: GatewayCredentials = {
    gatewayId: 'test',
    environment: 'sandbox',
    secrets: {},
    publicMeta: {},
    ...over,
  };
  setGatewayCredentialReader({ read: () => Promise.resolve(creds) });
}

/** PayPal caches its access token per tenant, so each PayPal call in this file
 *  uses a fresh tenant and is answered a token first. */
let paypalTenants = 0;
function paypalTenant(): string {
  paypalTenants += 1;
  return `tenant-paypal-${String(paypalTenants)}`;
}
const TOKEN = { access_token: 'A21', expires_in: 32_000 };

const ANET_OK = { messages: { resultCode: 'Ok', message: [] } };

/** What checkout sends: no order, invoice or booking id. */
function checkoutParams(tenantId = 'tenant-1'): CreatePaymentIntentParams {
  return {
    tenantId,
    amount: 15821,
    currency: 'usd',
    returnUrl: 'https://juniper-row.test/checkout/return',
    cancelUrl: 'https://juniper-row.test/checkout',
  };
}

/* ── One reference per attempt ────────────────────────────────────────────── */

describe('every payment attempt carries its own reference', () => {
  it('Authorize.net: two checkouts get two invoice numbers, each the id that is stored', async () => {
    useCredentials({ publicMeta: { api_login_id: 'login' }, secrets: { transaction_key: 'k' } });
    answers = [
      { token: 't1', ...ANET_OK },
      { token: 't2', ...ANET_OK },
    ];
    const gateway = new AuthorizeNetGateway();
    const first = await gateway.createPaymentIntent(checkoutParams());
    const second = await gateway.createPaymentIntent(checkoutParams());

    expect(first.id).not.toBe(second.id);
    const sent = (call: Call | undefined) =>
      (
        call?.body.getHostedPaymentPageRequest as {
          transactionRequest: { order: { invoiceNumber: string } };
        }
      ).transactionRequest.order.invoiceNumber;
    // Authorize.net's invoiceNumber field holds 20 characters, and the webhook
    // reports it back as the charge, so it has to BE the stored id, uncut.
    expect(sent(calls[0])).toBe(first.id);
    expect(sent(calls[1])).toBe(second.id);
    expect(first.id.length).toBeLessThanOrEqual(20);
  });

  it("Authorize.net: the webhook's charge is the stored id, so a paid payment can be found", async () => {
    useCredentials({ publicMeta: { api_login_id: 'login' }, secrets: { transaction_key: 'k' } });
    answers = [{ token: 't1', ...ANET_OK }];
    const intent = await new AuthorizeNetGateway().createPaymentIntent({
      ...checkoutParams(),
      // A 36-character invoice id was cut to 20 before; the webhook then
      // reported 20 characters against a stored 36 and never matched.
      invoiceId: '6f1c2a40-3b7e-4d1a-9c55-2f0e8a7b1d93',
    });
    // Authorize.net echoes back the invoice number it was SENT, not our id.
    const sentInvoice = (
      calls[0]?.body.getHostedPaymentPageRequest as {
        transactionRequest: { order: { invoiceNumber: string } };
      }
    ).transactionRequest.order.invoiceNumber;
    const parsed = normalizeAuthorizeNetEvent(
      {
        notificationId: 'n1',
        eventType: 'net.authorize.payment.authcapture.created',
        payload: { id: '60212345678', invoiceNumber: sentInvoice, authAmount: 158.21 },
      },
      'tenant-1'
    );
    expect(parsed.data?.chargeId).toBe(intent.id);
  });

  it('Square: two checkouts send two duplicate guards', async () => {
    useCredentials({ publicMeta: { location_id: 'L1' }, secrets: { access_token: 'sq' } });
    answers = [
      { payment_link: { id: 'pl1', url: 'https://square.link/1', order_id: 'ord1' } },
      { payment_link: { id: 'pl2', url: 'https://square.link/2', order_id: 'ord2' } },
    ];
    const gateway = new SquareGateway();
    await gateway.createPaymentIntent(checkoutParams());
    await gateway.createPaymentIntent(checkoutParams());
    // Square answers a repeated idempotency key with the FIRST link it made.
    expect(calls[0]?.body.idempotency_key).not.toBe(calls[1]?.body.idempotency_key);
    expect(calls[0]?.body.idempotency_key).not.toBe('sparx');
  });

  it('PayPal: two checkouts send two request ids', async () => {
    useCredentials({ publicMeta: { client_id: 'c' }, secrets: { client_secret: 's' } });
    answers = [
      TOKEN,
      { id: 'ORDER-1', status: 'CREATED', links: [] },
      TOKEN,
      { id: 'ORDER-2', status: 'CREATED', links: [] },
    ];
    const gateway = new PayPalGateway();
    await gateway.createPaymentIntent(checkoutParams(paypalTenant()));
    await gateway.createPaymentIntent(checkoutParams(paypalTenant()));
    const orders = calls.filter((call) => call.url.endsWith('/v2/checkout/orders'));
    // PayPal answers a repeated PayPal-Request-Id with the FIRST order it made.
    expect(orders).toHaveLength(2);
    expect(orders[0]?.headers['paypal-request-id']).not.toBe(
      orders[1]?.headers['paypal-request-id']
    );
  });

  it.each([
    ['1stPay', () => new FirstPayGateway(), { publicMeta: { gateway_id: 'g' } }],
    [
      'the custom gateway',
      () => new CustomRedirectGateway(),
      { publicMeta: { hosted_url: 'https://pay.test/' } },
    ],
  ] as const)('%s: two checkouts are two payments, not one', async (_name, make, creds) => {
    useCredentials(creds);
    const gateway = make();
    const first = await gateway.createPaymentIntent(checkoutParams());
    const second = await gateway.createPaymentIntent(checkoutParams());
    expect(first.id).not.toBe(second.id);
    expect(first.id).not.toBe('sparx');
  });
});

/* ── Square lookup ────────────────────────────────────────────────────────── */

describe('Square says where a payment stands', () => {
  beforeEach(() => {
    useCredentials({ publicMeta: { location_id: 'L1' }, secrets: { access_token: 'sq' } });
  });

  const order = (over: Record<string, unknown> = {}) => ({
    order: {
      id: 'ord1',
      state: 'OPEN',
      total_money: { amount: 15821, currency: 'USD' },
      ...over,
    },
  });

  it('a completed card payment on the order is paid, reported as the webhook would', async () => {
    answers = [
      order({ tenders: [{ type: 'CARD', payment_id: 'pay1' }] }),
      {
        payment: {
          id: 'pay1',
          status: 'COMPLETED',
          order_id: 'ord1',
          amount_money: { amount: 15821, currency: 'USD' },
        },
      },
    ];
    const found = await new SquareGateway().lookupPayment({
      tenantId: 'tenant-1',
      paymentRef: 'ord1',
    });
    expect(found).toEqual({
      status: 'succeeded',
      data: { chargeId: 'ord1', transactionRef: 'pay1', amountCents: 15821, currency: 'USD' },
    });
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      'GET https://connect.squareupsandbox.com/v2/orders/ord1',
      'GET https://connect.squareupsandbox.com/v2/payments/pay1',
    ]);
    expect(calls[0]?.headers['square-version']).toBeTruthy();
  });

  it('an order nobody has paid yet is still on its way', async () => {
    answers = [order()];
    const found = await new SquareGateway().lookupPayment({
      tenantId: 'tenant-1',
      paymentRef: 'ord1',
    });
    expect(found?.status).toBe('pending');
    expect(calls).toHaveLength(1);
  });

  it('a failed payment is failed', async () => {
    answers = [
      order({ tenders: [{ type: 'CARD', payment_id: 'pay1' }] }),
      {
        payment: { id: 'pay1', status: 'FAILED', amount_money: { amount: 15821, currency: 'USD' } },
      },
    ];
    const found = await new SquareGateway().lookupPayment({
      tenantId: 'tenant-1',
      paymentRef: 'ord1',
    });
    expect(found?.status).toBe('failed');
  });

  it('an order Square does not know is no answer', async () => {
    answers = [reply(404, { errors: [{ code: 'NOT_FOUND' }] })];
    const found = await new SquareGateway().lookupPayment({
      tenantId: 'tenant-1',
      paymentRef: 'nope',
    });
    expect(found).toBeNull();
  });
});

/* ── PayPal lookup ────────────────────────────────────────────────────────── */

describe('PayPal says where a payment stands', () => {
  beforeEach(() => {
    useCredentials({ publicMeta: { client_id: 'c' }, secrets: { client_secret: 's' } });
  });

  const captured = (status: string) => ({
    id: 'ORDER-1',
    status: status === 'COMPLETED' ? 'COMPLETED' : 'APPROVED',
    purchase_units: [
      {
        amount: { value: '158.21', currency_code: 'USD' },
        payments: {
          captures: [{ id: 'CAP-1', status, amount: { value: '158.21', currency_code: 'USD' } }],
        },
      },
    ],
  });

  it('a completed capture is paid, with the order as the charge the way the webhook says it', async () => {
    answers = [TOKEN, captured('COMPLETED')];
    const found = await new PayPalGateway().lookupPayment({
      tenantId: paypalTenant(),
      paymentRef: 'ORDER-1',
    });
    expect(found).toEqual({
      status: 'succeeded',
      data: { chargeId: 'ORDER-1', amountCents: 15821, currency: 'USD' },
    });
    expect(calls[1]?.method).toBe('GET');
    expect(calls[1]?.url).toBe('https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER-1');
    expect(calls[1]?.headers.authorization).toBe('Bearer A21');
  });

  it('a declined capture is failed', async () => {
    answers = [TOKEN, captured('DECLINED')];
    const found = await new PayPalGateway().lookupPayment({
      tenantId: paypalTenant(),
      paymentRef: 'ORDER-1',
    });
    expect(found?.status).toBe('failed');
  });

  const approved = {
    id: 'ORDER-1',
    status: 'APPROVED',
    purchase_units: [{ amount: { value: '158.21', currency_code: 'USD' } }],
  };

  it('takes the money for an order the shopper approved, once', async () => {
    answers = [TOKEN, approved, captured('COMPLETED')];
    const found = await new PayPalGateway().lookupPayment({
      tenantId: paypalTenant(),
      paymentRef: 'ORDER-1',
    });
    expect(found).toEqual({
      status: 'succeeded',
      data: { chargeId: 'ORDER-1', amountCents: 15821, currency: 'USD' },
    });
    // Orders v2 capture, with a request id fixed to the order: PayPal answers
    // a repeated id with the first capture, so a second ask never charges twice.
    expect(calls[2]?.method).toBe('POST');
    expect(calls[2]?.url).toBe(
      'https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER-1/capture'
    );
    expect(calls[2]?.headers['paypal-request-id']).toBe('capture-ORDER-1');
  });

  it('a capture PayPal refuses is failed', async () => {
    answers = [TOKEN, approved, reply(422, { name: 'UNPROCESSABLE_ENTITY' })];
    const found = await new PayPalGateway().lookupPayment({
      tenantId: paypalTenant(),
      paymentRef: 'ORDER-1',
    });
    expect(found?.status).toBe('failed');
  });

  it('an order the shopper has not approved yet is still on its way, and nothing is taken', async () => {
    answers = [TOKEN, { ...approved, status: 'PAYER_ACTION_REQUIRED' }];
    const found = await new PayPalGateway().lookupPayment({
      tenantId: paypalTenant(),
      paymentRef: 'ORDER-1',
    });
    expect(found?.status).toBe('pending');
    expect(calls).toHaveLength(2);
  });

  it('an order PayPal does not know is no answer', async () => {
    answers = [TOKEN, reply(404, { name: 'RESOURCE_NOT_FOUND' })];
    const found = await new PayPalGateway().lookupPayment({
      tenantId: paypalTenant(),
      paymentRef: 'nope',
    });
    expect(found).toBeNull();
  });
});

/* ── Authorize.net lookup ─────────────────────────────────────────────────── */

describe('Authorize.net says where a payment stands', () => {
  beforeEach(() => {
    useCredentials({ publicMeta: { api_login_id: 'login' }, secrets: { transaction_key: 'k' } });
  });

  const REF = 'px0123456789abcdef01';

  it('finds an unsettled payment by its invoice number, past a refund carrying the same one', async () => {
    answers = [
      {
        ...ANET_OK,
        transactions: [
          {
            transId: '999',
            invoiceNumber: REF,
            transactionStatus: 'refundPendingSettlement',
            settleAmount: 158.21,
          },
          {
            transId: '555',
            invoiceNumber: 'px-someone-else',
            transactionStatus: 'capturedPendingSettlement',
            settleAmount: 12,
          },
          {
            transId: '602',
            invoiceNumber: REF,
            transactionStatus: 'capturedPendingSettlement',
            settleAmount: 158.21,
          },
        ],
      },
    ];
    const found = await new AuthorizeNetGateway().lookupPayment({
      tenantId: 'tenant-1',
      paymentRef: REF,
    });
    expect(found).toEqual({
      status: 'succeeded',
      data: { chargeId: REF, transactionRef: '602', amountCents: 15821, currency: 'USD' },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://apitest.authorize.net/xml/v1/request.api');
    expect(Object.keys(calls[0]?.body ?? {})).toEqual(['getUnsettledTransactionListRequest']);
  });

  it('reads the recently settled batches when it has already settled', async () => {
    answers = [
      { ...ANET_OK },
      { ...ANET_OK, batchList: [{ batchId: 'b1' }, { batchId: 'b2' }] },
      {
        ...ANET_OK,
        transactions: [
          {
            transId: '111',
            invoiceNumber: 'px-other',
            transactionStatus: 'settledSuccessfully',
            settleAmount: 9,
          },
        ],
      },
      {
        ...ANET_OK,
        transactions: [
          {
            transId: '602',
            invoiceNumber: REF,
            transactionStatus: 'settledSuccessfully',
            settleAmount: '158.21',
          },
        ],
      },
    ];
    const found = await new AuthorizeNetGateway().lookupPayment({
      tenantId: 'tenant-1',
      paymentRef: REF,
    });
    expect(found?.status).toBe('succeeded');
    expect(found?.data.transactionRef).toBe('602');
    expect(Object.keys(calls[1]?.body ?? {})).toEqual(['getSettledBatchListRequest']);
    expect((calls[3]?.body.getTransactionListRequest as { batchId: string }).batchId).toBe('b2');
  });

  it('a declined payment is failed', async () => {
    answers = [
      {
        ...ANET_OK,
        transactions: [
          { transId: '602', invoiceNumber: REF, transactionStatus: 'declined', settleAmount: 0 },
        ],
      },
    ];
    const found = await new AuthorizeNetGateway().lookupPayment({
      tenantId: 'tenant-1',
      paymentRef: REF,
    });
    expect(found?.status).toBe('failed');
  });

  it('a payment it cannot find is no answer', async () => {
    answers = [{ ...ANET_OK }, { ...ANET_OK }];
    const found = await new AuthorizeNetGateway().lookupPayment({
      tenantId: 'tenant-1',
      paymentRef: REF,
    });
    expect(found).toBeNull();
  });

  it("says Authorize.net's own words when the merchant has the lookup switched off", async () => {
    answers = [
      {
        messages: {
          resultCode: 'Error',
          message: [
            {
              code: 'E00011',
              text: 'Access denied. You do not have permissions to call the Transaction Details API.',
            },
          ],
        },
      },
    ];
    await expect(
      new AuthorizeNetGateway().lookupPayment({ tenantId: 'tenant-1', paymentRef: REF })
    ).rejects.toThrow('Transaction Details API');
  });
});

/* ── A webhook has to prove who sent it ───────────────────────────────────── */

describe('a webhook is refused unless it is signed', () => {
  const body = Buffer.from(
    JSON.stringify({
      event_id: 'e1',
      type: 'payment.updated',
      data: { object: { payment: { id: 'pay1', status: 'COMPLETED', order_id: 'ord1' } } },
    })
  );
  const url = 'https://api.example.test/v1/public/webhooks/square/tenant-1';

  it('Square: no key set means no message is trusted', async () => {
    useCredentials({ publicMeta: { location_id: 'L1' }, secrets: { access_token: 'sq' } });
    await expect(
      new SquareGateway().parseWebhookForTenant('tenant-1', { rawBody: body, signature: 'x' }, url)
    ).rejects.toThrow('no signature key');
  });

  it('Square: a message signed over the address and body is read; a forged one is not', async () => {
    useCredentials({
      publicMeta: { location_id: 'L1' },
      secrets: { access_token: 'sq', webhook_signature_key: 'sig-key' },
    });
    const { createHmac } = await import('node:crypto');
    const good = createHmac('sha256', 'sig-key')
      .update(url + body.toString('utf8'))
      .digest('base64');
    const parsed = await new SquareGateway().parseWebhookForTenant(
      'tenant-1',
      { rawBody: body, signature: good },
      url
    );
    expect(parsed.type).toBe('payment.succeeded');
    await expect(
      new SquareGateway().parseWebhookForTenant(
        'tenant-1',
        { rawBody: body, signature: good.replace(/^./, good.startsWith('A') ? 'B' : 'A') },
        url
      )
    ).rejects.toThrow('mismatch');
  });

  it('Authorize.net: no key set means no message is trusted', async () => {
    useCredentials({ publicMeta: { api_login_id: 'login' }, secrets: { transaction_key: 'k' } });
    await expect(
      new AuthorizeNetGateway().parseWebhookForTenant('tenant-1', {
        rawBody: body,
        signature: 'sha512=00',
      })
    ).rejects.toThrow('no signature key');
  });

  it('the custom gateway: no secret set means no message is trusted', async () => {
    useCredentials({ publicMeta: { hosted_url: 'https://pay.test/' } });
    await expect(
      new CustomRedirectGateway().parseWebhookForTenant('tenant-1', {
        rawBody: body,
        signature: 'sha256=00',
      })
    ).rejects.toThrow('no webhook secret');
  });

  describe('PayPal checks a message by handing it back to PayPal', () => {
    const event = {
      id: 'WH-1',
      event_type: 'PAYMENT.CAPTURE.REFUNDED',
      resource: { id: 'REF-1', amount: { value: '20.00', currency_code: 'USD' } },
    };
    const raw = Buffer.from(JSON.stringify(event));
    const headers = {
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-cert-url': 'https://api.paypal.com/v1/notifications/certs/CERT-1',
      'paypal-transmission-id': 'T-1',
      'paypal-transmission-sig': 'SIG',
      'paypal-transmission-time': '2026-10-06T10:00:00Z',
    };

    it('no webhook ID set means no message is trusted, and PayPal is not asked', async () => {
      useCredentials({ publicMeta: { client_id: 'c' }, secrets: { client_secret: 's' } });
      await expect(
        new PayPalGateway().parseWebhookForTenant(paypalTenant(), {
          rawBody: raw,
          signature: 'SIG',
          headers,
        })
      ).rejects.toThrow('no webhook ID');
      expect(calls).toHaveLength(0);
    });

    it('sends the five headers, the webhook ID and the event, and reads a SUCCESS', async () => {
      useCredentials({
        publicMeta: { client_id: 'c', webhook_id: 'WEBHOOK-9' },
        secrets: { client_secret: 's' },
      });
      answers = [TOKEN, { verification_status: 'SUCCESS' }];
      const parsed = await new PayPalGateway().parseWebhookForTenant(paypalTenant(), {
        rawBody: raw,
        signature: 'SIG',
        headers,
      });
      expect(parsed.type).toBe('payment.refunded');
      expect(calls[1]?.url).toBe(
        'https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature'
      );
      expect(calls[1]?.body).toEqual({
        auth_algo: 'SHA256withRSA',
        cert_url: 'https://api.paypal.com/v1/notifications/certs/CERT-1',
        transmission_id: 'T-1',
        transmission_sig: 'SIG',
        transmission_time: '2026-10-06T10:00:00Z',
        webhook_id: 'WEBHOOK-9',
        webhook_event: event,
      });
    });

    it('refuses a message PayPal says it did not send', async () => {
      useCredentials({
        publicMeta: { client_id: 'c', webhook_id: 'WEBHOOK-9' },
        secrets: { client_secret: 's' },
      });
      answers = [TOKEN, { verification_status: 'FAILURE' }];
      await expect(
        new PayPalGateway().parseWebhookForTenant(paypalTenant(), {
          rawBody: raw,
          signature: 'SIG',
          headers,
        })
      ).rejects.toThrow('mismatch');
    });
  });
});

/* ── Refunds go to the thing each vendor refunds ──────────────────────────── */

describe('a refund is sent the id the vendor refunds, not the checkout reference', () => {
  it('Square: the order is read for its payment, and the guard carries the amount', async () => {
    useCredentials({ publicMeta: { location_id: 'L1' }, secrets: { access_token: 'sq' } });
    answers = [
      {
        order: {
          id: 'ord1',
          total_money: { amount: 15821, currency: 'CAD' },
          tenders: [{ type: 'CARD', payment_id: 'pay1' }],
        },
      },
      { refund: { id: 'ref1', amount_money: { amount: 2000 } } },
    ];
    const result = await new SquareGateway().refund({
      tenantId: 'tenant-1',
      chargeId: 'ord1',
      amount: 2000,
    });
    expect(result).toEqual({ success: true, refundId: 'ref1', amount: 2000 });
    expect(calls[1]?.url).toBe('https://connect.squareupsandbox.com/v2/refunds');
    expect(calls[1]?.body).toEqual({
      idempotency_key: 'pay1-refund-2000',
      payment_id: 'pay1',
      amount_money: { amount: 2000, currency: 'CAD' },
    });
  });

  it('Square: a kept payment id is used as it is', async () => {
    useCredentials({ publicMeta: { location_id: 'L1' }, secrets: { access_token: 'sq' } });
    answers = [{ refund: { id: 'ref1', amount_money: { amount: 15821 } } }];
    await new SquareGateway().refund({
      tenantId: 'tenant-1',
      chargeId: 'ord1',
      transactionRef: 'pay1',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.body.payment_id).toBe('pay1');
  });

  it('PayPal: the order is read for its capture, and the capture is refunded', async () => {
    useCredentials({ publicMeta: { client_id: 'c' }, secrets: { client_secret: 's' } });
    answers = [
      TOKEN,
      {
        id: 'ORDER-1',
        status: 'COMPLETED',
        purchase_units: [{ payments: { captures: [{ id: 'CAP-1', status: 'COMPLETED' }] } }],
      },
      { id: 'REF-1', amount: { value: '158.21' } },
    ];
    const result = await new PayPalGateway().refund({
      tenantId: paypalTenant(),
      chargeId: 'ORDER-1',
    });
    expect(result).toEqual({ success: true, refundId: 'REF-1', amount: 15821 });
    expect(calls[2]?.url).toBe(
      'https://api-m.sandbox.paypal.com/v2/payments/captures/CAP-1/refund'
    );
  });

  describe('Authorize.net', () => {
    beforeEach(() => {
      useCredentials({ publicMeta: { api_login_id: 'login' }, secrets: { transaction_key: 'k' } });
    });

    const details = (status: string) => ({
      ...ANET_OK,
      transaction: {
        transactionStatus: status,
        settleAmount: 158.21,
        payment: { creditCard: { cardNumber: 'XXXX1111' } },
      },
    });

    it('refunds a settled payment against its transaction, with the card read from it', async () => {
      answers = [
        details('settledSuccessfully'),
        { ...ANET_OK, transactionResponse: { transId: '700' } },
      ];
      const result = await new AuthorizeNetGateway().refund({
        tenantId: 'tenant-1',
        chargeId: 'px0123456789abcdef01',
        transactionRef: '602',
        amount: 2000,
      });
      expect(result).toEqual({ success: true, refundId: '700', amount: 2000 });
      expect(calls[0]?.body).toEqual({
        getTransactionDetailsRequest: {
          merchantAuthentication: { name: 'login', transactionKey: 'k' },
          transId: '602',
        },
      });
      expect(
        (calls[1]?.body.createTransactionRequest as { transactionRequest: unknown })
          .transactionRequest
      ).toEqual({
        transactionType: 'refundTransaction',
        amount: '20.00',
        payment: { creditCard: { cardNumber: '1111', expirationDate: 'XXXX' } },
        refTransId: '602',
      });
    });

    it('cancels a payment that has not settled yet, when all of it is given back', async () => {
      answers = [
        details('capturedPendingSettlement'),
        { ...ANET_OK, transactionResponse: { transId: '602' } },
      ];
      const result = await new AuthorizeNetGateway().refund({
        tenantId: 'tenant-1',
        chargeId: 'px0123456789abcdef01',
        transactionRef: '602',
      });
      expect(result).toEqual({ success: true, refundId: '602', amount: 15821 });
      expect(
        (calls[1]?.body.createTransactionRequest as { transactionRequest: unknown })
          .transactionRequest
      ).toEqual({ transactionType: 'voidTransaction', refTransId: '602' });
    });

    it('says to wait when part of an unsettled payment is asked for', async () => {
      answers = [details('capturedPendingSettlement')];
      const result = await new AuthorizeNetGateway().refund({
        tenantId: 'tenant-1',
        chargeId: 'px0123456789abcdef01',
        transactionRef: '602',
        amount: 2000,
      });
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('once it settles');
      expect(calls).toHaveLength(1);
    });

    it('finds the transaction by invoice number when the payment kept none', async () => {
      answers = [
        {
          ...ANET_OK,
          transactions: [
            {
              transId: '602',
              invoiceNumber: 'px0123456789abcdef01',
              transactionStatus: 'settledSuccessfully',
              settleAmount: 158.21,
            },
          ],
        },
        details('settledSuccessfully'),
        { ...ANET_OK, transactionResponse: { transId: '700' } },
      ];
      const result = await new AuthorizeNetGateway().refund({
        tenantId: 'tenant-1',
        chargeId: 'px0123456789abcdef01',
      });
      expect(result.success).toBe(true);
      expect(
        (calls[2]?.body.createTransactionRequest as { transactionRequest: { refTransId: string } })
          .transactionRequest.refTransId
      ).toBe('602');
    });
  });
});
