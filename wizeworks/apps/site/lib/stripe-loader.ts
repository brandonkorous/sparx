// One Stripe.js loader for the whole storefront.
//
// `loadStripe` is meant to run once per publishable key, and the cache is keyed
// rather than a single slot: two tenants on different Stripe accounts in the
// same browser session must not hand each other's Elements the wrong key.
//
// Shared by checkout (paying) and the save-card page (vaulting) — they mount the
// same Elements against the same account, so a second cache here would mean a
// second Stripe.js load and, worse, two places to fix when the key resolution
// changes.

import { loadStripe, type Stripe } from '@stripe/stripe-js';

// sparx's own publishable key, inlined at BUILD time (see wizeworks/apps/site/Dockerfile).
// Correct for sparx Pay, whose intents are destination charges on sparx's
// platform account. A `stripe_direct` tenant's intent lives on the merchant's
// account and comes back with its own `publishableKey`, which wins over this.
export const PLATFORM_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

const stripePromises = new Map<string, Promise<Stripe | null>>();

export function getStripe(publishableKey: string): Promise<Stripe | null> {
  let promise = stripePromises.get(publishableKey);
  if (!promise) {
    promise = loadStripe(publishableKey);
    stripePromises.set(publishableKey, promise);
  }
  return promise;
}
