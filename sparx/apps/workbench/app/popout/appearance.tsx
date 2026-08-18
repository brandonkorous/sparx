'use client';

// Keeps a detached window wearing the same appearance as the one it was torn
// off from.
//
// It renders nothing. All of the behaviour is in `useWorkbenchTheme`, which
// every workbench window mounts exactly once: it seeds from the stored choice,
// listens on the bus for somebody changing it elsewhere, follows the machine
// while the choice is `system`, and writes the resolved theme to its own
// document.
//
// Only the READ half is used here — a popout has no appearance control of its
// own, because appearance is one setting for the whole workbench rather than a
// property of a window, and offering it per window would invite two windows to
// disagree about a thing that is stored once.

import { useWorkbenchTheme } from '../../lib/use-theme';

export function PopoutAppearance() {
  useWorkbenchTheme();
  return null;
}
