// The seam between "which surface is open" and "how panes are arranged".
//
// The controller owns MEANING — descriptors, dirty guards, dedupe, titles. A
// PaneHost owns PRESENTATION — where a pane goes and how you get between them.
// Everything the controller ever asked of dockview is the handful of methods
// below, which is what makes a second presentation viable at all: the dock is
// one implementation, the mobile stack is another, and no surface can tell the
// difference because surfaces never reach past ctx.open()/close()/guard().
//
// This exists because a dock is a DESKTOP idiom. Split, drag-to-arrange and
// tear-off are meaningless on a phone — not cramped, meaningless — so the
// mobile answer was never a smaller dock. It is one surface at a time with a
// switcher, which is a different host, not different CSS.

import type { OpenTarget } from '../surfaces/registry';
import type { PaneDescriptor } from '../surfaces/descriptor';

export interface AddPaneOptions {
  target: OpenTarget;
  /** The pane that asked, when the target is relative to it. */
  fromPaneId?: string;
  /** False loads the pane in the background. */
  focus: boolean;
}

/**
 * One OS window holding torn-off panes.
 *
 * The host hands back CLOSURES rather than a window handle, so "focus it" and
 * "bring it home" stay the host's business and chrome never learns what a
 * dockview group is. `paneIds` (not titles) because the controller already owns
 * meaning — the caller resolves them through getDescriptor().
 */
export interface DetachedWindow {
  /** Stable for the window's life; usable as a React key. */
  id: string;
  /** The panes riding in it, in tab order. */
  paneIds: string[];
  /** Bring the OS window forward. */
  focus: () => void;
  /** Pull its panes back into the main arrangement. */
  redock: () => void;
}

/**
 * What a host must be able to do. Deliberately small — every method here is one
 * the controller genuinely calls, and nothing about grids, tabs or windows
 * leaks through.
 */
export interface PaneHost {
  /**
   * Is there a LIVE pane with this id?
   *
   * Load-bearing for dedupe: the controller outlives a host across remounts, so
   * a descriptor can name a pane that only existed on a previous instance.
   * Deduping against one of those ghosts silently opens nothing.
   */
  has: (paneId: string) => boolean;
  add: (descriptor: PaneDescriptor, title: string, options: AddPaneOptions) => void;
  close: (paneId: string) => void;
  focus: (paneId: string) => void;
  setTitle: (paneId: string, title: string) => void;
  /** Re-point an existing pane at a new descriptor, keeping its place. */
  retarget: (paneId: string, title: string) => void;
  /** Serialized arrangement for persistence, or null for a host with no
   *  arrangement of its own to save (the stack — see persistence.savePanes). */
  serialize: () => unknown;
  /** Tear a pane into its own OS window. Absent on hosts without windows. */
  popout?: (paneId: string) => void;
  /**
   * The windows torn off so far. Absent on hosts without windows.
   *
   * Read on demand rather than pushed, because the source of truth is the
   * arrangement itself — a cached list would drift the moment someone closes a
   * popout from the OS title bar rather than from our chrome.
   */
  detachedWindows?: () => DetachedWindow[];
  /**
   * What this host can actually do, so chrome can OMIT what is impossible
   * rather than render it disabled. A greyed-out "split" on a phone is a
   * promise the device cannot keep.
   */
  readonly capabilities: PaneHostCapabilities;
}

export interface PaneHostCapabilities {
  /** Panes can sit side by side — `beside` means something. */
  readonly split: boolean;
  /** Panes can be torn into their own window. */
  readonly popout: boolean;
}
