'use client';

import type { DockviewApi } from 'dockview';

// How big a floating window is, and where it lands.
//
// A FRACTION of the workspace, never fixed pixels: the 720×520 this started as
// looked deliberate on the laptop it was chosen on and marooned on a 2286px one.
// The floors matter as much as the ratios — below roughly 520×380 a pane holding
// a toolbar, a filter row and a table is a peephole, so on a small canvas a
// window is allowed to take nearly all of it rather than shrink into uselessness.

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

export interface FloatBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A position inside the dock, not the page. */
export interface FloatPoint {
  x: number;
  y: number;
}

function canvas(api: DockviewApi): { width: number; height: number } {
  return { width: Math.max(api.width, MIN_WIDTH), height: Math.max(api.height, MIN_HEIGHT) };
}

function windowSize(api: DockviewApi): { width: number; height: number } {
  const area = canvas(api);
  return {
    width: Math.round(Math.min(area.width, Math.max(MIN_WIDTH, area.width * WIDTH_RATIO))),
    height: Math.round(Math.min(area.height, Math.max(MIN_HEIGHT, area.height * HEIGHT_RATIO))),
  };
}

/** Kept fully inside the workspace — a title bar below the fold cannot be
 *  moved, which makes its window unclosable by anything but the tab strip. */
function clamp(value: number, limit: number): number {
  return Math.max(0, Math.min(value, limit));
}

/** Where the `index`-th window of a cascade goes. */
export function cascadeBox(api: DockviewApi, index: number): FloatBox {
  const area = canvas(api);
  const size = windowSize(api);
  const offset = CASCADE_ORIGIN + (index % CASCADE_WRAP) * CASCADE_STEP;
  return {
    x: clamp(offset, area.width - size.width),
    y: clamp(offset, area.height - size.height),
    ...size,
  };
}

/** Where a window goes when somebody dropped a tab to make it. */
export function boxAtPoint(api: DockviewApi, point: FloatPoint): FloatBox {
  const area = canvas(api);
  const size = windowSize(api);
  return {
    x: clamp(Math.round(point.x - size.width / 2), area.width - size.width),
    y: clamp(Math.round(point.y - GRAB_OFFSET), area.height - size.height),
    ...size,
  };
}
