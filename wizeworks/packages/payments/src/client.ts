// The platform Stripe client — the single WizeWorks platform account that acts as
// the Connect *platform* for sparx Pay destination charges. Same account + key as
// platform module billing (`STRIPE_SECRET_KEY`); a Stripe platform account both runs
// its own billing subscriptions and hosts connected accounts.
//
// Returns null when the key is unset so callers degrade cleanly in dev/test.

import Stripe from 'stripe';

const API_VERSION = '2024-11-20.acacia';

let cached: Stripe | null | undefined;

/** The platform Stripe client, or null when `STRIPE_SECRET_KEY` is unset. */
export function getPlatformStripe(): Stripe | null {
  if (cached !== undefined) return cached;
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  cached = key
    ? new Stripe(key, {
        apiVersion: API_VERSION as Stripe.LatestApiVersion,
        typescript: true,
        appInfo: { name: 'sparx-payments', version: '0.0.0' },
      })
    : null;
  return cached;
}

/** Build a Stripe client for an arbitrary secret key (a merchant's own account, for
 *  the Stripe Direct gateway). Not cached — keys vary per tenant. */
export function stripeForKey(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: API_VERSION as Stripe.LatestApiVersion,
    typescript: true,
    appInfo: { name: 'sparx-payments', version: '0.0.0' },
  });
}

/** Test seam — clears the memoized platform client between cases. */
export function resetPlatformStripeForTesting(): void {
  cached = undefined;
}

export { API_VERSION as STRIPE_API_VERSION };
