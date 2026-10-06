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
//
// ── NO LEVEL ROWS IS NOT A COUNT OF ZERO ────────────────────────────────────
//
// A variant with NO inventory_levels row anywhere has never been counted. That
// is the absence of a measurement, not a measurement of nothing, and the two
// must not render the same — so it takes the untracked path exactly as a
// module-off tenant does.
//
// This was not a subtle edge. Nothing in the product-creation path writes a
// level row: they appear only when somebody deliberately sets stock (levels.ts,
// stock-grid.ts) or from a seed. So EVERY product a business types in starts
// with zero rows, and `inventory_policy` defaults to `deny` — which summed to
// `available: 0, inStock: false`. A bakery entered ten products, saw all ten
// listed as On sale in her console, and her live shop told every visitor that
// every single one was **Sold out**. She had bread on the counter. Nothing on
// either screen connected the two, and there was no way to find the cause from
// where she was standing.
//
// It is worse on a brand that includes every app in one flat price, because
// then the inventory module is ON for everybody and this is not an edge case —
// it is what happens to every business on their first day.
//
// The rule that keeps this honest, and the ONE thing to preserve if this is
// ever revisited: a variant becomes stock-managed by being COUNTED, not by
// existing. Once one level row exists, zero means zero and `deny` means deny.

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
  /** False when the level sits at a location that cannot sell: one switched off
   *  or archived. Its stock still counts as a MEASUREMENT (the variant is
   *  tracked), and none of it is for sale. Absent means the location can sell.
   *
   *  This is the term the buy box and the allocator behind Add to cart have to
   *  agree on. The allocator (`pickWarehouseFor`) only ever routes to an active
   *  location, so a page that summed an archived location's shelf offered a
   *  button the cart then refused as sold out. Read through
   *  `AVAILABILITY_LEVEL_SELECT` + `availabilityLevelOf`, so every surface asks
   *  the database the same question. */
  locationSellable?: boolean;
}

/**
 * The columns `computeAvailability` needs off an `inventory_levels` row, its
 * location included. Spread into a Prisma `select` by every surface that decides
 * whether a variant can be bought, and turned into an `AvailabilityLevel` by
 * `availabilityLevelOf`, so none of them can leave a term out.
 */
export const AVAILABILITY_LEVEL_SELECT = {
  onHand: true,
  allocated: true,
  safetyBuffer: true,
  unsellableOnHand: true,
  warehouse: { select: { isActive: true, deletedAt: true } },
} as const;

/** A level row read with `AVAILABILITY_LEVEL_SELECT`, as `computeAvailability`
 *  takes it. */
export function availabilityLevelOf(row: {
  onHand: number;
  allocated: number;
  safetyBuffer: number;
  unsellableOnHand: number;
  warehouse: { isActive: boolean; deletedAt: Date | null } | null;
}): AvailabilityLevel {
  return {
    onHand: row.onHand,
    allocated: row.allocated,
    safetyBuffer: row.safetyBuffer,
    unsellableOnHand: row.unsellableOnHand,
    locationSellable: row.warehouse !== null && row.warehouse.isActive && !row.warehouse.deletedAt,
  };
}

/** What one level can sell right now: floored at zero, because an oversold
 *  location is not stock to subtract from another one, and zero at a location
 *  that cannot sell. The same arithmetic the allocator routes on
 *  (`sellableUnits`), plus the location term. */
export function levelSellable(l: AvailabilityLevel): number {
  if (l.locationSellable === false) return 0;
  return Math.max(0, l.onHand - l.allocated - (l.safetyBuffer ?? 0) - (l.unsellableOnHand ?? 0));
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
  // Never counted → untracked. Same answer as a module-off tenant, and for the
  // same reason: there is no number here to be a shortage of. See the header.
  if (levels.length === 0) {
    return { available: null, inStock: true, tracked: false };
  }
  const available = levels.reduce((sum, l) => sum + levelSellable(l), 0);
  return {
    available,
    inStock: available > 0 || inventoryPolicy !== 'deny',
    tracked: true,
  };
}
