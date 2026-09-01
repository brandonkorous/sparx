'use client';

// The first thing a keyboard reaches, and the only way past the rail.
//
// WHY IT EXISTS. Reaching the pane you just opened cost 62 Tab presses without
// it — measured driving Devi's keyboard-only run (issue 319). Nothing was
// broken; every control was reachable and every focus ring visible. It was just
// so far that keyboard operation stopped being a way anybody would work.
//
// WHAT IT SKIPS. The rail (about fifteen stops) AND the pane tab strip, which
// costs three stops per open pane — on Devi's 29 open tabs that was ~100 more
// before pane content, so the label promised the thing she was working on and
// delivered the strip above it (issue 336).
//
// It lands on the ACTIVE pane's body, and asks DOCKVIEW which that is:
// `.dv-active-group` is dockview's own marker for the focused group, maintained
// by the dock as the active panel changes. That is the distinction this header
// used to say made the jump impossible — the rejected version was a
// `querySelector` taking the FIRST pane in the DOM, which is wrong whenever that
// is not the one in front. Reading the dock's own state is not that.
//
// Falls back to `<main>` when nothing is open, which is the whole workspace and
// the right place to be when there is no pane to be in.

import { Button } from '@wizeworks/silicaui-react';

/** The dock that holds every open pane — what the control focuses, and what
 *  `DesktopShell` puts on its `<main>`. */
export const WORKSPACE_ID = 'workspace';

/** Dockview's own marker for the focused group, and the body inside it. */
const ACTIVE_PANE_BODY = '.dv-active-group .dv-content-container';

/** Move focus to the pane in front, else to the workspace itself. Exported so a
 *  test can drive it without a dock. */
export function focusActivePane(): void {
  const body = document.querySelector<HTMLElement>(ACTIVE_PANE_BODY);
  const target = body ?? document.getElementById(WORKSPACE_ID);
  if (!target) return;
  // A pane body is a plain container, so it takes focus only if told it may.
  // -1 keeps it out of the Tab order, where it would be one more stop.
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus();
}

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
        focusActivePane();
      }}
    >
      Skip to what you are working on
    </Button>
  );
}
