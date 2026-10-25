import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ retrieve: vi.fn(), configured: true }));

vi.mock('./client', () => ({
  getBillingStripe: () => (h.configured ? { coupons: { retrieve: h.retrieve } } : null),
}));

import { missingOfferCoupons, offerStanding, resetMissingCouponReportsForTesting } from './offer';
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
  resetMissingCouponReportsForTesting();
});

const missing = () => Object.assign(new Error('No such coupon'), { statusCode: 404 });

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
      state: 'open',
    });
  });

  it('reports none left once Stripe marks the coupon spent', async () => {
    h.retrieve.mockResolvedValue({
      valid: false,
      max_redemptions: 100,
      times_redeemed: 100,
      amount_off: 5000,
    });

    expect(await offerStanding(PLAN)).toMatchObject({ remaining: 0, state: 'spent' });
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

// WW-4: Piggles' FOUNDER coupon was never created in production. Every read 404'd,
// the banner hid itself and checkout carried no discount, and nothing logged a word.
describe('a configured coupon Stripe does not have', () => {
  it('is misconfigured, logged once at error level', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.retrieve.mockRejectedValue(missing());

    expect(await offerStanding(PLAN)).toMatchObject({ remaining: 0, state: 'misconfigured' });
    await offerStanding(PLAN);

    expect(error).toHaveBeenCalledOnce();
    expect(String(error.mock.calls[0]?.[0])).toContain('"INTRO" does not exist');
    error.mockRestore();
  });

  it('is named by the boot check', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.retrieve.mockRejectedValue(missing());
    expect(
      await missingOfferCoupons([PLAN, { ...PLAN, id: 'no_offer', offer: undefined }])
    ).toEqual(['INTRO']);
  });

  it('boot check is empty when every coupon exists', async () => {
    h.retrieve.mockResolvedValue({ valid: true, max_redemptions: 100, times_redeemed: 0 });
    expect(await missingOfferCoupons([PLAN])).toEqual([]);
  });
});
