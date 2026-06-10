'use client';

import { useEffect } from 'react';
import {
  ATTR_COOKIES,
  attrCookieString,
  captureTouch,
  deserializeSnapshot,
  resolveFirstTouch,
  resolveLastTouch,
  serializeSnapshot,
} from '@sparx/attribution';

// First-party acquisition capture for the marketing site (docs/80 §5, L-PLAT).
// On each landing it computes a touch from the URL + referrer, then applies
// set-once first-touch and last-non-direct last-touch into `.sparx.works` cookies
// that app.sparx.works reads at signup. Consent-gated via the seam below.

function readCookie(name: string): string | null {
  const match = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(document.cookie);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/** `.sparx.works` in prod so the cookie crosses to app.sparx.works; host-only on localhost/preview. */
function cookieDomain(): string | undefined {
  const host = window.location.hostname;
  return host === 'sparx.works' || host.endsWith('.sparx.works') ? '.sparx.works' : undefined;
}

/**
 * Consent seam (docs/80 §5.5). Reads the storefront `sparx_consent_state` cookie
 * when present. sparx.works has no banner yet, so the default mirrors the site's
 * existing posture: first-party analytics on, ad click-ids (marketing) off. Tighten
 * the analytics default here when a platform consent banner ships (docs/42).
 */
function attributionConsent(): { analytics: boolean; marketing: boolean } {
  const raw = readCookie('sparx_consent_state');
  if (!raw) return { analytics: true, marketing: false };
  try {
    const parsed = JSON.parse(raw) as { analytics?: boolean; marketing?: boolean };
    return { analytics: Boolean(parsed.analytics), marketing: Boolean(parsed.marketing) };
  } catch {
    return { analytics: true, marketing: false };
  }
}

function writeAttrCookie(name: string, value: string): void {
  document.cookie = attrCookieString(name, value, {
    domain: cookieDomain(),
    secure: window.location.protocol === 'https:',
  });
}

export function AttributionCapture(): null {
  useEffect(() => {
    const consent = attributionConsent();
    if (!consent.analytics) return;

    const touch = captureTouch({
      url: window.location.href,
      referrer: document.referrer || null,
      userAgent: navigator.userAgent,
      capturedAt: new Date().toISOString(),
      allowMarketing: consent.marketing,
    });

    const first = resolveFirstTouch(deserializeSnapshot(readCookie(ATTR_COOKIES.first)), touch);
    const last = resolveLastTouch(deserializeSnapshot(readCookie(ATTR_COOKIES.last)), touch);

    writeAttrCookie(ATTR_COOKIES.first, serializeSnapshot(first));
    writeAttrCookie(ATTR_COOKIES.last, serializeSnapshot(last));
  }, []);

  return null;
}
