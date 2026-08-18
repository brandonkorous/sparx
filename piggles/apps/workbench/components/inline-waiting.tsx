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
// Because thirty-four surfaces had each written their own:
//
//     <p className="text-sm" role="status">Loading…</p>
//
// which is not a state, it is the absence of one — the same sentence in the
// same small grey type, invented independently in thirty-four places, with no
// way to change any of it. It is the sub-block version of the bug the three
// content states already fixed one level up.
//
// So: one shape, one word, one place to change it. And the word goes through the
// product adapter, because "Loading…" is a technical word for the one moment
// every person in the product meets most often, and a brand should be able to
// say something warmer without touching thirty-four files.

import { Loading } from '@wizeworks/silicaui-react';
import { productCopy } from '../lib/product';
import { hasStateArt } from './state-art';

export function InlineWaiting({
  label,
  /** Set when the block is tall enough that a bare line looks lost in it — a
   *  panel, a tab body — so the waiting line sits in the middle rather than
   *  clinging to the top-left corner. */
  center = false,
}: {
  label?: string;
  center?: boolean;
}) {
  // ── WHY THE SPINNER IS CONDITIONAL ────────────────────────────────────────
  //
  // Collecting thirty-eight hand-written paragraphs into one component is a
  // structural fix and changes nothing about what anybody sees. Adding a spinner
  // to them is a DESIGN change, and it would land in sparx as much as in
  // Piggles — a product whose states were not part of this work.
  //
  // `StateArt` is the brand saying "I draw my own states" (see lib/product.ts).
  // A brand that has said it gets the fuller treatment; a brand that has not
  // renders exactly the line it rendered before this component existed. So the
  // single point of change arrives without redecorating somebody else's product
  // on the way past.
  const rich = hasStateArt();
  const text = label ?? productCopy('inline.waiting', 'Loading…');

  if (!rich) {
    return (
      <p className="text-sm" role="status">
        {text}
      </p>
    );
  }

  return (
    <div
      role="status"
      className={
        center
          ? 'flex min-h-32 items-center justify-center gap-2.5 p-4'
          : 'flex items-center gap-2.5 py-2'
      }
    >
      {/* The module's own hue, so a waiting block inside a Sell panel is the
          same burnt orange as everything else in it — one more place the color
          does the wayfinding instead of a label. silica's Loading inherits
          `currentColor`, so the hue arrives as a text utility rather than a
          color prop. */}
      <Loading size="sm" className="text-module" />
      {/* A real ink token, never faded: a caption somebody is meant to read
          while they wait is still text somebody is meant to read (DESIGN.md
          RULE #3). */}
      <span className="text-sm">{text}</span>
    </div>
  );
}
