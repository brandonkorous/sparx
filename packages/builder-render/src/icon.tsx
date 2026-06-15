'use client';

// The render path for an Icon node (docs/47). A thin client boundary around
// lucide's lazy `DynamicIcon`: the live renderer is a Server Component and the
// canvas is a client tree, but DynamicIcon resolves each glyph via React.lazy
// (code-split, loaded on demand), so it must render under a client component —
// same split as BuilderCarousel / the commerce atoms. The `st-icon` class on the
// wrapper owns color from the loaded @sparx/site-ui recipe; the SVG sits at 1em,
// so a sizeless icon inherits its context's font-size (matching a button's label)
// and an explicit `st-icon--sz-*` overrides it.

import { DynamicIcon, type IconName } from 'lucide-react/dynamic';

export function BuilderIcon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={className ?? 'st-icon'}>
      <DynamicIcon name={(name || 'star') as IconName} />
    </span>
  );
}
