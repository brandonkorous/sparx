'use client';

// Workbench-native PostHog helpers. The provider (components/posthog-provider)
// owns init + autocapture wiring; this module owns the two imperative calls the
// app makes by hand — stamping acquisition attribution onto the person at
// signup, and reporting a crash an error boundary swallowed.
//
// Everything here no-ops safely when PostHog never initialised (local dev, or a
// build shipped without NEXT_PUBLIC_POSTHOG_KEY), so callers never have to guard.

import posthog from 'posthog-js';
import { attrCookies, deserializeSnapshot } from '@wizeworks/attribution';

/** sparx's names — fixed forever; see @wizeworks/attribution's attrCookies. */
const SPARX_ATTR = attrCookies('sparx');

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
  const first = deserializeSnapshot(readCookie(SPARX_ATTR.first));
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

/**
 * Report a crash an error boundary caught, with enough context to find it.
 *
 * Every boundary in this app RECOVERS — a pane falls back to "this panel ran
 * into a problem", a chrome region degrades to a strip, the route boundary
 * offers Try again. That is right for the operator and terrible for us: a
 * recovered crash produces no unhandled rejection, no window `error` event, and
 * nothing in PostHog's autocapture. The better the recovery, the more invisible
 * the bug, so the boundary that swallows an error is the one that has to speak.
 *
 * `context` names WHICH boundary and what it was showing — a pane's surface key,
 * a chrome region's label. Without it every report reads "the workbench threw",
 * which is true of all of them and useful about none.
 */
export function reportCrash(error: unknown, context: Record<string, string>): void {
  if (!posthog.__loaded) return;
  posthog.captureException(error instanceof Error ? error : new Error(String(error)), context);
}
