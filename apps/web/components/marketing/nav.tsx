'use client';

import { SiteHeader } from '@sparx/web-chrome';

// The marketing site's header is the shared <SiteHeader> from @sparx/web-chrome
// (the same header the dashboard auth pages render). Nav links stay relative —
// this IS the marketing site — while the auth CTAs cross to the dashboard app
// origin. APP_BASE mirrors lib/marketplace.ts's hand-off origin.
const APP_BASE = 'https://app.sparx.works';

export function Nav() {
  return <SiteHeader signInHref={`${APP_BASE}/sign-in`} signUpHref={`${APP_BASE}/sign-up`} />;
}
