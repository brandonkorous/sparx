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

import type { PigglesIcon } from '@piggles/ui';
import { Icon } from '@piggles/ui';
import { Card } from '@wizeworks/silicaui-react';
import { PaneEmpty } from '../components/pane-empty';
import { PANE_SHELL } from '../components/pane-toolbar';
import { getSurface, type SurfaceContext } from '../lib/surfaces/registry';

interface PlaceholderOptions {
  /** Matches the nav row's icon, so the pane reads as the thing that was clicked. */
  icon: PigglesIcon;
  /** What this screen WILL be, in the owner's words — not the surface key. */
  title: string;
  /**
   * One sentence on what it is for. Written so someone who has never used sparx
   * learns what they're waiting for, rather than just that they can't have it.
   */
  body: string;
}

export function createPlaceholderSurface({ icon, title, body }: PlaceholderOptions) {
  function PlaceholderSurface({ ctx }: { ctx: SurfaceContext }) {
    // Every stub shares this component, so the module comes from the registry
    // entry the pane was opened as — `stub()` already declares it there.
    const module = getSurface(ctx.descriptor.surface)?.module;
    return (
      // The message is this pane's whole content, so it sits on a card like every
      // other pane's content does rather than floating on the recessed surface —
      // and it goes through <PaneEmpty>, which is what puts the brand's picture
      // here instead of a grey glyph chip.
      <div className={`${PANE_SHELL} grid place-items-center`}>
        <Card className="max-w-md p-8">
          <PaneEmpty
            module={module}
            icon={<Icon glyph={icon} className="size-8" aria-hidden />}
            title={title}
            description={`${body} This screen is still being built — it will open here when it is ready.`}
          />
        </Card>
      </div>
    );
  }

  return PlaceholderSurface;
}
