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
  useEffect(() => {
    // Never init off a non-production build — `pnpm dev` runs with
    // NODE_ENV !== 'production', and the shared key would otherwise pump
    // localhost traffic into the production project and drown real signal.
    if (process.env.NODE_ENV !== 'production') return;
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      // We drive pageviews by hand from PageViews (SPA route changes); pageleave
      // still fires natively so session duration stays accurate.
      capture_pageview: false,
      capture_pageleave: true,
    });
  }, []);

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
