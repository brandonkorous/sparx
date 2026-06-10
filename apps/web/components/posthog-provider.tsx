'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useReportWebVitals } from 'next/web-vitals';
import { useEffect, Suspense } from 'react';
import { gateTracker } from '../lib/consent';

// Core Web Vitals → PostHog (docs/50 §4). Reports LCP / CLS / INP / FCP / TTFB
// as a `web_vitals` event so field performance is trackable next to the rest of
// product analytics. `rating` ('good'|'needs-improvement'|'poor') isn't on Next's
// metric type but the web-vitals payload carries it, so we read it defensively.
function PostHogWebVitals() {
  useReportWebVitals((metric) => {
    if (!posthog.__loaded) return;
    // Next's web-vitals metric type doesn't resolve under type-aware lint, and the
    // payload also carries `rating` ('good'|'needs-improvement'|'poor') which isn't
    // on the published type — so normalize to a typed shape before reading.
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

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname && posthog.__loaded) {
      let url = window.location.origin + pathname;
      const params = searchParams?.toString();
      if (params) url += `?${params}`;
      posthog.capture('$pageview', { $current_url: url });
    }
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    // Analytics is consent-gated (docs/42). PostHog only initialises once the
    // visitor grants the `analytics` category — immediately if they already have,
    // otherwise the moment they accept. Until then no PostHog cookies or network
    // calls fire. gateTracker returns an unsubscribe fn for cleanup.
    return gateTracker({
      category: 'analytics',
      load: () => {
        posthog.init(key, {
          api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
          person_profiles: 'identified_only',
          capture_pageview: false,
          capture_pageleave: true,
        });
      },
    });
  }, []);

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      <PostHogWebVitals />
      {children}
    </PHProvider>
  );
}
