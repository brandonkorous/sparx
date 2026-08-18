'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE MOVEMENTS DATA LAYER
//
// The append-only stock ledger: every single change to a stock number, and what
// caused it. Read-only by nature — there is no write here, because the ledger is
// written for you. A sale, a delivery, a count being applied, a transfer: each
// already records a row, and this surface is the window onto them.
//
// The row shape is the shared `StockMovement` from ./data with the three fields
// the movement endpoint carries that the per-item history did not need — the
// product title (so the ledger can be read without opening each item), where a
// row came from, and the unit cost. Imported rather than re-declared, so the two
// surfaces onto one server row never drift apart. `movementReason` is imported
// for the same reason: the shop's words for the engineer's stored reason live in
// exactly one place.
// ══════════════════════════════════════════════════════════════════════════

import { useQuery } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { type StockMovement, type Tone } from './data';

/* ── Shape ──────────────────────────────────────────────────────────────── */

/** A ledger row as the movements endpoint returns it — the shared movement plus
 *  the few fields only this fuller view needs. */
export interface Movement extends StockMovement {
  /** The product this variant belongs to, for reading the log at a glance. */
  productTitle: string | null;
  /** Which connected system a synced row came from, if any. */
  source: string | null;
  unitCostCents: number | null;
}

/* ── Query keys ─────────────────────────────────────────────────────────── */

export interface MovementQuery {
  q?: string;
  warehouseId?: string;
  reason?: string;
  /** Narrow to one item — set when the log is opened for a specific variant. */
  variantId?: string;
  /** Inclusive ISO bounds on when the change happened. */
  from?: string;
  to?: string;
  take: number;
  skip: number;
}

export const movementKeys = {
  all: ['inventory', 'movements'] as const,
  list: (query: MovementQuery) => [...movementKeys.all, 'list', query] as const,
};

/* ── Read ───────────────────────────────────────────────────────────────── */

/**
 * One window of the ledger, newest first.
 *
 * Every narrowing — the free-text item search, the location, the reason, the
 * date range — is a SERVER filter. A ledger is the one list where filtering the
 * loaded page in the browser is most obviously wrong: "every loss last month"
 * asked of the fifty rows in hand answers with the losses among the newest
 * fifty movements of ANY kind, which is not the same list at all.
 */
export function useMovements(query: MovementQuery) {
  return useQuery({
    queryKey: movementKeys.list(query),
    queryFn: () =>
      api.list<Movement>('/v1/inventory/movements', {
        ...(query.q ? { q: query.q } : {}),
        ...(query.warehouseId ? { warehouse_id: query.warehouseId } : {}),
        ...(query.reason ? { reason: query.reason } : {}),
        ...(query.variantId ? { variant_id: query.variantId } : {}),
        ...(query.from ? { from: query.from } : {}),
        ...(query.to ? { to: query.to } : {}),
        take: query.take,
        skip: query.skip,
      }),
    placeholderData: (previous) => previous,
  });
}

/* ── The reasons you can filter by ──────────────────────────────────────── */

/**
 * Every reason a stock number can change, in the order an owner would scan.
 *
 * The stored value is the engineer's; the label comes from the shared
 * `movementReason` map so the dropdown and the rows always agree on wording.
 * `manual` is deliberately omitted here — its label ("Changed by hand") is the
 * `movementReason` fallback, and a filter option that also catches every unknown
 * future reason is a lie about what it selects.
 */
export const MOVEMENT_REASONS: readonly string[] = [
  'sale',
  'return',
  'cancel',
  'receive',
  'recount',
  'transfer_in',
  'transfer_out',
  'loss',
  'damage',
  'return_to_supplier',
  'reserve',
  'release',
  'sync',
];

/* ── Saying what a change means ─────────────────────────────────────────── */

/**
 * The tone for a signed change: stock coming IN reads as good, stock going OUT
 * as a debit, no net change as calm. This is about direction, not about whether
 * the change was welcome — a sale is an "out" even though selling is the point.
 */
export function deltaTone(delta: number): Tone {
  if (delta > 0) return 'success';
  if (delta < 0) return 'danger';
  return 'neutral';
}

/** A signed change with its sign always shown — `+3`, `−2`, `0` — so a column of
 *  them reads as a ledger rather than a column of bare numbers. */
export function signedDelta(delta: number): string {
  if (delta > 0) return `+${String(delta)}`;
  if (delta < 0) return `−${String(Math.abs(delta))}`;
  return '0';
}
