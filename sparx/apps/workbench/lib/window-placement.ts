'use client';

import type { DockviewApi, DockviewGroupPanel } from 'dockview';

// How big a floating window is, and where it lands.
//
// A FRACTION of the workspace, never fixed pixels: the 720×520 this started as
// looked deliberate on the laptop it was chosen on and marooned on a 2286px one.
// The floors matter as much as the ratios — below roughly 520×380 a pane holding
// a toolbar, a filter row and a table is a peephole, so on a small canvas a
// window is allowed to take nearly all of it rather than shrink into uselessness.
//
// ── THE WORKSPACE IS WHAT YOU CAN SEE, NOT WHAT EXISTS ──────────────────────
//
// Every measurement here is against the VIEWPORT — the visible frame — and never
// against the canvas, which is larger whenever a window has been pushed off to
// one side (lib/dock/use-window-canvas.ts). Sizing against the canvas would make
// a new window a fraction of a workspace nobody is looking at, and place it at a
// cascade origin that has scrolled off the screen: a pane that opened correctly
// and appeared nowhere.
//
// So a window is sized from the visible frame and positioned in canvas
// coordinates by adding the scroll back on — dockview positions floating groups
// against the canvas, so that is the coordinate space it has to be handed.

export interface FloatViewport {
  /** The visible frame, in pixels. */
  width: number;
  height: number;
  /** Where that frame currently sits on the canvas. */
  scrollLeft: number;
  scrollTop: number;
  /** The workspace zoom, so a window opened at 70% joins the ones already at
   *  70% rather than towering over them. See lib/window-zoom.ts. */
  zoom: number;
}

const WIDTH_RATIO = 0.62;
const HEIGHT_RATIO = 0.72;
const MIN_WIDTH = 520;
const MIN_HEIGHT = 380;

/** Cascade offsets, so a screenful of windows doesn't land in one pile. */
const CASCADE_STEP = 32;
const CASCADE_ORIGIN = 24;
/** Restart the cascade after this many, so the seventh isn't off-screen. */
const CASCADE_WRAP = 6;

/** Half the 44px title bar — a window dropped at a point wears it under the
 *  cursor, so the thing you just let go of is the thing you can drag again. */
const GRAB_OFFSET = 22;

/** How close an edge has to land before it is treated as meant. Small enough
 *  that a deliberate near-miss survives, large enough to catch a real aim. */
const SNAP = 8;

/** The gutter an even split leaves, matching the dock theme's `gap`. */
const TILE_GAP = 10;
/** A tile never shrinks below this, however many windows are open. Past it a
 *  pane shows nothing at all, and eight of nothing is not an arrangement. */
const MIN_TILE = 220;

export interface FloatBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A position on the CANVAS, not the page and not the visible frame. */
export interface FloatPoint {
  x: number;
  y: number;
}

function frame(view: FloatViewport): { width: number; height: number } {
  return { width: Math.max(view.width, MIN_WIDTH), height: Math.max(view.height, MIN_HEIGHT) };
}

function windowSize(view: FloatViewport): { width: number; height: number } {
  const area = frame(view);
  // The floors are 100% figures, so the zoom goes on afterwards: at 70% a window
  // is 70% of the pixels and renders exactly as much content as it would at 100%.
  return {
    width: Math.round(
      view.zoom * Math.min(area.width, Math.max(MIN_WIDTH, area.width * WIDTH_RATIO))
    ),
    height: Math.round(
      view.zoom * Math.min(area.height, Math.max(MIN_HEIGHT, area.height * HEIGHT_RATIO))
    ),
  };
}

/** Kept fully inside the VISIBLE frame — a window that opened onto a part of the
 *  canvas nobody is looking at has, as far as anybody can tell, not opened. */
function clamp(value: number, limit: number): number {
  return Math.max(0, Math.min(value, limit));
}

/** The whole VISIBLE frame, in canvas coordinates: "fill the workspace" for one
 *  window. Not zoomed: a filled window is as big as what you can see, whatever the
 *  zoom, which is the point of filling it. */
export function fillBox(view: FloatViewport): FloatBox {
  return { x: view.scrollLeft, y: view.scrollTop, width: view.width, height: view.height };
}

/** How far a measured box may sit from the one it was given and still be it:
 *  dockview's frame border and the rounding in `boxOf`. */
const FILL_SLACK = 4;

/** A window that covers everything you can see. As far as the screen can tell,
 *  that is a filled window. Not "starts at the visible corner": a window too big
 *  for the screen gives the workspace scroll bars, the scroll is saved, and the
 *  reload Doty made came back 17px down a workspace his chat had overflowed. */
export function coversView(box: FloatBox, view: FloatViewport): boolean {
  return (
    box.x <= view.scrollLeft + FILL_SLACK &&
    box.y <= view.scrollTop + FILL_SLACK &&
    box.x + box.width >= view.scrollLeft + view.width - FILL_SLACK &&
    box.y + box.height >= view.scrollTop + view.height - FILL_SLACK
  );
}

/**
 * The windows to fill the screen again, now that the screen is a different size.
 *
 * A filled window was sized to the screen ONCE, at the moment it was filled. A
 * banner that appeared above the workspace, a smaller browser window, or a reload
 * on another screen left it at the old size, and Doty's chat ran off the bottom
 * with its Send button out of sight (sparx persona issue 167). So: every window
 * filled this session, and any window that covers the whole screen from its corner
 * (which is what a filled window restored from a saved layout looks like, since
 * which ones were filled is not saved). One already filling it exactly is left
 * alone, so this is safe to run on every resize.
 */
export function windowsToRefill(
  windows: readonly { id: string; box: FloatBox }[],
  filled: ReadonlySet<string>,
  view: FloatViewport
): { ids: string[]; box: FloatBox } {
  const target = fillBox(view);
  if (view.width <= 0 || view.height <= 0) return { ids: [], box: target };
  const filling = windows.filter((window) => filled.has(window.id) || coversView(window.box, view));
  const others = windows.filter((window) => !filling.includes(window)).map((w) => w.box);
  const box = fillBox(refillView(others, view));
  return {
    ids: filling.filter((window) => !nearBox(window.box, box)).map((window) => window.id),
    box,
  };
}

/**
 * The screen to fill, given the windows that are NOT being filled.
 *
 * Filled where the workspace was scrolled to, Doty's chat kept the scroll bars
 * its own overflow had caused, and scrolling up moved it 17px down the screen. So
 * when every other window sits inside the unscrolled screen, the scroll was only
 * ever the filled window's, and it fills the screen from the top. When something
 * else is out on the desk, the scroll is somebody's arrangement and is kept.
 */
export function refillView(others: readonly FloatBox[], view: FloatViewport): FloatViewport {
  const inside = others.every(
    (box) => box.x + box.width <= view.width && box.y + box.height <= view.height
  );
  return inside ? { ...view, scrollLeft: 0, scrollTop: 0 } : view;
}

function nearBox(a: FloatBox, b: FloatBox): boolean {
  return (
    Math.abs(a.x - b.x) <= FILL_SLACK &&
    Math.abs(a.y - b.y) <= FILL_SLACK &&
    Math.abs(a.width - b.width) <= FILL_SLACK &&
    Math.abs(a.height - b.height) <= FILL_SLACK
  );
}

/** Where the `index`-th window of a cascade goes, in canvas coordinates. */
export function cascadeBox(view: FloatViewport, index: number): FloatBox {
  const area = frame(view);
  const size = windowSize(view);
  const offset = CASCADE_ORIGIN + (index % CASCADE_WRAP) * CASCADE_STEP;
  return {
    x: view.scrollLeft + clamp(offset, area.width - size.width),
    y: view.scrollTop + clamp(offset, area.height - size.height),
    ...size,
  };
}

/** Where a window goes when somebody dropped a tab to make it. */
export function boxAtPoint(view: FloatViewport, point: FloatPoint): FloatBox {
  const area = frame(view);
  const size = windowSize(view);
  // The point arrives in canvas coordinates; the clamp is about what is on
  // screen, so it happens in frame coordinates and the scroll goes back on after.
  const x = point.x - view.scrollLeft;
  const y = point.y - view.scrollTop;
  return {
    x: view.scrollLeft + clamp(Math.round(x - size.width / 2), area.width - size.width),
    y: view.scrollTop + clamp(Math.round(y - GRAB_OFFSET), area.height - size.height),
    ...size,
  };
}

/** One tile of an even split of the visible frame — the `index`-th of `count`. */
export function tileBox(view: FloatViewport, index: number, count: number): FloatBox {
  const area = frame(view);
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const width = Math.max(MIN_TILE, Math.floor((area.width - TILE_GAP * (columns + 1)) / columns));
  const height = Math.max(MIN_TILE, Math.floor((area.height - TILE_GAP * (rows + 1)) / rows));
  return {
    x: view.scrollLeft + TILE_GAP + (index % columns) * (width + TILE_GAP),
    y: view.scrollTop + TILE_GAP + Math.floor(index / columns) * (height + TILE_GAP),
    width,
    height,
  };
}

/**
 * The smallest move that puts a window back on screen.
 *
 * Deliberately minimal: somebody asking for their windows back has an
 * arrangement they like and one stray they cannot see, and rearranging the lot
 * to fetch it would cost them more than the stray did. A window too big for the
 * screen is also shrunk, since there is no position that would show all of it.
 */
export function gatherBox(view: FloatViewport, box: FloatBox): FloatBox {
  const area = frame(view);
  const width = Math.min(box.width, Math.max(MIN_TILE, area.width - TILE_GAP * 2));
  const height = Math.min(box.height, Math.max(MIN_TILE, area.height - TILE_GAP * 2));
  return {
    x: view.scrollLeft + clamp(Math.round(box.x - view.scrollLeft), area.width - width),
    y: view.scrollTop + clamp(Math.round(box.y - view.scrollTop), area.height - height),
    width,
    height,
  };
}

/** The windows on the canvas, in the order dockview holds them. */
export function floatingGroups(api: DockviewApi): DockviewGroupPanel[] {
  return api.groups.filter((group) => group.api.location.type === 'floating');
}

/** A window's box in CANVAS pixels, which is the space dockview places them in. */
export function boxOf(group: DockviewGroupPanel, canvas: HTMLElement): FloatBox {
  const base = canvas.getBoundingClientRect();
  const box = group.element.getBoundingClientRect();
  return {
    x: Math.round(box.left - base.left),
    y: Math.round(box.top - base.top),
    width: Math.round(box.width),
    height: Math.round(box.height),
  };
}

/** The same window, `factor` times the size — position included, so a workspace
 *  scaled down keeps its shape rather than collapsing into the corner. */
export function scaleBox(box: FloatBox, factor: number): FloatBox {
  return {
    x: Math.round(box.x * factor),
    y: Math.round(box.y * factor),
    width: Math.round(box.width * factor),
    height: Math.round(box.height * factor),
  };
}

export function sameBox(a: FloatBox, b: FloatBox): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/** The smallest nudge that puts one of `start`/`end` on a line, or none at all. */
function bestOffset(start: number, end: number, lines: number[]): number {
  let best = 0;
  let closest = SNAP + 1;
  for (const line of lines) {
    for (const delta of [line - start, line - end]) {
      const distance = Math.abs(delta);
      if (distance <= SNAP && distance < closest) {
        closest = distance;
        best = delta;
      }
    }
  }
  return Math.round(best);
}

/**
 * Line a window up with its neighbours or the edges of the screen.
 *
 * Position only, and only after a MOVE: a person dragging a window to sit beside
 * another one is aiming at an edge, and landing three pixels off is a miss they
 * then have to correct by hand. Nothing moves further than SNAP, so a window
 * genuinely meant to sit askew stays askew.
 */
export function snapBox(box: FloatBox, others: FloatBox[], view: FloatViewport): FloatBox {
  const edgesX = [view.scrollLeft, view.scrollLeft + view.width];
  const edgesY = [view.scrollTop, view.scrollTop + view.height];
  const linesX = [...edgesX, ...others.flatMap((other) => [other.x, other.x + other.width])];
  const linesY = [...edgesY, ...others.flatMap((other) => [other.y, other.y + other.height])];
  return {
    ...box,
    x: box.x + bestOffset(box.x, box.x + box.width, linesX),
    y: box.y + bestOffset(box.y, box.y + box.height, linesY),
  };
}
