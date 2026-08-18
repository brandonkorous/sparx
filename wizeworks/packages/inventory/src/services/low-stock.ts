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
