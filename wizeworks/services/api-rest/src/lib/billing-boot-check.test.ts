import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ missing: vi.fn(), plans: vi.fn(() => []) }));

vi.mock('@wizeworks/billing', () => ({
  listBillingPlans: h.plans,
  missingOfferCoupons: h.missing,
}));

import { checkOfferCoupons } from './billing-boot-check.js';

function logger() {
  return { error: vi.fn(), warn: vi.fn() };
}

beforeEach(() => vi.clearAllMocks());

// WW-4: the FOUNDER coupon was missing for weeks and the only sign was a hidden banner.
describe('checkOfferCoupons', () => {
  it('logs the missing coupons at error level', async () => {
    h.missing.mockResolvedValue(['FOUNDER']);
    const log = logger();
    expect(await checkOfferCoupons(log as never)).toEqual(['FOUNDER']);
    expect(log.error).toHaveBeenCalledWith({ missing: ['FOUNDER'] }, expect.any(String));
  });

  it('is quiet when every coupon exists', async () => {
    h.missing.mockResolvedValue([]);
    const log = logger();
    await checkOfferCoupons(log as never);
    expect(log.error).not.toHaveBeenCalled();
  });

  it('does not fail the boot when Stripe cannot be reached', async () => {
    h.missing.mockRejectedValue(new Error('ECONNRESET'));
    const log = logger();
    await expect(checkOfferCoupons(log as never)).resolves.toEqual([]);
    expect(log.warn).toHaveBeenCalled();
  });
});
