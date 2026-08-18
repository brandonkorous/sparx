'use client';

import { usePathname } from 'next/navigation';
import { TopProgress } from '@wizeworks/ui';

// Storefront page-top loading bar. `tone="brand"` aims the bar's sweep at the
// TENANT's `--color-primary` — the merchant's own color, never sparx's module
// spectrum. Feeding `usePathname()` lets the bar complete when a route commits.
export function TopProgressBar() {
  return <TopProgress route={usePathname()} tone="brand" />;
}
