// The platform billing Stripe client — the single WizeWorks account that charges
// tenants for modules (distinct from per-tenant commerce Connect in
// @sparx/provider-stripe).
//
// Returns null when STRIPE_SECRET_KEY is unset, so EVERY billing operation
// degrades to a clean no-op: dev/test never need Stripe, and the engine ships
// before the prod ops (Stripe products, price IDs, webhook registration) land.

import Stripe from 'stripe';

const API_VERSION = '2024-11-20.acacia';

let cached: Stripe | null | undefined;

/** The platform billing Stripe client, or null when unconfigured. Cached per
 *  process (the secret doesn't change at runtime). */
export function getBillingStripe(): Stripe | null {
  if (cached !== undefined) return cached;
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  cached = key
    ? new Stripe(key, {
        apiVersion: API_VERSION as Stripe.LatestApiVersion,
        typescript: true,
        appInfo: { name: 'sparx-billing', version: '0.0.0' },
      })
    : null;
  return cached;
}

/** True once a platform Stripe secret is configured. Callers gate side effects on
 *  this so an unconfigured environment skips Stripe entirely. */
export function isBillingConfigured(): boolean {
  return getBillingStripe() !== null;
}

/** Test seam — clears the memoized client so a test can flip env between cases. */
export function resetBillingStripeForTesting(): void {
  cached = undefined;
}
