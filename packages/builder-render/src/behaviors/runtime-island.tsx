'use client';

// The React boundary for the behavior runtime (docs/98 Pillar 5).
//
// Wraps a rendered builder tree and, after paint, hydrates every `data-sx-*`
// behavior under it — then tears them down on unmount / re-render. Mounted by BOTH
// surfaces:
//   · live storefront (apps/site): once around the page tree, edit=false → full
//     behavior (autoplay, scroll listeners, marquee cloning).
//   · editor canvas (apps/dashboard): edit=true → the non-hijacking preview mode
//     (interactive on click, but no autoplay/scroll effects that fight authoring).
//
// The wrapper is `display:contents`, so it adds no box and never disturbs layout —
// it exists only to give the runtime a stable root to scan. The effect re-runs on
// every render so a canvas edit re-initializes the behaviors over the new DOM.

import * as React from 'react';

import { hydrateBehaviors } from './index';

export function BuilderBehaviors({
  edit = false,
  children,
}: {
  edit?: boolean;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const root = ref.current;
    if (!root) return;
    return hydrateBehaviors(root, { edit });
  });
  return (
    <div ref={ref} style={{ display: 'contents' }}>
      {children}
    </div>
  );
}
