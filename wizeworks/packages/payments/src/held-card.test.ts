// Holding a card for an order that waits for sign-off (sparx persona issue 087).
//
// A wholesale order over a spending limit is not placed until somebody approves
// it, and the card it was paid with used to be charged at checkout anyway: a
// buyer whose own company turned the order down was out the money. The fix holds
// the card instead, where the gateway can, and charges it on approval. What this
// pins:
//
//   1. Which gateways can hold a card. The catalog said all five card gateways
//      could; only the two Stripe-backed adapters pass a manual capture and can
//      capture or release one, so only they may promise it.
//   2. A held card reads as held, and the webhook that says so is understood.
//   3. Stripe Direct can capture and release on the merchant's own account. It
//      answered "not supported" to both, so a card held there could never be
//      charged or let go.
//   4. A released hold counts as released. Cancel came back `success: false`
//      every time, because only a charge counted as a success.
//   5. paymentService hands the tenant to the gateway, and says whether a
//      tenant's gateway can hold a card at all.

import type Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const stripeCalls = {
  capture: vi.fn(),
  cancel: vi.fn(),
};
const keysUsed: string[] = [];
let tenantGateway = 'sparx_pay';

vi.mock('./client', () => ({
  stripeForKey: (key: string) => {
    keysUsed.push(key);
    return { paymentIntents: stripeCalls };
  },
  getPlatformStripe: () => ({ paymentIntents: stripeCalls }),
}));
vi.mock('@wizeworks/db', () => ({
  withTenant: (_ctx: unknown, fn: (tx: unknown) => unknown) =>
    Promise.resolve(
      fn({
        tenantPaymentConfig: {
          findUnique: () => Promise.resolve(tenantGateway ? { gatewayId: tenantGateway } : null),
        },
        paymentIntent: { updateMany: () => Promise.resolve({ count: 1 }) },
        orderPayment: {
          findFirst: ({ where }: { where: { processorRef: string } }) =>
            Promise.resolve(
              where.processorRef === 'ord-kept'
                ? { metadata: { transactionRef: 'pay-kept' } }
                : null
            ),
        },
      })
    ),
}));

const { gatewayCatalogTemplate } = await import('./catalog');
const { setGatewayCredentialReader } = await import('./credentials');
const { registerBuiltInGateways } = await import('./registry');
const { normalizeStripeEvent, mapIntentStatus } = await import('./stripe-util');
const { SparxPayGateway } = await import('./gateways/sparx-pay');
const { StripeDirectGateway } = await import('./gateways/stripe-direct');
const { SquareGateway } = await import('./gateways/square');
const { paymentService } = await import('./service');

const intent = (status: Stripe.PaymentIntent.Status) =>
  ({ id: 'pi_held', status, latest_charge: null }) as unknown as Stripe.PaymentIntent;

beforeEach(() => {
  stripeCalls.capture.mockReset();
  stripeCalls.cancel.mockReset();
  keysUsed.length = 0;
  tenantGateway = 'sparx_pay';
  setGatewayCredentialReader({
    read: (tenantId) =>
      Promise.resolve({
        gatewayId: 'stripe_direct',
        environment: 'production',
        secrets: { secret_key: `sk_live_${tenantId}` },
        publicMeta: {},
      }),
  });
});

describe('which gateways can hold a card', () => {
  const capture = (id: string) =>
    gatewayCatalogTemplate().find((g) => g.id === id)?.capabilities.capture;

  it('says yes only for the two that pass a manual capture and can capture or release', () => {
    expect(capture('sparx_pay')).toBe(true);
    expect(capture('stripe_direct')).toBe(true);
  });

  it('says no for every gateway that charges on its own hosted page', () => {
    for (const id of ['square', 'authorize_net', 'paypal', 'first_pay', 'custom', 'manual']) {
      expect({ id, capture: capture(id) }).toEqual({ id, capture: false });
    }
  });
});

describe('a held card reads as held', () => {
  it('maps requires_capture to its own state, not to "requires confirmation"', () => {
    expect(mapIntentStatus('requires_capture')).toBe('requires_capture');
  });

  it('understands the webhook that says the card is held, with the held amount', () => {
    const parsed = normalizeStripeEvent({
      id: 'evt_hold',
      type: 'payment_intent.amount_capturable_updated',
      data: {
        object: {
          id: 'pi_held',
          amount: 120_800,
          amount_capturable: 120_800,
          amount_received: 0,
          currency: 'usd',
          metadata: { tenantId: 't-gillett' },
        },
      },
    } as unknown as Stripe.Event);
    expect(parsed.type).toBe('payment.authorized');
    expect(parsed.tenantId).toBe('t-gillett');
    expect(parsed.data).toMatchObject({ chargeId: 'pi_held', amountCents: 120_800 });
  });
});

describe('Stripe Direct captures and releases on the merchant’s own account', () => {
  it('captures with the tenant’s own key', async () => {
    stripeCalls.capture.mockResolvedValue(intent('succeeded'));
    const result = await new StripeDirectGateway().capturePayment('pi_held', undefined, 't-1');
    expect(result.success).toBe(true);
    expect(stripeCalls.capture).toHaveBeenCalledWith('pi_held', {});
    expect(keysUsed).toEqual(['sk_live_t-1']);
  });

  it('releases a hold, and calls that a success', async () => {
    stripeCalls.cancel.mockResolvedValue(intent('canceled'));
    const result = await new StripeDirectGateway().cancelPayment('pi_held', 't-1');
    expect(result).toMatchObject({ success: true, status: 'canceled' });
    expect(keysUsed).toEqual(['sk_live_t-1']);
  });

  it('refuses plainly without a tenant rather than guessing whose account', async () => {
    const result = await new StripeDirectGateway().capturePayment('pi_held');
    expect(result.success).toBe(false);
    expect(stripeCalls.capture).not.toHaveBeenCalled();
  });
});

describe('a released hold counts as released', () => {
  it('sparx Pay', async () => {
    stripeCalls.cancel.mockResolvedValue(intent('canceled'));
    expect((await new SparxPayGateway().cancelPayment('pi_held')).success).toBe(true);
  });
});

describe('paymentService', () => {
  registerBuiltInGateways([new SparxPayGateway(), new StripeDirectGateway(), new SquareGateway()]);

  it('hands the tenant to the gateway, so Stripe Direct can capture at all', async () => {
    tenantGateway = 'stripe_direct';
    stripeCalls.capture.mockResolvedValue(intent('succeeded'));
    const result = await paymentService.capturePayment('t-2', 'pi_held', 50_00);
    expect(result.success).toBe(true);
    expect(stripeCalls.capture).toHaveBeenCalledWith('pi_held', { amount_to_capture: 50_00 });
    expect(keysUsed).toEqual(['sk_live_t-2']);
  });

  it('hands the tenant to the gateway on a release too', async () => {
    tenantGateway = 'stripe_direct';
    stripeCalls.cancel.mockResolvedValue(intent('canceled'));
    expect((await paymentService.cancelPayment('t-2', 'pi_held')).success).toBe(true);
    expect(keysUsed).toEqual(['sk_live_t-2']);
  });

  it('refunds what the payment kept, not the checkout reference (issue 917)', async () => {
    tenantGateway = 'square';
    setGatewayCredentialReader({
      read: () =>
        Promise.resolve({
          gatewayId: 'square',
          environment: 'sandbox',
          secrets: { access_token: 'sq' },
          publicMeta: { location_id: 'L1' },
        }),
    });
    const sent: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal('fetch', (url: string, init: { body?: string }) => {
      sent.push({ url, body: JSON.parse(init.body ?? '{}') as Record<string, unknown> });
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ refund: { id: 'r1', amount_money: { amount: 500 } } })),
      });
    });
    try {
      const result = await paymentService.refund({
        tenantId: 't-4',
        chargeId: 'ord-kept',
        amount: 500,
      });
      expect(result.success).toBe(true);
      // Straight to the refund, against the payment the order's payment kept.
      expect(sent).toHaveLength(1);
      expect(sent[0]?.body.payment_id).toBe('pay-kept');
    } finally {
      vi.unstubAllGlobals();
      setGatewayCredentialReader({ read: () => Promise.resolve(null) });
    }
  });

  it('says whether the tenant’s gateway can hold a card', async () => {
    tenantGateway = 'sparx_pay';
    expect(await paymentService.canHoldCards('t-3')).toBe(true);
    tenantGateway = 'square';
    expect(await paymentService.canHoldCards('t-3')).toBe(false);
    tenantGateway = '';
    expect(await paymentService.canHoldCards('t-3')).toBe(false);
  });
});
