'use client';

// Product analytics for meetpiggles.com — the marketing site.
//
// ── WHY THIS EXISTS, WHEN THIS SITE DELIBERATELY HAD NO TAGS ────────────────
//
// The site already remembers WHERE a visit came from (lib/attribution.ts), and
// that record only ever surfaces if the person goes on to create an account. It
// answers "which channel produced a customer" and cannot answer "how many people
// arrived at all" — a visitor who reads a page and leaves is invisible to it,
// permanently, because attribution is written once at signup.
//
// For a campaign whose whole point is reach — a QR code somebody scans off a
// screen, a link in a video description — the arrivals ARE the number, and the
// signups are a fraction of it we would otherwise be dividing by nothing. So the
// site now counts landings too.
//
// ── IT IS THE SAME CONSENT, NOT A NEW ONE ───────────────────────────────────
//
// This runs behind the `analytics` grant the consent bar already asks for, via
// the same `gateTracker` seam as the attribution capture. No second bar, no
// second question, and nothing before the answer: a visitor who ignores the bar
// is a visitor who has not agreed, and PostHog never initialises for them.
//
// That is worth stating plainly because it bounds what these numbers mean: they
// count people who arrived AND accepted. They are a floor on traffic, never a
// measurement of it, and anywhere they are reported they have to say so.
//
// ── AND IT IS A CHANGE TO /cookies AND /privacy ─────────────────────────────
//
// Adding a tag to this site makes app/cookies/cookie-list.ts wrong until it is
// updated, and moves PostHog from "workbench-only" to a sub-processor this
// domain also uses. Both were updated with this file. If PostHog is ever removed
// from here, both are wrong again in the other direction.

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { gateTracker } from '@/lib/consent';

/**
 * True once the visitor has granted `analytics`, as React state.
 *
 * State rather than a bare `gateTracker` call because the grant usually arrives
 * AFTER mount — somebody lands, reads the bar, then accepts. Everything below
 * has to re-run at that moment or the landing pageview, which is the one that
 * carries the campaign, is the single event we never record.
 */
function useAnalyticsGranted(): boolean {
  const [granted, setGranted] = useState(false);
  useEffect(() => gateTracker({ category: 'analytics', load: () => setGranted(true) }), []);
  return granted;
}

function PageViews({ ready }: { ready: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!ready || !pathname || !posthog.__loaded) return;
    let url = window.location.origin + pathname;
    const params = searchParams?.toString();
    if (params) url += `?${params}`;
    // The utm_* parameters are still on the URL at this point and posthog-js
    // reads them off it for every event, so a landing captured a beat late — the
    // moment consent lands — still carries the campaign that produced it.
    posthog.capture('$pageview', { $current_url: url });
  }, [ready, pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const granted = useAnalyticsGranted();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!granted) return;
    // Never init off a non-production build — `pnpm dev` runs with
    // NODE_ENV !== 'production', and the shared key would otherwise pump
    // localhost traffic into the production project and drown real signal.
    if (process.env.NODE_ENV !== 'production') return;
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    // `posthog.init` is not idempotent — a second call on the same key warns and
    // re-registers capture handlers.
    if (!posthog.__loaded) {
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
        // Nobody on this site is signed in, so there is nobody to build a person
        // profile OF. `identified_only` means an anonymous marketing visit stays
        // an event and never becomes a stored person record.
        person_profiles: 'identified_only',
        // Driven by hand from PageViews below: the App Router navigates between
        // marketing pages client-side, so the browser's own load event fires once
        // and every page after the first would go uncounted.
        capture_pageview: false,
        capture_pageleave: true,
      });
    }
    setReady(true);
  }, [granted]);

  return (
    <PHProvider client={posthog}>
      {/* useSearchParams() suspends during prerender — isolate it so it never
          forces the whole tree into a client-side bailout. */}
      <Suspense fallback={null}>
        <PageViews ready={ready} />
      </Suspense>
      {children}
    </PHProvider>
  );
}
