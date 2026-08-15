'use client';

import type { DockviewApi, SerializedDockview } from 'dockview';
import type { WorkbenchController } from '@/lib/workbench/controller';
import type { PaneDescriptor } from '@/lib/surfaces/descriptor';
import { loadModeLayout, saveModeLayout } from './mode-layouts';

// Windows or tabs — how the console presents what you have open.
//
// ── WHY THIS IS A CHOICE AND NOT A DEFAULT ──────────────────────────────────
//
// The two are genuinely different ways to work and neither is wrong.
//
//   TABS tile every pane into a grid: nothing overlaps, nothing is hidden, and
//   the whole screen is always in use. It is the denser, tidier answer, and it
//   is what somebody comparing two lists side by side wants.
//
//   WINDOWS let panes float and overlap, moved and sized freely, stacked the way
//   paper is stacked on a desk. It is the friendlier answer, and it is what
//   somebody who thinks in "things I have out" wants — which, for the audience
//   Piggles is for, is most people.
//
// sparx never has to make this choice: its audience is a doer at a desk who
// wants everything visible at once, so tiling is simply correct there. This is
// Piggles chrome, and sparx is not offered it.
//
// ── WHY THE TOGGLE HAD TO EXIST AT ALL ──────────────────────────────────────
//
// dockview floats a group when a tab is dragged into empty space. A fully tiled
// grid HAS no empty space — so floating was enabled, documented, and completely
// unreachable. The capability was not missing; the door was. (The same shape of
// bug as `organization.setActive`, which was fully implemented server-side and
// had no client to call it.)

export type WindowMode = 'windows' | 'tabs';

const KEY = 'piggles-console-window-mode';

/** The stored choice, or null when nobody has chosen. */
export function readWindowMode(): WindowMode | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === 'windows' || raw === 'tabs' ? raw : null;
  } catch {
    return null;
  }
}

export function writeWindowMode(mode: WindowMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // Storage blocked. The mode still applies for this session.
  }
}

// ── HOW BIG A FLOATING WINDOW IS ────────────────────────────────────────────
//
// A FRACTION of the workspace, never a fixed pixel size. The fixed 720×520 this
// started as looked deliberate on the laptop it was chosen on and looked like a
// mistake everywhere else: on a 2286px-wide canvas it is a small box marooned in
// the corner of an enormous empty ground, which reads as something that failed
// to size itself rather than as a window somebody placed.
//
// The floors matter as much as the ratios. Below roughly 520×380 a pane stops
// being a workspace and becomes a peephole — the shared surfaces put a toolbar,
// a filter row and a table in there — so on a small canvas a window is allowed
// to take nearly all of it rather than shrink into uselessness.
const FLOAT_WIDTH_RATIO = 0.62;
const FLOAT_HEIGHT_RATIO = 0.72;
const FLOAT_MIN_WIDTH = 520;
const FLOAT_MIN_HEIGHT = 380;

/** Where a newly floated window is placed, so a screenful of them cascades
 *  rather than landing in one pile. */
const CASCADE_STEP = 32;
const CASCADE_ORIGIN = 24;
/** Restart the cascade after this many, so the fifth window is not off-screen. */
const CASCADE_WRAP = 6;

interface FloatBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where the `index`-th floated window goes, in the space actually available.
 *
 * Clamped on both axes, so the last window of a long cascade is still fully on
 * screen — a window whose title bar is below the fold cannot be moved, which
 * makes it unclosable by anything except the tab strip somebody has just been
 * taught not to use.
 */
function floatBox(api: DockviewApi, index: number): FloatBox {
  const canvasWidth = Math.max(api.width, FLOAT_MIN_WIDTH);
  const canvasHeight = Math.max(api.height, FLOAT_MIN_HEIGHT);

  const width = Math.min(canvasWidth, Math.max(FLOAT_MIN_WIDTH, canvasWidth * FLOAT_WIDTH_RATIO));
  const height = Math.min(
    canvasHeight,
    Math.max(FLOAT_MIN_HEIGHT, canvasHeight * FLOAT_HEIGHT_RATIO)
  );

  const offset = CASCADE_ORIGIN + (index % CASCADE_WRAP) * CASCADE_STEP;
  return {
    x: Math.max(0, Math.min(offset, canvasWidth - width)),
    y: Math.max(0, Math.min(offset, canvasHeight - height)),
    width: Math.round(width),
    height: Math.round(height),
  };
}

/**
 * Put every open group into the requested presentation.
 *
 * Reads `group.api.location.type` rather than tracking state of its own: dockview
 * is the authority on where a group actually is, and a group can move without
 * this module being told (a tab dragged out, a popout dismissed). Anything
 * already in the right place is left alone, so calling this repeatedly is safe.
 *
 * POPOUT groups are deliberately untouched. A popout is a real operating-system
 * window somebody deliberately tore off; dragging it back because a toggle was
 * flipped would be the console reaching into another window and closing it.
 */
export function applyWindowMode(api: DockviewApi, mode: WindowMode): void {
  // Snapshot first — floating a group mutates the collection being iterated.
  const groups = [...api.groups];

  if (mode === 'windows') {
    // Count the groups ALREADY floating, so a newcomer joining a screenful of
    // windows continues the cascade instead of landing under the first one.
    let index = groups.filter((group) => group.api.location.type === 'floating').length;
    for (const group of groups) {
      if (group.api.location.type !== 'grid') continue;
      api.addFloatingGroup(group, floatBox(api, index));
      index += 1;
    }
    return;
  }

  for (const group of groups) {
    if (group.api.location.type !== 'floating') continue;
    // No target group + a position docks it against the grid's edge — the same
    // call the tear-off control uses to bring a popout back, so a window
    // returning to the grid behaves identically however it left.
    group.api.moveTo({ position: 'right' });
  }
}

/**
 * Move between presentations, keeping each one's arrangement.
 *
 * ── WHAT MAKES THIS SAFE ────────────────────────────────────────────────────
 *
 * `fromJSON` with `reuseExistingPanels` MOVES the panels that appear in both
 * layouts instead of destroying and rebuilding them (dockview stashes them in a
 * temporary group, clears the layout, then re-adopts each one into its new
 * slot). That is the difference between a toggle and a data-loss bug: a pane
 * holding a half-typed invoice keeps its React tree, its scroll position and
 * its unsaved values, and comes out the other side in a different place on
 * screen and otherwise untouched.
 *
 * Without that flag this whole feature would be unshippable — restoring the
 * other arrangement would silently discard work, and a VIEW toggle must never
 * be able to do that.
 *
 * ── AND WHY IT STILL RECONCILES AFTERWARDS ──────────────────────────────────
 *
 * A snapshot is a photograph of an arrangement, taken when you last left that
 * presentation. The pane SET has moved on since: panes opened in tabs are
 * missing from the windows photograph, and panes closed in tabs are still IN
 * it. Replaying the photograph alone would quietly close the first group and
 * resurrect the second as panes with no descriptor behind them.
 *
 * So the live descriptors are the authority and the snapshot only supplies
 * ARRANGEMENT: anything in the photograph that is no longer open is dropped,
 * and anything open that the photograph never saw is added back.
 */
export function switchWindowMode(
  api: DockviewApi,
  controller: WorkbenchController,
  siteKey: string,
  from: WindowMode,
  to: WindowMode
): void {
  // Photograph the arrangement being left FIRST, and unconditionally — even if
  // everything below fails, the way it looked is not what gets lost.
  saveModeLayout(siteKey, from, api.toJSON());

  const snapshot = loadModeLayout(siteKey, to);
  if (!snapshot) {
    // Never been in this presentation on this site. Synthesise one.
    applyWindowMode(api, to);
    return;
  }

  // ── READ THE OPEN SET BEFORE TOUCHING THE LAYOUT ──────────────────────────
  //
  // This line looks like caution and is actually load-bearing. `fromJSON` calls
  // `clear()` internally, and clear() runs OUTSIDE dockview's moving-lock — so
  // every panel it destroys fires `onDidRemovePanel`, and this dock's listener
  // answers that by forgetting the pane's descriptor.
  //
  // The panels reused across the restore are exempt (dockview parks them in a
  // detached group under the lock, which suppresses the event). The ones that
  // are NOT exempt are precisely the panes the snapshot has never seen — the
  // ones opened while the other presentation was on screen, which are the whole
  // reason reconciliation exists. Reading the set afterwards would read it
  // already pruned, and those panes would vanish with nothing reporting it.
  const openBefore = controller.snapshotDescriptors();

  try {
    api.fromJSON(snapshot as SerializedDockview, { reuseExistingPanels: true });
  } catch (error) {
    // A snapshot written by an older build can fail to deserialize, and a dock
    // that threw mid-restore is in no state to be trusted. Synthesising from
    // whatever survived beats a workspace nobody can get out of.
    console.warn('[piggles] could not restore that arrangement; rebuilding it', error);
    applyWindowMode(api, to);
    return;
  }

  reconcile(api, controller, to, openBefore);
  controller.hostChanged();
}

/**
 * Make the restored arrangement agree with what is actually open.
 *
 * `openBefore` is the authority on what "open" means — see the note at the call
 * site for why it cannot be re-read here.
 */
function reconcile(
  api: DockviewApi,
  controller: WorkbenchController,
  mode: WindowMode,
  openBefore: Record<string, PaneDescriptor>
): void {
  // Panes the snapshot remembers that have since been closed, resurrected by the
  // restore. Straight to `panel.api.close()` rather than the controller's guard:
  // the pane is already gone as far as the person is concerned, it has no
  // descriptor and therefore no unsaved work, and asking "close this?" about
  // something they closed minutes ago is a question with no good answer.
  //
  // Synchronous, in the same tick as the restore, so React never paints them.
  for (const panel of [...api.panels]) {
    if (openBefore[panel.id]) continue;
    panel.api.close();
  }

  // Panes opened while the other presentation was on screen — absent from the
  // photograph, and re-opened rather than dropped. Closing something because it
  // was opened at an awkward moment is the one outcome nobody would forgive.
  for (const descriptor of Object.values(openBefore)) {
    if (api.getPanel(descriptor.id)) continue;
    controller.open(descriptor.surface, descriptor.params, { focus: false });
  }

  // Those re-openings land wherever `open` puts them, which is the grid — so
  // give the new arrivals the presentation too. Anything the snapshot already
  // placed is in the right place and is left alone, which is what
  // applyWindowMode does by reading each group's real location.
  applyWindowMode(api, mode);
}
