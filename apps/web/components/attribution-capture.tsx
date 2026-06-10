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
import { gateTracker, getConsent } from '../lib/consent';

// First-party acquisition capture for the marketing site (docs/80 §5, L-PLAT).
// On each landing it computes a touch from the URL + referrer, applies set-once
// first-touch and last-non-direct last-touch, and writes `.sparx.works` cookies
// that app.sparx.works reads at signup.
//
// Consent-gated (docs/42): capture is registered under the `analytics` category
// via gateTracker — it runs immediately if the visitor has already granted
// analytics, otherwise the moment they accept in the consent banner. Nothing is
// written before a decision (GDPR opt-in). Marketing click-ids ride along only
// when the `marketing` category is also granted.

function readCookie(name: string): string | null {
  const match = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(document.cookie);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/** `.sparx.works` in prod so the cookie crosses to app.sparx.works; host-only on localhost/preview. */
function cookieDomain(): string | undefined {
  const host = window.location.hostname;
  return host === 'sparx.works' || host.endsWith('.sparx.works') ? '.sparx.works' : undefined;
}

function writeAttrCookie(name: string, value: string): void {
  document.cookie = attrCookieString(name, value, {
    domain: cookieDomain(),
    secure: window.location.protocol === 'https:',
  });
}

export function AttributionCapture(): null {
  useEffect(() => {
    // gateTracker returns an unsubscribe fn — returning it from the effect cleans
    // up the consent listener if the visitor never grants analytics this session.
    return gateTracker({
      category: 'analytics',
      load: () => {
        const consent = getConsent();
        const touch = captureTouch({
          url: window.location.href,
          referrer: document.referrer || null,
          userAgent: navigator.userAgent,
          capturedAt: new Date().toISOString(),
          allowMarketing: consent?.marketing ?? false,
        });

        const first = resolveFirstTouch(deserializeSnapshot(readCookie(ATTR_COOKIES.first)), touch);
        const last = resolveLastTouch(deserializeSnapshot(readCookie(ATTR_COOKIES.last)), touch);

        writeAttrCookie(ATTR_COOKIES.first, serializeSnapshot(first));
        writeAttrCookie(ATTR_COOKIES.last, serializeSnapshot(last));
      },
    });
  }, []);

  return null;
}
