import type Stripe from 'stripe';
import { describe, expect, it, vi } from 'vitest';

import { lookedUpIntent, lookupStripePayment } from './stripe-util';

/**
 * Asking Stripe where a payment stands (issue 739), so a shop with no webhook
 * still has its card orders marked paid. The answer is in the webhook's words,
 * with the webhook's amounts, so the same handlers apply to both.
 */

const intent = (over: Partial<Stripe.PaymentIntent>): Stripe.PaymentIntent =>
  ({
    id: 'pi_juniper',
    amount: 15_821,
    amount_received: 0,
    amount_capturable: 0,
    currency: 'usd',
    status: 'requires_payment_method',
    metadata: { tenantId: 't-juniper', orderId: 'order-31' },
    last_payment_error: null,
    ...over,
  }) as Stripe.PaymentIntent;

describe('lookedUpIntent', () => {
  it('a charge that went through is succeeded, for the amount received', () => {
    const found = lookedUpIntent(intent({ status: 'succeeded', amount_received: 15_821 }));
    expect(found.status).toBe('succeeded');
    expect(found.data).toMatchObject({
      chargeId: 'pi_juniper',
      amountCents: 15_821,
      currency: 'usd',
      orderId: 'order-31',
    });
  });

  it('a held card is authorized, for the amount held', () => {
    const found = lookedUpIntent(intent({ status: 'requires_capture', amount_capturable: 12_000 }));
    expect(found).toMatchObject({ status: 'authorized', data: { amountCents: 12_000 } });
  });

  it('a declined card is failed; a card never tried is pending', () => {
    const declined = intent({
      last_payment_error: { code: 'card_declined', message: 'Declined' } as never,
    });
    expect(lookedUpIntent(declined).status).toBe('failed');
    expect(lookedUpIntent(intent({})).status).toBe('pending');
  });

  it('a payment still being worked on is pending', () => {
    for (const status of ['processing', 'requires_action', 'requires_confirmation'] as const) {
      expect(lookedUpIntent(intent({ status })).status, status).toBe('pending');
    }
  });
});

describe('lookupStripePayment', () => {
  it('only looks up an intent id', async () => {
    const retrieve = vi.fn(() => Promise.resolve(intent({ status: 'succeeded' })));
    const stripe = { paymentIntents: { retrieve } } as unknown as Stripe;
    expect(await lookupStripePayment(stripe, 'seti_123')).toBeNull();
    expect(retrieve).not.toHaveBeenCalled();
    expect((await lookupStripePayment(stripe, 'pi_juniper'))?.status).toBe('succeeded');
    expect(retrieve).toHaveBeenCalledWith('pi_juniper');
  });
});
