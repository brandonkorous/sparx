'use client';

// The "registered, not built yet" surface.
//
// The nav is DERIVED from the catalog (see lib/surfaces/nav.ts), which means the
// only way to give the workbench its full navigation ahead of the screens is to
// register every surface for real and point the unbuilt ones here. That is a
// deliberate trade: the alternative — a hand-written nav listing routes that
// don't exist — is exactly the exist-but-unreachable drift the registry was
// built to make impossible, only inverted.
//
// It says plainly that the screen isn't ready rather than pretending to be an
// empty list. A "No products yet" on a screen that was never wired to products
// is a lie an owner would act on: they'd go looking for why their catalog
// vanished. Honest beats tidy.

import type { LucideIcon } from 'lucide-react';
import { EmptyState } from '@wizeworks/silicaui-react';
import type { SurfaceContext } from '../lib/surfaces/registry';

interface PlaceholderOptions {
  /** Matches the nav row's icon, so the pane reads as the thing that was clicked. */
  icon: LucideIcon;
  /** What this screen WILL be, in the owner's words — not the surface key. */
  title: string;
  /**
   * One sentence on what it is for. Written so someone who has never used sparx
   * learns what they're waiting for, rather than just that they can't have it.
   */
  body: string;
}

export function createPlaceholderSurface({ icon: Icon, title, body }: PlaceholderOptions) {
  function PlaceholderSurface(_props: { ctx: SurfaceContext }) {
    return (
      <div className="grid h-full place-items-center overflow-y-auto p-8">
        <EmptyState
          className="max-w-md"
          icon={<Icon className="text-module size-8" aria-hidden />}
          title={title}
          description={`${body} This screen is still being built — it will open here when it is ready.`}
        />
      </div>
    );
  }

  return PlaceholderSurface;
}
