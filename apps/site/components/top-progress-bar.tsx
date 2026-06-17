'use client';

import { usePathname } from 'next/navigation';
import { TopProgress } from '@sparx/site-ui';

// Storefront page-top loading bar. Wears the TENANT's brand (--st-primary) — the
// merchant's own color, not Sparx's. Feeding `usePathname()` lets the bar
// complete when a route commits.
export function TopProgressBar() {
  return <TopProgress route={usePathname()} />;
}
