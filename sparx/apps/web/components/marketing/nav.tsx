'use client';

import { SiteHeader } from './site-header';

// The marketing site's header. Nav links stay relative — this IS the marketing
// site — while the auth CTAs cross to the dashboard app origin. APP_BASE
// mirrors lib/marketplace.ts's hand-off origin.
const APP_BASE = 'https://app.sparx.works';

export function Nav() {
  return <SiteHeader signInHref={`${APP_BASE}/sign-in`} signUpHref={`${APP_BASE}/sign-up`} />;
}
