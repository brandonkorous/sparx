'use client';

// A BLOCK inside a pane is waiting — not the pane itself.
//
// ── WHY THIS IS NOT `<PaneWaiting>` ─────────────────────────────────────────
//
// `<PaneWaiting>` fills the content region and puts the brand's mascot in the
// middle of it. That is right when the whole pane has nothing to show yet, and
// wrong for the far more common case this component covers: the pane is already
// on screen, its toolbar works, its other sections are rendered, and ONE panel
// inside it is still fetching. A 72px mascot inside a form section is a loading
// state shouting over the thing it is a detail of.
//
// ── WHY IT IS A COMPONENT AT ALL ────────────────────────────────────────────
//
// Because surface after surface had each written its own:
//
//     <p className="text-sm" role="status">Loading…</p>
//
// which is not a state, it is the absence of one — the same sentence in the same
// small type, invented independently in dozens of places, with no way to change
// any of it. It is the sub-block version of the bug the three content states
// fixed one level up.
//
// So: one shape, one word, one place to change it.

import { Loading } from '@wizeworks/silicaui-react';

export function InlineWaiting({
  label = 'Loading…',
  /** Set when the block is tall enough that a bare line looks lost in it — a
   *  panel, a tab body — so the waiting line sits in the middle rather than
   *  clinging to the top-left corner. */
  center = false,
}: {
  label?: string;
  center?: boolean;
}) {
  return (
    <div
      role="status"
      className={
        center
          ? 'flex min-h-32 items-center justify-center gap-2.5 p-4'
          : 'flex items-center gap-2.5 py-2'
      }
    >
      {/* The module's own hue, so a waiting block inside a Commerce panel is the
          same orange as everything else in it — one more place the color does the
          wayfinding instead of a label. silica's Loading inherits `currentColor`,
          so the hue arrives as a text utility rather than a color prop. */}
      <Loading size="sm" className="text-module" />
      {/* A real ink token, never faded: a caption somebody is meant to read while
          they wait is still text somebody is meant to read (DESIGN.md RULE #3). */}
      <span className="text-sm">{label}</span>
    </div>
  );
}
