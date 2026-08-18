'use client';

// Product analytics for the workbench — the operator app that replaced the
// dashboard at app.sparx.works. Initialises PostHog in the browser, captures a
// route-change pageview (the workbench is a client-routed app, so Next's own
// navigations never trigger a full document load), and forwards Core Web Vitals
// as a `web_vitals` event so field performance sits next to the product signal.
//
// One-off imperative calls (the signup first-touch identify) live in
// lib/analytics.ts; this file owns init + the automatic capture wiring only.

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useReportWebVitals } from 'next/web-vitals';
import { Suspense, useEffect } from 'react';
import { useAnalyticsGranted } from '../lib/consent';

function WebVitals() {
  useReportWebVitals((metric) => {
    if (!posthog.__loaded) return;
    // Next's web-vitals metric type doesn't resolve under type-aware lint, and
    // the runtime payload also carries `rating` ('good' | 'needs-improvement' |
    // 'poor'), which isn't on the published type — so read through a typed shape.
    const m = metric as { name: string; value: number; id: string; rating?: string };
    posthog.capture('web_vitals', {
      metric_name: m.name,
      metric_value: m.value,
      metric_id: m.id,
      metric_rating: m.rating,
    });
  });
  return null;
}

function PageViews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname || !posthog.__loaded) return;
    let url = window.location.origin + pathname;
    const params = searchParams?.toString();
    if (params) url += `?${params}`;
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  // CONSENT-GATED, on a decision this app records but does not assume.
  //
  // This used to call `posthog.init()` guarded only by the build mode and the
  // presence of a key — neither of which is consent. Autocapture, pageviews, web
  // vitals and an `identify` carrying first-touch attribution all started on
  // mount, for everybody, unasked.
  //
  // `false` while the read is in flight and `false` when no record exists, which
  // is the direction this is allowed to be wrong in. <ConsentAsk> is what turns
  // the second case into an answer; until it does, nothing runs.
  const granted = useAnalyticsGranted();

  useEffect(() => {
    if (!granted) return;
    // Never init off a non-production build — `pnpm dev` runs with
    // NODE_ENV !== 'production', and the shared key would otherwise pump
    // localhost traffic into the production project and drown real signal.
    if (process.env.NODE_ENV !== 'production') return;
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    // `posthog.init` is not idempotent — a second call on the same key warns and
    // re-registers capture handlers. The effect re-runs whenever `granted`
    // flips, so the already-loaded check is what keeps a cache refetch from
    // double-initialising a live session.
    if (posthog.__loaded) return;

    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      // We drive pageviews by hand from PageViews (SPA route changes); pageleave
      // still fires natively so session duration stays accurate.
      capture_pageview: false,
      capture_pageleave: true,
    });
  }, [granted]);

  return (
    <PHProvider client={posthog}>
      {/* useSearchParams() suspends during prerender — isolate it so it never
          forces the whole tree into a client-side bailout. */}
      <Suspense fallback={null}>
        <PageViews />
      </Suspense>
      <WebVitals />
      {children}
    </PHProvider>
  );
}
