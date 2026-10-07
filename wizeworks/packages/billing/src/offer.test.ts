import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ retrieve: vi.fn(), configured: true }));

vi.mock('./client', () => ({
  getBillingStripe: () => (h.configured ? { coupons: { retrieve: h.retrieve } } : null),
}));

import { offerStanding } from './offer';
import type { BillingPlan } from './plans';

const PLAN: BillingPlan = {
  id: 'offer_test',
  label: 'Flat monthly',
  shape: 'flat',
  secretEnv: 'X_KEY',
  webhookSecretEnv: 'X_HOOK',
  base: { product: 'p', lookupKey: 'l', priceEnv: 'P', monthlyCents: 9900 },
  offer: { coupon: 'INTRO', amountOffCents: 5000, limit: 100 },
};

beforeEach(() => {
  vi.clearAllMocks();
  h.configured = true;
});

describe('offerStanding', () => {
  it('counts the places left from the coupon Stripe holds', async () => {
    h.retrieve.mockResolvedValue({
      valid: true,
      max_redemptions: 100,
      times_redeemed: 63,
      amount_off: 5000,
    });

    expect(await offerStanding(PLAN)).toEqual({
      coupon: 'INTRO',
      amountOffCents: 5000,
      limit: 100,
      remaining: 37,
    });
  });

  it('reports none left once Stripe marks the coupon spent', async () => {
    h.retrieve.mockResolvedValue({
      valid: false,
      max_redemptions: 100,
      times_redeemed: 100,
      amount_off: 5000,
    });

    expect((await offerStanding(PLAN))?.remaining).toBe(0);
  });

  it('reports none left when the coupon was never created, rather than the full limit', async () => {
    h.retrieve.mockRejectedValue(Object.assign(new Error('No such coupon'), { statusCode: 404 }));

    expect((await offerStanding(PLAN))?.remaining).toBe(0);
  });

  it('has nothing to report for a plan with no offer or no wired account', async () => {
    expect(await offerStanding({ ...PLAN, offer: undefined })).toBeNull();
    h.configured = false;
    expect(await offerStanding(PLAN)).toBeNull();
  });
});
