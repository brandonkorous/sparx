// The webhook addresses for the merchant's own Square, PayPal, Authorize.net and
// custom gateway (issue 739). They did not exist: each adapter could read a
// webhook, the console asked for the keys to check one, and there was nowhere
// for one to arrive. A message is read only when it is signed with the
// tenant's own key; anything else is refused before it reaches an order.

import { createHmac } from 'node:crypto';

import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  gatewayRegistry,
  SquareGateway,
  setGatewayCredentialReader,
  type GatewayCredentials,
} from '@wizeworks/payments';

const TENANT = '2e78fb6c-a823-4698-bcb9-58a4f17710a0';
const BASE = 'https://api.example.test';

const reconcilePaymentEvent = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock('../../../lib/payment-webhook-reconcile.js', () => ({ reconcilePaymentEvent }));
vi.mock('../../../lib/payments-onboarding.js', () => {
  const WEBHOOK_PATHS: Record<string, string> = {
    stripe_direct: 'stripe-direct',
    square: 'square',
    paypal: 'paypal',
    authorize_net: 'authorize-net',
    custom: 'custom',
  };
  return {
    WEBHOOK_PATHS,
    gatewayWebhookUrl: (gatewayId: string, tenantId: string) =>
      `${BASE}/v1/public/webhooks/${WEBHOOK_PATHS[gatewayId] ?? ''}/${tenantId}`,
  };
});

const { default: routes } = await import('./payments.js');

async function app() {
  const a = Fastify();
  await a.register(routes);
  return a;
}

function useCredentials(creds: GatewayCredentials | null): void {
  setGatewayCredentialReader({ read: () => Promise.resolve(creds) });
}

const body = JSON.stringify({
  event_id: 'e1',
  type: 'refund.updated',
  data: {
    object: {
      refund: { id: 'r1', payment_id: 'pay1', amount_money: { amount: 2000, currency: 'USD' } },
    },
  },
});
const url = `${BASE}/v1/public/webhooks/square/${TENANT}`;

beforeEach(() => {
  gatewayRegistry.register(new SquareGateway());
  vi.clearAllMocks();
});

afterEach(() => {
  useCredentials(null);
});

describe("the merchant's own gateways have a webhook address", () => {
  it('reads a Square message signed with her key, over the address it was sent to', async () => {
    useCredentials({
      gatewayId: 'square',
      environment: 'sandbox',
      secrets: { access_token: 'sq', webhook_signature_key: 'sig-key' },
      publicMeta: { location_id: 'L1' },
    });
    const signature = createHmac('sha256', 'sig-key')
      .update(url + body)
      .digest('base64');
    const res = await (
      await app()
    ).inject({
      method: 'POST',
      url: `/v1/public/webhooks/square/${TENANT}`,
      headers: { 'content-type': 'application/json', 'x-square-hmacsha256-signature': signature },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    expect(reconcilePaymentEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'payment.refunded', tenantId: TENANT }),
      { gatewayId: 'square', fallbackTenantId: TENANT }
    );
  });

  it('refuses a message when she has set no key, and touches no order', async () => {
    useCredentials({
      gatewayId: 'square',
      environment: 'sandbox',
      secrets: { access_token: 'sq' },
      publicMeta: { location_id: 'L1' },
    });
    const res = await (
      await app()
    ).inject({
      method: 'POST',
      url: `/v1/public/webhooks/square/${TENANT}`,
      headers: { 'content-type': 'application/json', 'x-square-hmacsha256-signature': 'forged' },
      payload: body,
    });
    expect(res.statusCode).toBe(403);
    expect(reconcilePaymentEvent).not.toHaveBeenCalled();
  });

  it('refuses a message with no signature at all', async () => {
    const res = await (
      await app()
    ).inject({
      method: 'POST',
      url: `/v1/public/webhooks/square/${TENANT}`,
      headers: { 'content-type': 'application/json' },
      payload: body,
    });
    expect(res.statusCode).toBe(422);
    expect(reconcilePaymentEvent).not.toHaveBeenCalled();
  });

  it.each(['paypal', 'authorize-net', 'custom'])('has an address for %s', async (path) => {
    const res = await (
      await app()
    ).inject({
      method: 'POST',
      url: `/v1/public/webhooks/${path}/${TENANT}`,
      headers: { 'content-type': 'application/json' },
      payload: body,
    });
    // Missing its signature header: the route exists and refuses, not a 404.
    expect(res.statusCode).toBe(422);
  });
});
