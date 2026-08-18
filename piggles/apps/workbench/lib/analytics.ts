'use client';

// Console-native PostHog helpers. The provider (components/posthog-provider)
// owns init + autocapture wiring; this module owns the one imperative call the
// app makes by hand — reporting a crash an error boundary swallowed.
//
// It no-ops safely when PostHog never initialised (local dev, a build shipped
// without NEXT_PUBLIC_POSTHOG_KEY, or an operator who declined analytics), so
// callers never have to guard.

import posthog from 'posthog-js';

// ── WHY THERE IS NO FIRST-TOUCH IDENTIFY HERE ───────────────────────────────
//
// There was one, and it could never have worked. It read `sparx_attr_first` —
// a cookie set on `.sparx.works` — from mypiggles.com, which is a different
// registrable domain and cannot see it. Renaming it to `piggles_attr_first`
// would have moved the bug rather than fixed it: Piggles' attribution cookie
// lives on `.meetpiggles.com`, and this app cannot read that either. Nothing
// called the function, so it failed silently in the only way dead code can.
//
// Where the answer actually is: the marketing site hands attribution to the
// account app in the signup link, and the account app writes it onto the TENANT
// at provisioning (`acquisition_channel` and friends). A console that wants
// first touch on the PostHog person reads it from the tenant, not from a cookie.

export function reportCrash(error: unknown, context: Record<string, string>): void {
  if (!posthog.__loaded) return;
  posthog.captureException(error instanceof Error ? error : new Error(String(error)), context);
}
