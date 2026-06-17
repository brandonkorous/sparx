// Availability semantics — the ONE place the "untracked = always available" rule
// lives, so every consumer (storefront PDP, B2B, the dashboard buy-box) derives
// in-stock the same way (docs/100 §2.4, P1e).
//
// The inventory module is the source of truth for whether a variant is even
// stock-MANAGED. When it's OFF for a tenant, commerce/B2B treat every variant as
// UNTRACKED: availability is unbounded and the variant is always in stock — the
// reserve/commit/decrement seam degrades to a no-op. Stock tracking switches on
// only with the module (which, per §7, rides free with Commerce/B2B). When it's
// ON, availability is the real ledger rollup — Σ max(0, onHand − allocated) across
// every warehouse — and `inventoryPolicy` governs whether a zero-available variant
// still sells (`continue`/`preorder`) or hides (`deny`).

export interface AvailabilityLevel {
  onHand: number;
  allocated: number;
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
  const available = levels.reduce((sum, l) => sum + Math.max(0, l.onHand - l.allocated), 0);
  return {
    available,
    inStock: available > 0 || inventoryPolicy !== 'deny',
    tracked: true,
  };
}
