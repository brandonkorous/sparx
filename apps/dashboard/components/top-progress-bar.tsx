'use client';

import { usePathname } from 'next/navigation';
import { TopProgress } from '@sparx/ui';

// Page-top loading bar for the dashboard. Feeding `usePathname()` lets the bar
// complete when a route commits; the @sparx/ui component handles the rest —
// platform-spectrum on platform surfaces, the active module's color inside a
// module (Commerce orange, CMS teal, …), following navigation automatically.
export function TopProgressBar() {
  return <TopProgress route={usePathname()} />;
}
