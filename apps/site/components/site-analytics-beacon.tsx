'use client';

// First-party site-analytics beacon (docs/97 §5, docs/08). Fires one cookieless
// pageview per navigation to POST /v1/public/site/collect — the server derives a
// salted, daily-rotating visitor hash from the request IP + UA and stores NO PII
// (lib/site-analytics.ts). Nothing is read or written on the client: no cookie,
// no localStorage, no fingerprint.
//
// Suppressed when the visitor sets Do-Not-Track, or when the tenant runs a cookie
// consent mode and the `analytics` category hasn't been granted (the layout
// mirrors the decision onto <html data-consent>). Uses navigator.sendBeacon so
// the hit survives an immediate navigation, falling back to keepalive fetch.

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface SiteAnalyticsBeaconProps {
  /** Browser-reachable public API origin (NEXT_PUBLIC_API_URL). */
  apiUrl: string;
  /** Tenant slug — resolves the tenant server-side via `?tenant=`. */
  tenantSlug: string;
  /** Active site slug, so per-property reporting attributes the hit. */
  propertySlug?: string;
}

function analyticsAllowed(): boolean {
  if (typeof navigator !== 'undefined' && navigator.doNotTrack === '1') return false;
  if (typeof document === 'undefined') return false;
  // Consent mode active → require the `analytics` category. Absent attribute
  // means the tenant runs no consent gate, so cookieless analytics may proceed.
  const consent = document.documentElement.getAttribute('data-consent');
  if (consent !== null && !consent.split(/\s+/).includes('analytics')) return false;
  return true;
}

// The layout-shift entry shape (not in the standard lib.dom types).
interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

// Capture this page load's core web vitals (load time, LCP, CLS) via native
// PerformanceObserver — no web-vitals dependency. LCP keeps the last entry and
// CLS accumulates until the page is first hidden; the page load time comes from
// Navigation Timing. `report` is invoked at most once, on the first
// visibility-hidden / pagehide. Returns a cleanup that tears the observers down.
function observeWebVitals(report: (vitals: Record<string, number>) => void): () => void {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
    return () => undefined;
  }
  let lcp = 0;
  let cls = 0;
  const observers: PerformanceObserver[] = [];
  const observe = (type: string, cb: (entries: PerformanceEntryList) => void): void => {
    try {
      const po = new PerformanceObserver((list) => cb(list.getEntries()));
      po.observe({ type, buffered: true });
      observers.push(po);
    } catch {
      // Entry type unsupported in this browser — that metric is simply omitted.
    }
  };

  observe('largest-contentful-paint', (entries) => {
    const last = entries[entries.length - 1];
    if (last) lcp = last.startTime;
  });
  observe('layout-shift', (entries) => {
    for (const e of entries as LayoutShiftEntry[]) {
      if (!e.hadRecentInput) cls += e.value;
    }
  });

  let sent = false;
  const finalize = (): void => {
    if (sent) return;
    sent = true;
    const vitals: Record<string, number> = {};
    const nav = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (nav && nav.loadEventEnd > 0) vitals.load = Math.round(nav.loadEventEnd);
    if (lcp > 0) vitals.lcp = Math.round(lcp);
    vitals.cls = Math.round(cls * 1000) / 1000;
    for (const po of observers) po.disconnect();
    report(vitals);
  };

  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') finalize();
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', finalize);

  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', finalize);
    for (const po of observers) po.disconnect();
  };
}

// POST a collect payload via keepalive fetch (survives an immediate
// navigation almost as well as sendBeacon). Deliberately NOT navigator.
// sendBeacon: the Beacon API always sends the browser's cookies for the
// target origin with no way to opt out, which — since apiUrl is a different
// origin from the site in both dev and prod — turns every hit into a
// credentialed cross-origin request. api-rest's CORS reflects the origin but
// (correctly) doesn't allow credentials, so the browser blocks the beacon
// outright instead of just dropping the cookie. This endpoint is cookieless
// by design (see file header), so `credentials: 'omit'` is the honest fetch
// option, not a workaround. Never throws.
function postBeacon(url: string, payload: string): void {
  try {
    void fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
      keepalive: true,
      credentials: 'omit',
    }).catch(() => undefined);
  } catch {
    // Analytics must never break a page render.
  }
}

export function SiteAnalyticsBeacon({
  apiUrl,
  tenantSlug,
  propertySlug,
}: SiteAnalyticsBeaconProps) {
  const pathname = usePathname();
  // Guard against double-fire under React strict-mode's dev double-invoke and
  // against re-sending the same path twice in a row.
  const lastSent = useRef<string | null>(null);

  // Pageview — one per navigation.
  useEffect(() => {
    if (!apiUrl || !tenantSlug || !pathname) return;
    if (lastSent.current === pathname) return;
    if (!analyticsAllowed()) return;
    lastSent.current = pathname;

    const url = `${apiUrl}/v1/public/site/collect?tenant=${encodeURIComponent(tenantSlug)}`;
    postBeacon(
      url,
      JSON.stringify({
        path: pathname,
        referrer: document.referrer || undefined,
        ...(propertySlug ? { property: propertySlug } : {}),
      })
    );
  }, [apiUrl, tenantSlug, propertySlug, pathname]);

  // Web vitals — captured once for the initial page load, reported on first hide.
  useEffect(() => {
    if (!apiUrl || !tenantSlug) return;
    if (!analyticsAllowed()) return;
    const initialPath = window.location.pathname;
    return observeWebVitals((vitals) => {
      if (Object.keys(vitals).length === 0) return;
      const url = `${apiUrl}/v1/public/site/collect?tenant=${encodeURIComponent(tenantSlug)}`;
      postBeacon(
        url,
        JSON.stringify({
          type: 'vital',
          path: initialPath,
          metrics: vitals,
          ...(propertySlug ? { property: propertySlug } : {}),
        })
      );
    });
    // Initial-load vitals only — deliberately keyed on the config props, not
    // pathname, so it sets up once per mount.
  }, [apiUrl, tenantSlug, propertySlug]);

  return null;
}
