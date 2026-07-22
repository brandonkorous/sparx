'use client';

// Workbench-native PostHog helpers. The provider (components/posthog-provider)
// owns init + autocapture wiring; this module owns the one imperative call the
// app makes by hand — stamping acquisition attribution onto the person at signup.
//
// Everything here no-ops safely when PostHog never initialised (local dev, or a
// build shipped without NEXT_PUBLIC_POSTHOG_KEY), so callers never have to guard.

import posthog from 'posthog-js';
import { ATTR_COOKIES, deserializeSnapshot } from '@sparx/attribution';

function readCookie(name: string): string | null {
  const match = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(document.cookie);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/**
 * Stamp first-touch acquisition onto the PostHog person at account creation
 * (docs/80 §6.1). The `$set_once` (third identify arg) means a later session can
 * never overwrite the original source — the channel that first brought this
 * operator in stays the credited one for the life of the person.
 *
 * Reads the first-touch snapshot the marketing site set in the `sparx_attr_first`
 * cookie; a signup that arrived with no cookie (direct, or attribution disabled)
 * still identifies the person, just without the first-touch properties.
 */
export function identifyFirstTouch(userId: string): void {
  if (!userId || !posthog.__loaded) return;
  const first = deserializeSnapshot(readCookie(ATTR_COOKIES.first));
  posthog.identify(
    userId,
    {},
    first
      ? {
          first_touch_channel: first.channel,
          first_touch_source: first.source,
          first_touch_campaign: first.campaign,
          first_touch_at: first.capturedAt,
        }
      : {}
  );
}
