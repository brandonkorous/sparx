// The `+` actions, as things the search box can find.
//
// The box is titled "What do you want to do?", and it only knew where things
// ARE. Every `+` in the navigation panel names something to DO - "Receive a
// delivery", "Connect somewhere else", "Add a special price" - in this brand's
// own words, and typing any one of them word for word found nothing but
// automations that happened to share a word with it (issue 904). The panel and
// the box are two doors to one console; a name that works on one has to work
// on the other.
//
// Pure, so the rules are pinned by a test rather than by a hook:
//
//   - Only a `+` with a real label. The panel falls back to "New" for one
//     without, and "New" is not a phrase anyone types to mean one thing.
//   - Opened exactly the way the panel opens it: `id: 'new'` first, then the
//     row's own params, so a create surface that serves two doors (the till)
//     still knows which door this was.
//   - One row per distinct action. Two screens may share a `+`; the box shows
//     it once.
//   - No row for a `+` that a screen already IS. The till is a listed screen
//     called "Take a sale", and the `+` on Orders opens that same till under
//     that same name, so the box showed "Take a sale" twice (issue 914).

import type { SurfaceParams } from '../lib/surfaces/descriptor';

/** The part of a surface definition this reads. */
export interface CreatableSurface {
  key: string;
  module: string;
  createSurface?: string;
  createParams?: SurfaceParams;
}

export interface CreateAction<S extends CreatableSurface = CreatableSurface> {
  /** Stable, distinct from any surface key: `create:<row key>`. */
  id: string;
  /** The row the `+` sits on, for its group, its icon and its app's hue. */
  surface: S;
  /** What the `+` says, in this brand's words. */
  label: string;
  /** What to open, and with what. */
  createSurface: string;
  params: SurfaceParams;
  /** The screen's own name, so "special prices" finds "Add a special price". */
  keywords: string[];
}

export function createActions<S extends CreatableSurface>(
  surfaces: readonly S[],
  labelFor: (surface: S) => string | undefined,
  titleFor: (surface: S) => string
): CreateAction<S>[] {
  const seen = new Set<string>();
  const screens = new Set(
    surfaces.map((surface) => `${titleFor(surface).trim()}\u0000${surface.key}`)
  );
  const out: CreateAction<S>[] = [];
  for (const surface of surfaces) {
    const createSurface = surface.createSurface;
    if (!createSurface) continue;
    const label = labelFor(surface)?.trim();
    if (!label) continue;
    if (screens.has(`${label}\u0000${createSurface}`)) continue;
    const params: SurfaceParams = { id: 'new', ...surface.createParams };
    const identity = `${label}\u0000${createSurface}\u0000${JSON.stringify(params)}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    out.push({
      id: `create:${surface.key}`,
      surface,
      label,
      createSurface,
      params,
      keywords: [titleFor(surface)],
    });
  }
  return out;
}
