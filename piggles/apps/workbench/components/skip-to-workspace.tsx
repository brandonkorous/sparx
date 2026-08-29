'use client';

// The first thing a keyboard reaches, and the only way past the rail.
//
// WHY IT EXISTS. Reaching the pane you just opened cost 62 Tab presses without
// it — measured driving Devi's keyboard-only run (issue 319). Nothing was
// broken; every control was reachable and every focus ring visible. It was just
// so far that keyboard operation stopped being a way anybody would work.
//
// WHAT IT SKIPS, precisely, because it is not everything. It jumps the RAIL —
// about fifteen stops. It does NOT jump the pane tab strip, which lives inside
// the same `<main>` and costs three stops per open pane (name, pin, close), so
// Tab still walks those before reaching pane content. Landing past them means
// targeting the ACTIVE pane's body, and which body is active is dockview's to
// say rather than this shell's — a dock change, left deliberately undone rather
// than faked with a `querySelector` that would take the first pane in the DOM
// and be wrong whenever that is not the one in front.

import { Button } from '@wizeworks/silicaui-react';

/** The dock that holds every open pane — what the control focuses, and what
 *  `DesktopShell` puts on its `<main>`. */
export const WORKSPACE_ID = 'workspace';

export function SkipToWorkspace() {
  return (
    <Button
      color="primary"
      size="sm"
      // Parked off-screen and brought back by ONE property. `sr-only` was the
      // obvious choice and the wrong one: it collapses the box to 1px, and
      // `not-sr-only` restores `position: static` and `padding: 0`, which then
      // argue with `.btn`'s own padding and with the fixed positioning — the
      // control came back clipped through its own text. A single `top` leaves
      // the button's box entirely alone.
      className="fixed -top-20 left-2 z-50 focus:top-2"
      onClick={() => {
        // A button rather than an `#anchor`: panes mount and unmount under a
        // dock, so moving focus is a thing to DO, not a place to link to.
        document.getElementById(WORKSPACE_ID)?.focus();
      }}
    >
      Skip to what you are working on
    </Button>
  );
}
