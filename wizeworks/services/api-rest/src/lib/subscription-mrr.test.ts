import type Stripe from 'stripe';
import { describe, expect, it } from 'vitest';

import { monthlyRecurringCents } from './subscription-mrr.js';

function sub(discount: Partial<Stripe.Coupon> | null): Stripe.Subscription {
  return {
    items: {
      data: [
        {
          quantity: 1,
          price: { unit_amount: 9900, recurring: { interval: 'month', interval_count: 1 } },
        },
      ],
    },
    discount: discount ? { coupon: discount } : null,
  } as unknown as Stripe.Subscription;
}

describe('monthlyRecurringCents', () => {
  it('is the full price with no discount', () => {
    expect(monthlyRecurringCents(sub(null))).toBe(9900);
  });

  it('takes off a fixed discount kept for the life of the subscription', () => {
    expect(monthlyRecurringCents(sub({ duration: 'forever', amount_off: 5000 }))).toBe(4900);
  });

  it('takes off a lasting percentage discount', () => {
    expect(monthlyRecurringCents(sub({ duration: 'forever', percent_off: 50 }))).toBe(4950);
  });

  it('ignores a discount that runs out, since that revenue comes back', () => {
    expect(monthlyRecurringCents(sub({ duration: 'repeating', amount_off: 5000 }))).toBe(9900);
  });
});
