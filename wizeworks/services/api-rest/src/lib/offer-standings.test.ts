import { describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ standing: vi.fn() }));

vi.mock('@wizeworks/billing', () => ({
  listBillingPlans: () => [{ id: 'flat_offer', offer: { coupon: 'INTRO' } }, { id: 'no_offer' }],
  offerStanding: h.standing,
}));

import { offerStandingFor, prewarmOfferStandings } from './offer-standings.js';

// PG-2.3: the first visitor after each minute waited ~1.9 s on Stripe.
describe('prewarmOfferStandings', () => {
  it('loads every offer at boot, so the first visitor does not wait on Stripe', async () => {
    h.standing.mockResolvedValue({ coupon: 'INTRO', remaining: 37 });
    await prewarmOfferStandings({ warn: vi.fn() } as never);
    expect(h.standing).toHaveBeenCalledOnce();

    expect(await offerStandingFor('flat_offer')).toEqual({ coupon: 'INTRO', remaining: 37 });
    expect(h.standing).toHaveBeenCalledOnce();
  });
});
