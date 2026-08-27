// ══════════════════════════════════════════════════════════════════════════
// THE ONE DEFINITION OF "SELLABLE" AND "RUNNING LOW"
//
// This arithmetic used to live in five places and disagreed with itself: the
// public list deducted the safety buffer, the alerts endpoint did not, one
// warehouse read hard-coded `onHand <= 5`, and a route filtered on raw on-hand.
// The same SKU could read "fine" on one surface and "running low" on the next.
// Every read path that decides whether a level is low now routes through here.
//
// SELLABLE is on-hand minus what is already spoken for, minus the buffer
// deliberately withheld from sale, minus what is sitting on a shelf nothing may
// be sold from. It is NOT the reported `available` (`on_hand - allocated`),
// which stops before the buffer — a buffered level's `available` is a number no
// shopper can ever reach, which is exactly why the buffer has to come out before
// you ask "is this low".
//
// The fourth term arrived with returns disposition (docs/146 Phase 9.7). A
// quarantined, damaged or awaiting-repair unit is counted in `on_hand` because
// it is genuinely in the building, and it cannot be sold to anybody. Without
// this term, routing a returned item to the quarantine shelf moves it on a
// screen and leaves it on sale, which makes the whole disposition workflow
// decorative.
//
// Two forms, one meaning: a `Prisma.sql` fragment for queries that filter in the
// database (the predicate is an expression over three columns, so Prisma's typed
// `where` cannot express it), and a JS twin for rows already in memory. Keep the
// two in lockstep — they are the same sentence written twice.
// ══════════════════════════════════════════════════════════════════════════

import { Prisma } from '@wizeworks/db';

/**
 * Sellable units for an `inventory_levels` row that the surrounding query MUST
 * alias `l`. Unclamped on purpose: an oversold level is genuinely negative, and
 * the low-stock comparison below wants the true value, not a floored one.
 */
export const SELLABLE_SQL = Prisma.sql`(l.on_hand - l.allocated - l.safety_buffer - l.unsellable_on_hand)`;

/**
 * A level is "running low" when it has a reorder policy AND sellable stock has
 * fallen to or below the reorder point. A level with no reorder point is NOT low
 * here — an owner who set no trigger asked for no alert. (The dashboard health
 * KPI asks a different question and applies a fallback threshold so policy-less
 * levels still surface; see the inventory reports route.)
 *
 * Parenthesised so it drops safely into a `WHERE` beside other conditions,
 * including a future `OR`.
 */
export const LOW_STOCK_SQL = Prisma.sql`(l.reorder_point IS NOT NULL AND ${SELLABLE_SQL} <= l.reorder_point)`;

/**
 * A level that CANNOT BE SOLD: nothing sellable is left. Deliberately not a
 * variation on "low" — it needs no reorder point, because "there is none" is a
 * fact about the shelf rather than a judgement against a threshold somebody
 * chose. A business that has set no reorder points can never be low, and that is
 * defensible; it can still be OUT, and a screen that cannot say so tells an
 * owner nothing is wrong while a size sits struck through on their own shop.
 *
 * Strictly worse than low, and NOT exclusive of it: a level at zero that also
 * has a reorder point satisfies both predicates. `LOW_STOCK_SQL` keeps
 * including those on purpose — an alert or a reorder list that dropped the
 * items at zero would hide the most urgent rows it exists to show. A caller
 * that shows the two side by side, and must not count one level twice, pairs
 * the low filter with `IN_STOCK_SQL` below.
 */
export const OUT_OF_STOCK_SQL = Prisma.sql`(${SELLABLE_SQL} <= 0)`;

/**
 * Still sellable — the complement of {@link OUT_OF_STOCK_SQL}.
 *
 * `LOW_STOCK_SQL AND IN_STOCK_SQL` is "running low but not gone", which is
 * exactly what the console badges "Running low" (`levelState` reports the worse
 * state, so a level at zero is badged "None to sell" and never "Running low").
 * That pairing makes low and out disjoint, so two counts of them can be added.
 */
export const IN_STOCK_SQL = Prisma.sql`(${SELLABLE_SQL} > 0)`;

/** Sellable units for a level already in memory. Floored at zero — a count you
 *  show a person, not a predicate, and "−3 to sell" is not a thing you say. */
export function sellableUnits(level: {
  onHand: number;
  allocated: number;
  safetyBuffer: number;
  /** Optional so existing callers that never had the column keep compiling; a
   *  missing value means zero, which is the truth for every location that does
   *  not use shelves. */
  unsellableOnHand?: number;
}): number {
  return Math.max(
    0,
    level.onHand - level.allocated - level.safetyBuffer - (level.unsellableOnHand ?? 0)
  );
}

/**
 * The JS twin of {@link LOW_STOCK_SQL}, for filtering rows already fetched.
 * Uses the unclamped arithmetic so it matches the SQL predicate exactly.
 */
export function isLowStock(level: {
  onHand: number;
  allocated: number;
  safetyBuffer: number;
  unsellableOnHand?: number;
  reorderPoint: number | null;
}): boolean {
  return (
    level.reorderPoint !== null &&
    level.onHand - level.allocated - level.safetyBuffer - (level.unsellableOnHand ?? 0) <=
      level.reorderPoint
  );
}

/**
 * The JS twin of {@link OUT_OF_STOCK_SQL}. Uses the unclamped arithmetic so an
 * oversold level (negative sellable) counts as out, which it is.
 */
export function isOutOfStock(level: {
  onHand: number;
  allocated: number;
  safetyBuffer: number;
  unsellableOnHand?: number;
}): boolean {
  return level.onHand - level.allocated - level.safetyBuffer - (level.unsellableOnHand ?? 0) <= 0;
}
