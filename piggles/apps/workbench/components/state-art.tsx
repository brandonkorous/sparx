'use client';

// The picture above an empty, failed or waiting pane.
//
// One helper, used by all four state components, so "does this brand draw its
// own states, and what happens to the glyph if it does" is answered once instead
// of four times slightly differently.
//
// ── THE RULE IT ENCODES ─────────────────────────────────────────────────────
//
// A brand that supplies `StateArt` REPLACES the glyph chip; it does not decorate
// it. silica's chip is a faded glyph on base-200, and a character sitting inside
// one reads as a thumbnail somebody forgot to remove — two illustrations
// competing over one sentence. So this returns the art OR the toned glyph, never
// both, and the caller passes `icon={undefined}` to silica when art won.
//
// The platform's own answer stays exactly as it was: a glyph, toned by state, so
// a failure and an empty filter cannot draw the same picture (DESIGN.md RULE #4).

import type { ReactNode } from 'react';
import { productStateArt, type ProductState } from '../lib/product';

/**
 * The brand's artwork for this state, or `null` when the brand draws none.
 *
 * Callers render it ABOVE silica's `<EmptyState>` and drop the `icon` prop when
 * it is non-null — see any of the four state components.
 */
export function StateArt({ state, module }: { state: ProductState; module?: string }): ReactNode {
  const Art = productStateArt();
  if (!Art) return null;
  return <Art state={state} module={module} />;
}

/**
 * The same thing for a caller that needs the node in a VALUE position — e.g. a
 * `??` chain choosing between the brand's art and a platform fallback.
 *
 * A separate export rather than letting callers write `StateArt({…})`: invoking
 * a component as a plain function gives React a different reconciliation
 * identity for the same subtree depending on which call site rendered it, and
 * the two forms then fight over the same tree. This one is a plain function that
 * happens to return an element, which is what such a caller actually wants.
 */
export function stateArtNode(state: ProductState, module?: string): ReactNode {
  const Art = productStateArt();
  if (!Art) return null;
  return <Art state={state} module={module} />;
}

/** Whether the brand is drawing this state, so a caller knows to suppress the
 *  glyph chip. Same question as `StateArt() !== null`, named so the call site
 *  reads as the decision it is making. */
export function hasStateArt(): boolean {
  return productStateArt() !== null;
}
