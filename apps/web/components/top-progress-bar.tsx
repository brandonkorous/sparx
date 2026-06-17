'use client';

import { usePathname } from 'next/navigation';
import { TopProgress } from '@sparx/ui';

// Page-top loading bar for the marketing site. Sparx's own brand surface, so it
// shows the full module spectrum across the site; a module's landing route
// (e.g. /commerce) naturally wears that module's color, matching the brand guide.
export function TopProgressBar() {
  return <TopProgress route={usePathname()} />;
}
