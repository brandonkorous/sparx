// Per-pod offer standings, stale-while-revalidate and warmed at boot, so no visitor
// waits on Stripe: a miss used to cost ~1.9 s once a minute per pod (PG-2.3).

import type { FastifyBaseLogger } from 'fastify';
import { listBillingPlans, offerStanding, type OfferStanding } from '@wizeworks/billing';

import { createSwrCache } from './swr-cache.js';

const standings = createSwrCache<OfferStanding | null>({
  freshMs: 60_000,
  maxStaleMs: 60 * 60_000,
  onRefreshError: (plan, err) => console.warn(`billing: offer refresh failed for ${plan}`, err),
});

/** A plan id nobody configured has no offer, rather than a 500 for a typo. */
function load(planId: string): Promise<OfferStanding | null> {
  const plan = listBillingPlans().find((p) => p.id === planId);
  return plan ? offerStanding(plan) : Promise.resolve(null);
}

/** One plan's offer standing; only a cold pod's first read waits on Stripe. */
export function offerStandingFor(planId: string): Promise<OfferStanding | null> {
  return standings.get(planId, () => load(planId));
}

/** Loads every plan's offer once at boot, so the first visitor reads a warm cache. */
export async function prewarmOfferStandings(log: FastifyBaseLogger): Promise<void> {
  const plans = listBillingPlans().filter((p) => p.offer);
  const results = await Promise.allSettled(plans.map((p) => offerStandingFor(p.id)));
  const failed = results.filter((r) => r.status === 'rejected').length;
  if (failed) log.warn({ failed }, 'billing: could not warm every offer standing');
}
