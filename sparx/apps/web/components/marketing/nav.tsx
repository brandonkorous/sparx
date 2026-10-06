'use client';

import { SiteHeader } from './site-header';
import { APP_BASE } from './cta';

// The marketing site's header. Nav links stay relative — this IS the marketing
// site — while the auth CTAs cross to the workbench origin, which cta.ts owns.

export function Nav() {
  return <SiteHeader signInHref={`${APP_BASE}/sign-in`} signUpHref={`${APP_BASE}/sign-up`} />;
}
