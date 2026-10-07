// The public "places left" read: one plan's offer, from Stripe, or null for a plan
// nobody configured (never a 500 for a typo in the query).

import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ standing: vi.fn() }));

vi.mock('@wizeworks/billing', () => ({
  listBillingPlans: () => [{ id: 'flat_offer', offer: { coupon: 'INTRO' } }],
  offerStanding: h.standing,
}));

import publicBillingOfferRoutes from './billing-offer.js';

async function get(plan: string) {
  const app = Fastify();
  await app.register(publicBillingOfferRoutes);
  const res = await app.inject({ method: 'GET', url: `/v1/public/billing/offer?plan=${plan}` });
  await app.close();
  return res;
}

beforeEach(() => {
  h.standing.mockReset();
});

describe('GET /v1/public/billing/offer', () => {
  it('returns the standing of a configured plan, cacheable for a minute', async () => {
    const standing = { coupon: 'INTRO', amountOffCents: 5000, limit: 100, remaining: 37 };
    h.standing.mockResolvedValue(standing);

    const res = await get('flat_offer');

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({ offer: standing });
    expect(res.headers['cache-control']).toContain('max-age=60');
  });

  it('answers null for a plan that does not exist, without asking Stripe', async () => {
    const res = await get('no_such_plan');

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({ offer: null });
    expect(h.standing).not.toHaveBeenCalled();
  });
});
