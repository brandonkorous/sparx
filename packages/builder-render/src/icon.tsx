'use client';

// The render path for an Icon node (docs/47). A thin client boundary around
// lucide's lazy `DynamicIcon`: the live renderer is a Server Component and the
// canvas is a client tree, but DynamicIcon resolves each glyph via React.lazy
// (code-split, loaded on demand), so it must render under a client component —
// same split as BuilderCarousel / the commerce atoms. The wrapper sets no colour
// of its own — the icon inherits the ink of whatever it sits in (a button label, a
// nav item), which is what makes it correct on every silica variant without a
// per-call-site override. It sizes at 1em for the same reason.

import { DynamicIcon, type IconName } from 'lucide-react/dynamic';

export function BuilderIcon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={className ?? 'inline-flex items-center [&>svg]:size-[1em]'}>
      <DynamicIcon name={(name || 'star') as IconName} />
    </span>
  );
}
