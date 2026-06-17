// Pure-logic tests for @sparx/payments — the fee rule, the registry, and webhook
// normalization. The gateways' Stripe calls + PaymentService's DB writes are exercised
// by integration tests; here we lock the parts that decide money + routing.

import type Stripe from 'stripe';
import { describe, expect, it } from 'vitest';

import { SPARX_PAY_FEE_RATE, sparxPayFeeCents } from './fee';
import { GatewayNotFoundError, gatewayRegistry, registerBuiltInGateways } from './registry';
import { normalizeStripeEvent } from './stripe-util';
import { SparxPayGateway, SPARX_PAY_ID } from './gateways/sparx-pay';
import { StripeDirectGateway, STRIPE_DIRECT_ID } from './gateways/stripe-direct';

describe('fee rule (docs/94 §8)', () => {
  it('is a flat 0.5%', () => {
    expect(SPARX_PAY_FEE_RATE).toBe(0.005);
    expect(sparxPayFeeCents(100_00)).toBe(50); // $100 → $0.50
    expect(sparxPayFeeCents(0)).toBe(0);
    expect(sparxPayFeeCents(199)).toBe(1); // rounds (0.995 → 1)
  });
});

describe('gateway registry', () => {
  it('registers and resolves the built-in gateways by id', () => {
    registerBuiltInGateways([new SparxPayGateway(), new StripeDirectGateway()]);
    expect(gatewayRegistry.get(SPARX_PAY_ID).name).toBe('sparx Pay');
    expect(gatewayRegistry.get(STRIPE_DIRECT_ID).id).toBe('stripe_direct');
    expect(gatewayRegistry.has(SPARX_PAY_ID)).toBe(true);
  });

  it('throws for an unknown gateway id', () => {
    expect(() => gatewayRegistry.get('does_not_exist')).toThrow(GatewayNotFoundError);
  });
});

describe('normalizeStripeEvent (docs/94 §10)', () => {
  const event = (type: string, object: unknown): Stripe.Event =>
    ({ id: 'evt_1', type, data: { object } }) as unknown as Stripe.Event;

  it('maps payment_intent.succeeded → payment.succeeded with the tenant from metadata', () => {
    const out = normalizeStripeEvent(
      event('payment_intent.succeeded', { metadata: { tenantId: 't1' } })
    );
    expect(out).toMatchObject({
      type: 'payment.succeeded',
      tenantId: 't1',
      externalId: 'evt_1',
      providerEventType: 'payment_intent.succeeded',
    });
  });

  it('maps payment_intent.payment_failed → payment.failed', () => {
    expect(normalizeStripeEvent(event('payment_intent.payment_failed', {})).type).toBe(
      'payment.failed'
    );
  });

  it('maps charge.refunded → payment.refunded', () => {
    expect(normalizeStripeEvent(event('charge.refunded', {})).type).toBe('payment.refunded');
  });

  it('maps disputes and account.updated', () => {
    expect(normalizeStripeEvent(event('charge.dispute.created', {})).type).toBe('dispute.created');
    expect(normalizeStripeEvent(event('account.updated', {})).type).toBe('account.updated');
  });

  it('marks unknown event types ignored', () => {
    expect(normalizeStripeEvent(event('invoice.created', {})).type).toBe('ignored');
  });
});
