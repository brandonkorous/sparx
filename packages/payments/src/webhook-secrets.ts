// Stripe webhook signing secrets — a LIST, not a single value (docs/94 ADR §10).
//
// One URL legitimately receives events verified by more than one secret, because a
// Stripe endpoint listens to exactly one scope:
//
//   • "Events on your account"    → payment_intent.* / charge.*  (destination charges
//     are created ON the platform account, so they arrive here)
//   • "Events on connected accounts" → account.updated  (Connect events — the ONLY way
//     to learn a merchant finished onboarding or got restricted)
//
// Both must point at /v1/public/webhooks/sparx-pay, and Stripe issues each endpoint its
// OWN `whsec_…`. A single-secret reader would 403 every event from the second endpoint.
// Secret ROTATION has the same shape: Stripe's "roll secret" leaves the old one valid
// for 24h, so both must verify during the overlap.
//
// So every webhook secret env var here is a COMMA-SEPARATED LIST. One value is the
// ordinary case and reads exactly like a plain secret.

import Stripe from 'stripe';

/** Split a webhook-secret env value into its individual `whsec_…` secrets.
 *  Accepts commas, whitespace, or newlines; trims, drops empties, dedupes. */
export function parseWebhookSecrets(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const parts = raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return [...new Set(parts)];
}

/** Verify + parse a Stripe event against EVERY configured secret, returning the first
 *  that validates. Null when none do (bad signature, or no secrets configured) — the
 *  caller decides whether that's a 403 or a warn-and-ack. */
export function constructEventWithAnySecret(
  rawBody: Buffer | string,
  signature: string,
  secrets: string[]
): Stripe.Event | null {
  for (const secret of secrets) {
    try {
      return Stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      // Wrong secret for this endpoint — try the next. A genuinely invalid
      // signature falls through every secret and returns null.
    }
  }
  return null;
}
