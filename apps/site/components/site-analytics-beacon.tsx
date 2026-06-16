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

export function SiteAnalyticsBeacon({
  apiUrl,
  tenantSlug,
  propertySlug,
}: SiteAnalyticsBeaconProps) {
  const pathname = usePathname();
  // Guard against double-fire under React strict-mode's dev double-invoke and
  // against re-sending the same path twice in a row.
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!apiUrl || !tenantSlug || !pathname) return;
    if (lastSent.current === pathname) return;
    if (!analyticsAllowed()) return;
    lastSent.current = pathname;

    const url = `${apiUrl}/v1/public/site/collect?tenant=${encodeURIComponent(tenantSlug)}`;
    const payload = JSON.stringify({
      path: pathname,
      referrer: document.referrer || undefined,
      ...(propertySlug ? { property: propertySlug } : {}),
    });

    try {
      const blob = new Blob([payload], { type: 'application/json' });
      if (typeof navigator !== 'undefined' && navigator.sendBeacon?.(url, blob)) return;
      void fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => undefined);
    } catch {
      // Analytics must never break a page render.
    }
  }, [apiUrl, tenantSlug, propertySlug, pathname]);

  return null;
}
