// Which shelf, and in what order (docs/146 Phase 4.2).
//
// ── The thing to understand before reading anything else ─────────────────────
//
// The shelf a unit comes off is chosen at CHECKOUT, not when a pick list is
// generated. That is not a design preference, it is arithmetic: `commitSaleOnTx`
// takes the units off `inventory_levels.on_hand` the moment the order is placed,
// and `mirrorMovementToBins` seats that decrement on real shelves in the same
// transaction. By the time anyone generates a walk, the books already say those
// units left shelf A-01 — even though they are physically still sitting on it.
//
// So a pick list that "allocated" shelves by looking at current bin levels would
// look at levels the sale has already drawn down and conclude the stock is
// nowhere. The allocation has to BE the draw-down. That leaves two jobs:
//
//   1. Make the draw-down obey the warehouse's strategy, so the shelf chosen at
//      checkout is the shelf the strategy would have chosen. `orderBinCandidates`
//      below is imported by `bin-ledger.ts` for exactly this. Before Phase 4 the
//      draw-down was hard-coded richest-first, which quietly meant FEFO did not
//      exist: a warehouse with dated stock was shipping whatever pile was biggest.
//   2. Have the pick list READ that decision rather than make a second one.
//      `allocationsForOrderLine` reconstructs it from the bin ledger.
//
// One decision, made once, in one place. Nothing to reconcile afterwards, and no
// window in which the walk and the books disagree.
//
// ── Strategies ───────────────────────────────────────────────────────────────
//
// All four fall back to richest-shelf-first as the final tiebreak, so every one
// of them is total and none can leave a unit unassignable.

import { Prisma } from '@wizeworks/db';
import type { TxClient } from '@wizeworks/db';

/** Mirrors `AllocationStrategy` in @wizeworks/commerce-schemas; kept as a local
 *  string union so the ledger can import this file without a schema dependency
 *  on its hot path. */
export type PickStrategy = 'fifo' | 'fefo' | 'nearest_bin' | 'single_bin';

const STRATEGIES = new Set<PickStrategy>(['fifo', 'fefo', 'nearest_bin', 'single_bin']);

/** Coerce whatever the column holds into a strategy. A row written before the
 *  vocabulary existed, or by a future version, resolves to the default rather
 *  than throwing on a read path a checkout depends on. */
export function toPickStrategy(value: string | null | undefined): PickStrategy {
  return value && STRATEGIES.has(value as PickStrategy) ? (value as PickStrategy) : 'fifo';
}

export interface BinCandidate {
  binId: string;
  binCode: string;
  /** What the books say is on this shelf right now. */
  onHand: number;
  pickSequence: number | null;
  /** True for a `pick`-type shelf — the pick face. */
  isPickFace: boolean;
}

/**
 * The shelves that could supply this item, best first.
 *
 * Ordering is the same for the checkout draw-down and for a pick list built with
 * no sale to read, which is what keeps the two from ever disagreeing.
 *
 * Two orderings apply before the strategy does, and they are not negotiable:
 *
 *   • Only SELLABLE, active shelves. Quarantine and damaged stock is physically
 *     present and must never be walked to for a customer order — that is the
 *     entire reason `isSellable` is a stored column rather than a view of `type`.
 *   • The pick face before bulk. A `bulk` shelf feeds the pick face; picking
 *     from it directly is allowed (refusing would manufacture a short pick while
 *     the stock is visible from where the picker is standing) but it is the last
 *     resort, not the first.
 */
export async function orderBinCandidates(
  tx: TxClient,
  input: {
    tenantId: string;
    variantId: string;
    warehouseId: string;
    strategy: PickStrategy;
    /** Only `single_bin` uses it: prefer one shelf that covers the whole line. */
    quantity?: number;
    /**
     * Let quarantine and damaged shelves in, ranked last.
     *
     * False for picking — a customer order must never be walked to a shelf whose
     * whole meaning is "not for sale". True for the ledger's outbound seating,
     * which has to be able to describe a write-off of damaged stock coming off
     * the damaged shelf; excluding them there would seat the movement on the
     * default bin and drive it negative, which is a worse lie than the ranking.
     */
    includeNonSellable?: boolean;
  }
): Promise<BinCandidate[]> {
  // The strategy decides the FIRST sort key; everything after it is shared.
  //
  //   fifo         longest-held shelf first. A true FIFO needs cost layers
  //                (Phase 5.4); at bin level the honest proxy is the earliest
  //                inbound this shelf has ever recorded for this item, which is
  //                right whenever a shelf is topped up rather than emptied and
  //                refilled — the normal case — and is never worse than
  //                arbitrary.
  //   fefo         handled by lot selection, not shelf selection: lots are
  //                tracked per (variant, warehouse), not per shelf, so the
  //                nearest expiry names a BATCH and the walk to it is FIFO.
  //                See `resolveFefoLot`.
  //   nearest_bin  shortest walk. Nulls last so an unsequenced warehouse still
  //                produces a stable route rather than a random one.
  //   single_bin   a shelf that can cover the whole line, ahead of every shelf
  //                that cannot, then the shortest walk among those.
  const quantity = input.quantity ?? 1;
  const primaryOrder =
    input.strategy === 'nearest_bin'
      ? Prisma.sql`b.pick_sequence ASC NULLS LAST`
      : input.strategy === 'single_bin'
        ? Prisma.sql`(bl.on_hand >= ${quantity}) DESC, b.pick_sequence ASC NULLS LAST`
        : // fifo and fefo both walk oldest-shelf-first.
          Prisma.sql`first_seen.at ASC NULLS LAST`;

  const sellableOnly = input.includeNonSellable
    ? Prisma.empty
    : Prisma.sql`AND b.is_sellable = true`;

  return tx.$queryRaw<BinCandidate[]>`
    SELECT bl.bin_id                     AS "binId",
           b.code                        AS "binCode",
           bl.on_hand                    AS "onHand",
           b.pick_sequence               AS "pickSequence",
           (b.type = 'pick')             AS "isPickFace"
      FROM inventory_bin_levels bl
      JOIN inventory_bins b ON b.id = bl.bin_id
      LEFT JOIN LATERAL (
        SELECT MIN(bm.created_at) AS at
          FROM inventory_bin_movements bm
         WHERE bm.tenant_id = bl.tenant_id
           AND bm.bin_id    = bl.bin_id
           AND bm.variant_id = bl.variant_id
           AND bm.delta > 0
      ) first_seen ON TRUE
     WHERE bl.tenant_id    = ${input.tenantId}::uuid
       AND bl.variant_id   = ${input.variantId}::uuid
       AND bl.warehouse_id = ${input.warehouseId}::uuid
       AND bl.on_hand > 0
       AND b.is_active = true
       AND b.deleted_at IS NULL
       ${sellableOnly}
     ORDER BY b.is_sellable DESC,
              (b.type = 'bulk') ASC,
              ${primaryOrder},
              bl.on_hand DESC,
              b.code ASC
  `;
}

export interface FefoLot {
  lotId: string;
  lotNumber: string;
  expiresAt: Date | null;
}

/**
 * The batch a FEFO warehouse should ship next: the nearest expiry that is not
 * recalled, not already expired, and still has units at this location.
 *
 * Recalled and pending-recall batches are excluded outright rather than ranked
 * last. A recall is a decision that stock must not leave the building, and a
 * strategy that would ship it "only if there is nothing else" is a strategy that
 * ships it on the day it matters most.
 *
 * EXPIRED batches are excluded for the same reason, and their absence from this
 * query until Phase 9.8 was the sharpest edge in the picking path: sorting by
 * `expires_at ASC` puts the most expired batch FIRST, so a location holding one
 * out-of-date box would ship it to every customer until it ran out. FEFO exists
 * precisely to stop that, and it was doing the opposite.
 *
 * The expired stock does not vanish — `listExpiringStock` reports it and it has
 * to be written off by a person, which is the correct amount of friction for
 * destroying goods.
 *
 * Returns null for an item that carries no dated lot — which is most items, and
 * why FEFO falls back to FIFO rather than refusing.
 */
export async function resolveFefoLot(
  tx: TxClient,
  input: { tenantId: string; variantId: string; warehouseId: string }
): Promise<FefoLot | null> {
  const rows = await tx.$queryRaw<FefoLot[]>`
    SELECT id          AS "lotId",
           lot_number  AS "lotNumber",
           expires_at  AS "expiresAt"
      FROM inventory_lot_batches
     WHERE tenant_id    = ${input.tenantId}::uuid
       AND variant_id   = ${input.variantId}::uuid
       AND warehouse_id = ${input.warehouseId}::uuid
       AND quantity > 0
       AND expires_at IS NOT NULL
       AND expires_at > now()
       AND (recall_status IS NULL OR recall_status = 'cleared')
     ORDER BY expires_at ASC
     LIMIT 1
  `;
  return rows[0] ?? null;
}

export interface PickAllocation {
  /** Null on a location that does not use shelves. */
  binId: string | null;
  binCode: string | null;
  lotId: string | null;
  lotNumber: string | null;
  quantity: number;
  /** Walk order. Copied from the shelf, or 0 when there are no shelves. */
  pickSequence: number;
}

export interface AllocationResult {
  allocations: PickAllocation[];
  /**
   * Units the shelves could not account for.
   *
   * Reported rather than swallowed, and reported BEFORE anyone walks: "we do not
   * believe these are anywhere" is worth knowing at the desk, not at the end of
   * an aisle. The caller writes it as a line that is short from the start.
   */
  shortfall: number;
}

/**
 * Where the units for one order line are, according to the decision already made.
 *
 * Reads the shelves the SALE drew from — `inventory_bin_movements` rows carrying
 * the sale movement's id — because that is the allocation, made at checkout under
 * the warehouse's strategy. Nothing is chosen here that was not already chosen.
 *
 * Falls back to a live candidate walk when there is no sale to read: an order
 * placed while the inventory module was off, an imported order, a B2B order
 * approved through a path that never touched the ledger. Those are real and they
 * still have to be picked.
 */
export async function allocationsForOrderLine(
  tx: TxClient,
  input: {
    tenantId: string;
    orderId: string;
    variantId: string;
    warehouseId: string;
    quantity: number;
    strategy: PickStrategy;
    usesBins: boolean;
  }
): Promise<AllocationResult> {
  const lot =
    input.strategy === 'fefo'
      ? await resolveFefoLot(tx, {
          tenantId: input.tenantId,
          variantId: input.variantId,
          warehouseId: input.warehouseId,
        })
      : null;

  if (!input.usesBins) {
    return {
      allocations: [
        {
          binId: null,
          binCode: null,
          lotId: lot?.lotId ?? null,
          lotNumber: lot?.lotNumber ?? null,
          quantity: input.quantity,
          pickSequence: 0,
        },
      ],
      shortfall: 0,
    };
  }

  const fromSale = await tx.$queryRaw<
    { binId: string; binCode: string; pickSequence: number | null; units: number }[]
  >`
    SELECT bm.bin_id                AS "binId",
           b.code                   AS "binCode",
           b.pick_sequence          AS "pickSequence",
           SUM(-bm.delta)::int      AS "units"
      FROM inventory_bin_movements bm
      JOIN inventory_movements m ON m.id = bm.movement_id
      JOIN inventory_bins b      ON b.id = bm.bin_id
     WHERE bm.tenant_id     = ${input.tenantId}::uuid
       AND bm.variant_id    = ${input.variantId}::uuid
       AND bm.warehouse_id  = ${input.warehouseId}::uuid
       AND bm.delta < 0
       AND m.reason         = 'sale'
       AND m.reference_type = 'Order'
       AND m.reference_id   = ${input.orderId}::uuid
     GROUP BY bm.bin_id, b.code, b.pick_sequence
     HAVING SUM(-bm.delta) > 0
     ORDER BY b.pick_sequence ASC NULLS LAST, b.code ASC
  `;

  const allocations: PickAllocation[] = [];
  let remaining = input.quantity;

  for (const row of fromSale) {
    if (remaining <= 0) break;
    const take = Math.min(row.units, remaining);
    allocations.push({
      binId: row.binId,
      binCode: row.binCode,
      lotId: lot?.lotId ?? null,
      lotNumber: lot?.lotNumber ?? null,
      quantity: take,
      pickSequence: row.pickSequence ?? Number.MAX_SAFE_INTEGER,
    });
    remaining -= take;
  }

  // Either there was no sale to read, or it covered less than this line wants
  // (a partially picked line being re-listed). Ask the shelves.
  if (remaining > 0) {
    const candidates = await orderBinCandidates(tx, {
      tenantId: input.tenantId,
      variantId: input.variantId,
      warehouseId: input.warehouseId,
      strategy: input.strategy,
      quantity: remaining,
    });
    const claimed = new Map(allocations.map((a) => [a.binId, a.quantity]));
    for (const candidate of candidates) {
      if (remaining <= 0) break;
      // A shelf the sale already drew from has that much less left to offer.
      const spare = candidate.onHand - (claimed.get(candidate.binId) ?? 0);
      if (spare <= 0) continue;
      const take = Math.min(spare, remaining);
      const existing = allocations.find((a) => a.binId === candidate.binId);
      if (existing) {
        existing.quantity += take;
      } else {
        allocations.push({
          binId: candidate.binId,
          binCode: candidate.binCode,
          lotId: lot?.lotId ?? null,
          lotNumber: lot?.lotNumber ?? null,
          quantity: take,
          pickSequence: candidate.pickSequence ?? Number.MAX_SAFE_INTEGER,
        });
      }
      remaining -= take;
    }
  }

  return { allocations, shortfall: Math.max(0, remaining) };
}
