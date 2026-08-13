// Availability semantics — the ONE place the "untracked = always available" rule
// lives, so every consumer (storefront PDP, B2B, the dashboard buy-box) derives
// in-stock the same way (docs/100 §2.4, P1e).
//
// The inventory module is the source of truth for whether a variant is even
// stock-MANAGED. When it's OFF for a tenant, commerce/B2B treat every variant as
// UNTRACKED: availability is unbounded and the variant is always in stock — the
// reserve/commit/decrement seam degrades to a no-op. Stock tracking switches on
// only with the module (which, per §7, rides free with Commerce/B2B). When it's
// ON, availability is the real ledger rollup — Σ max(0, onHand − allocated −
// buffer − unsellable) across every warehouse — and `inventoryPolicy` governs
// whether a zero-available variant still sells (`continue`/`preorder`) or hides
// (`deny`).
//
// Ownership is deliberately NOT a term in that sum (docs/146 Phase 9.5).
// Consigned stock is somebody else's asset and entirely sellable — being able to
// sell it is the whole reason to hold it — so it counts here and is excluded
// from valuation instead. The asymmetry is the feature.

export interface AvailabilityLevel {
  onHand: number;
  allocated: number;
  /** Units withheld from sale at this level (docs/28 §5.3 oversell guard). 0 when absent. */
  safetyBuffer?: number;
  /** Units physically here but on a shelf nothing may be sold from — quarantine,
   *  damaged, awaiting repair (docs/146 Phase 9.7). 0 when absent, and 0 for
   *  every location that does not use shelves, which is correct: with no shelves
   *  there is nowhere unsellable to be.
   *
   *  Netting this out is what makes a disposition MEAN something. Without it,
   *  routing a returned item to quarantine moves it on a screen and leaves it on
   *  sale — the on-hand total counts the whole location and availability
   *  subtracts only what is allocated. */
  unsellableOnHand?: number;
}

export interface VariantAvailability {
  /** Units sellable right now, or `null` when untracked (unbounded supply). */
  available: number | null;
  /** Whether the buy-box should offer the variant. */
  inStock: boolean;
  /** False when the inventory module is off → the variant isn't stock-managed,
   *  so a storefront should not render a finite "N left" count. */
  tracked: boolean;
}

/** Derive a variant's availability from its per-warehouse levels + policy. Pass
 *  `inventoryActive: false` to degrade to the untracked (always-available) path. */
export function computeAvailability(
  levels: readonly AvailabilityLevel[],
  inventoryPolicy: string,
  opts: { inventoryActive: boolean }
): VariantAvailability {
  if (!opts.inventoryActive) {
    return { available: null, inStock: true, tracked: false };
  }
  const available = levels.reduce(
    (sum, l) =>
      sum + Math.max(0, l.onHand - l.allocated - (l.safetyBuffer ?? 0) - (l.unsellableOnHand ?? 0)),
    0
  );
  return {
    available,
    inStock: available > 0 || inventoryPolicy !== 'deny',
    tracked: true,
  };
}
