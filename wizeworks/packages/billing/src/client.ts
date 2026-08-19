// The platform billing Stripe clients — ONE PER PLAN, because WizeWorks bills out
// of more than one Stripe account (distinct from per-tenant commerce Connect in
// @wizeworks/provider-stripe).
//
// This used to be a single memoized client reading a single STRIPE_SECRET_KEY, which
// silently meant every tenant was charged against sparx's account no matter which
// product they signed up for. The account is a property of the tenant's PLAN
// (./plans), so the key env var is too, and callers pass the plan they resolved
// from the tenant. Passing nothing keeps the previous behaviour exactly: the
// default plan, reading STRIPE_SECRET_KEY.
//
// Returns null when that plan's secret is unset, so EVERY billing operation
// degrades to a clean no-op: dev/test never need Stripe, and a plan whose account
// has not been wired yet simply does nothing rather than billing on the wrong one.

import Stripe from 'stripe';

import { listBillingPlans, planFor, type BillingPlan } from './plans';

const API_VERSION = '2024-11-20.acacia';

/** Memoized per SECRET ENV VAR, not per plan — two plans pointed at the same key
 *  are the same account and should share one client and one connection pool. */
const clients = new Map<string, Stripe | null>();

/** Accept a plan object, a plan id, or nothing (the default plan). */
function resolve(plan: BillingPlan | string | null | undefined): BillingPlan {
  return typeof plan === 'object' && plan !== null ? plan : planFor(plan);
}

/** The billing Stripe client for a plan, or null when that plan's key is unset. */
export function getBillingStripe(plan?: BillingPlan | string | null): Stripe | null {
  const resolved = resolve(plan);
  const cached = clients.get(resolved.secretEnv);
  if (cached !== undefined) return cached;
  const key = process.env[resolved.secretEnv]?.trim();
  const client = key
    ? new Stripe(key, {
        apiVersion: API_VERSION as Stripe.LatestApiVersion,
        typescript: true,
        appInfo: { name: `wizeworks-billing/${resolved.id}`, version: '0.0.0' },
      })
    : null;
  clients.set(resolved.secretEnv, client);
  return client;
}

/** True once a Stripe secret is configured for this plan. Callers gate side
 *  effects on this so an unwired plan skips Stripe entirely. */
export function isBillingConfigured(plan?: BillingPlan | string | null): boolean {
  return getBillingStripe(plan) !== null;
}

/** True when ANY registered plan has a key — i.e. this environment can bill at all.
 *  The cheap pre-check for a path that would otherwise have to read the tenant row
 *  just to discover there is no Stripe anywhere. Per-plan `isBillingConfigured` is
 *  still what decides whether a PARTICULAR tenant's account is wired. */
export function anyBillingConfigured(): boolean {
  return listBillingPlans().some((plan) => getBillingStripe(plan) !== null);
}

/** Test seam — clears the memoized clients so a test can flip env between cases. */
export function resetBillingStripeForTesting(): void {
  clients.clear();
}
