'use client';

// Records where a visitor came from, and makes sure it reaches the signup form.
// Mounted once in the layout. Renders nothing.
//
// ── WHY THE LINK IS DECORATED AT CLICK TIME ─────────────────────────────────
//
// Every "start free" on this site resolves through `accountUrl()`, which is a
// pure function on the server: it knows which page the link sits on and nothing
// about the browser. The attribution lives in a cookie only the browser can
// read, so something client-side has to add it — and the honest moment to do
// that is the click, not render, because a link rewritten on render would put a
// campaign payload into the HTML of a page that gets cached and shared.
//
// One listener on the document rather than a decorated <Link> component: the
// CTAs are server-rendered all over the site, and a wrapper would mean touching
// every one of them and remembering to touch the next one. This way a new button
// added tomorrow carries attribution without knowing attribution exists.

import { useEffect } from 'react';
import { PRODUCT } from '@piggles/config';
import { gateTracker } from '../lib/consent';
import { ATTR_PARAM, encodeForHandoff, recordTouch } from '../lib/attribution';

/** True for a link into the account app — the only place the payload may go. */
function isAccountLink(href: string): boolean {
  try {
    return new URL(href, window.location.href).host === PRODUCT.hosts.account;
  } catch {
    return false;
  }
}

export function AttributionCapture(): null {
  useEffect(() => {
    // Registered, not run. `gateTracker` calls this now if the visitor has
    // already accepted, on acceptance if they are about to, and never otherwise.
    return gateTracker({ category: 'analytics', load: recordTouch });
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest?.('a') ?? null;
      const href = anchor?.getAttribute('href');
      if (!anchor || !href || !isAccountLink(href)) return;

      const payload = encodeForHandoff();
      if (!payload) return;

      try {
        const url = new URL(href, window.location.href);
        // Never overwrite one already there — a link somebody was handed
        // directly is carrying somebody else's context on purpose.
        if (url.searchParams.has(ATTR_PARAM)) return;
        url.searchParams.set(ATTR_PARAM, payload);
        anchor.setAttribute('href', url.toString());
      } catch {
        // A URL that will not parse is left exactly as it was. The click still
        // works; it simply arrives without the campaign.
      }
    };

    // Capture phase, so the href is rewritten before the browser reads it —
    // and before any framework router handles the click.
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  return null;
}
