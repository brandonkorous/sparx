'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE REORDER WORKLIST DATA LAYER
//
// What is running low and needs buying again — the buyer's daily list. Every row
// is a (variant × location) at or below its reorder point, carrying the numbers
// that decide whether to act: how many are left, the level that triggered it, how
// many to order, and whether some are already inbound.
//
// ── Why its own file, next to data.ts rather than inside it ────────────────
//
// The Stock surfaces share `data.ts`; this is a sibling module (Buying), so it
// keeps its own keys, hooks and row shape here and only IMPORTS the genuinely
// shared helpers from data.ts (`Tone`, `formatCents`, `plural`, `locationLabel`,
// `stockErrorMessage`). Nothing here redeclares one of those.
//
// ── Every narrowing is a SERVER query ──────────────────────────────────────
//
// Search, the location and supplier filters, the urgency/shortfall sort and the
// paging all go to `/v1/inventory/reorder/worklist`. The endpoint flattens the
// grouped reorder engine, applies the narrowing over the WHOLE low set, then
// pages — so this client never sorts or filters a page and calls it the answer.
//
// ── No days-of-cover ───────────────────────────────────────────────────────
//
// The reorder engine works off the reorder point + lead time, not a sales
// velocity, so there is no honest "days of cover" figure to show — inventing one
// from a single snapshot would be a number that looks precise and means nothing.
// Urgency here is "how little is left" and "how far below the trigger", both real.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { api } from '../../lib/api/client';
import type { Tone } from './data';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

/**
 * One line of the worklist — a low (variant × location) and the supplier the
 * engine would buy it from.
 *
 * `supplierId === null` is a real, distinct state: the thing is low but nothing
 * supplies it yet, so it can't be turned into a purchase order until a supplier
 * is linked. Those rows are shown but not selectable.
 */
export interface ReorderRow {
  variantId: string;
  /** The product code. Null only on a variant saved without one. */
  sku: string | null;
  title: string | null;
  productId: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  /** Physically on the shelf. */
  onHand: number;
  /** `onHand − allocated` — what isn't already spoken for. This is the figure
   *  compared against the reorder point, so it's what "running low" is about. */
  available: number;
  /** The level that trips a reorder. Always set on a worklist row. */
  reorderPoint: number;
  /** The configured fixed lot, if any. Null means "top back up to the point". */
  reorderQuantity: number | null;
  /** How many to order: the fixed lot, else enough to reach the reorder point,
   *  never below the supplier's minimum. What a draft line defaults to. */
  suggestedQuantity: number;
  /** Units already on an open purchase order for this location — so the buyer
   *  doesn't re-order what is already on its way. */
  onOrder: number;
  /** The preferred supplier the engine resolved. Null = nothing supplies it. */
  supplierId: string | null;
  supplierName: string | null;
  supplierCode: string | null;
  /** How long this supplier takes to deliver. The other half of a reorder point. */
  leadTimeDays: number | null;
  currency: string | null;
  unitCostCents: number | null;
  /** `unitCostCents × suggestedQuantity`, when a cost is known. */
  estimatedCostCents: number | null;
}

/** A supplier, trimmed to what the filter needs. */
export interface ReorderSupplier {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

/** One drafted purchase order, echoed back after drafting. */
export interface DraftedPurchaseOrder {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string | null;
  warehouseId: string;
  warehouseName: string | null;
  lineCount: number;
  totalCents: number;
  currency: string;
}

export interface DraftReorderResult {
  purchaseOrders: DraftedPurchaseOrder[];
  count: number;
}

/* ── Query keys ─────────────────────────────────────────────────────────── */

export type ReorderSort = 'urgency' | 'shortfall';

export interface ReorderQuery {
  q?: string;
  /** Narrow to one location. Undefined means everywhere. */
  warehouseId?: string;
  /** Narrow to one supplier. Undefined means every supplier. */
  supplierId?: string;
  sort: ReorderSort;
  take: number;
  skip: number;
}

export const reorderKeys = {
  all: ['inventory', 'reorder'] as const,
  worklist: (query: ReorderQuery) => [...reorderKeys.all, 'worklist', query] as const,
  summary: () => [...reorderKeys.all, 'summary'] as const,
  suppliers: () => [...reorderKeys.all, 'suppliers'] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────── */

/**
 * One window of the reorder worklist.
 *
 * `placeholderData` keeps the current rows on screen while the next window
 * loads, so paging and re-sorting don't blink the table out to empty and back.
 */
export function useReorderWorklist(query: ReorderQuery) {
  return useQuery({
    queryKey: reorderKeys.worklist(query),
    queryFn: () =>
      api.list<ReorderRow>('/v1/inventory/reorder/worklist', {
        ...(query.q ? { q: query.q } : {}),
        ...(query.warehouseId ? { warehouse_id: query.warehouseId } : {}),
        ...(query.supplierId ? { supplier_id: query.supplierId } : {}),
        sort: query.sort,
        take: query.take,
        skip: query.skip,
      }),
    placeholderData: (previous) => previous,
  });
}

/**
 * Does any level even have a reorder rule?
 *
 * The one fact that tells an empty worklist apart: "nothing is running low" (good
 * news) versus "no reorder rules exist yet" (nothing can ever warn you). Both are
 * an empty list, and they deserve opposite messages.
 */
export function useReorderSummary() {
  return useQuery({
    queryKey: reorderKeys.summary(),
    queryFn: () => api.get<{ policyCount: number }>('/v1/inventory/reorder/summary'),
    staleTime: 60_000,
  });
}

/**
 * Every supplier, for the filter picker.
 *
 * The full active list rather than only suppliers with something low, so the
 * control is stable — it doesn't gain and lose options as stock moves under it.
 */
export function useReorderSuppliers() {
  return useQuery({
    queryKey: reorderKeys.suppliers(),
    queryFn: () => api.list<ReorderSupplier>('/v1/inventory/suppliers', { take: 250 }),
    staleTime: 5 * 60_000,
  });
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

/** One line the buyer chose to act on. */
export interface DraftLine {
  variantId: string;
  warehouseId: string;
  supplierId: string;
  quantity: number;
}

/**
 * Turn chosen suggestions into draft purchase orders — one per (supplier,
 * location) group, in a single all-or-nothing transaction.
 *
 * A draft is nothing ordered yet: it's a reviewable order the buyer sends (or
 * edits, or discards) afterward, which is why this is safe to run from a list.
 * On success the worklist is refreshed — the drafted rows now show as on-order,
 * so the buyer sees at a glance what's already handled.
 */
export function useDraftReorder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lines: DraftLine[]) =>
      api.post<DraftReorderResult>('/v1/inventory/reorder/draft', { lines }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reorderKeys.all });
      // The new drafts belong to the purchase-orders list too; refresh it so a
      // pane docked against it isn't left a step behind.
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'purchase-orders'] });
    },
  });
}

/* ── Saying what a number means ─────────────────────────────────────────── */

export interface ReorderState {
  label: string;
  tone: Tone;
}

/**
 * What a low row means, in the words an owner would use.
 *
 * Every worklist row is already at or below its reorder point, so there is no
 * "in stock" case here — only how bad it is. Nothing left to sell is the worse
 * problem (a website already saying "out of stock") and wears danger; still
 * having a few but under the trigger wears warning.
 */
export function reorderState(row: { available: number }): ReorderState {
  return row.available <= 0
    ? { label: 'Out of stock', tone: 'danger' }
    : { label: 'Running low', tone: 'warning' };
}

/** How this row's supplier reads on screen — the name, or a plain marker when
 *  nothing supplies it yet. */
export function supplierLabel(row: Pick<ReorderRow, 'supplierName' | 'supplierCode'>): string {
  return row.supplierName ?? row.supplierCode ?? 'No supplier yet';
}

/** How many distinct purchase orders a set of chosen lines would draft — one per
 *  (supplier, location) — so the buyer is told before they commit. */
export function purchaseOrderCount(lines: DraftLine[]): number {
  const groups = new Set(lines.map((l) => `${l.supplierId}:${l.warehouseId}`));
  return groups.size;
}
