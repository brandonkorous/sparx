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
// Search, the location and supplier filters, the sort (urgency / shortfall /
// runs-out-soonest) and the paging all go to `/v1/inventory/reorder/worklist`.
// The endpoint flattens the grouped reorder engine, applies the narrowing over
// the WHOLE low set, then pages — so this client never sorts or filters a page
// and calls it the answer.
//
// ── Days of cover comes from the ledger, not a guess ───────────────────────
//
// Each row now carries a real sales-velocity read: units sold per day over a
// trailing window, the days of cover the available stock gives at that rate, and
// the date it is projected to hit zero. The worklist route does NOT compute this
// — it merges the shared `reorderAnalysis` (the same figures the reports export
// and the AI supply tools use) onto each low row, so the number is honest and
// consistent everywhere. Two distinct "no figure" cases are kept apart: velocity
// measured as zero (nothing selling — no deadline) versus velocity not measured
// for this row at all. Neither is faked into an urgency it does not have.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
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
  /** Average units sold per day over the trailing velocity window. 0 means it was
   *  measured and nothing sold; null means it could not be measured for this row. */
  velocityPerDay: number | null;
  /** How many days the available stock lasts at that rate. Null when nothing is
   *  selling (no honest cover) or velocity was not measured. */
  daysOfCover: number | null;
  /** ISO date this row is projected to hit zero, at that rate. Null with cover. */
  projectedStockoutAt: string | null;

  // ── What running out would COST (docs/146 Phase 7.7) ──────────────────────
  /** Days of cover counting stock already on order — the figure that decides
   *  urgency, because an order on its way genuinely closes the gap. */
  daysOfCoverWithInbound: number | null;
  /** Units of demand with nowhere to come from before a replacement lands. */
  unitsAtRisk: number;
  /** What those units would have sold for. The default ordering of this list. */
  revenueAtRiskCents: number;
  /** The supplier's MEASURED delivery time where deliveries have been recorded. */
  measuredLeadTimeDays: number | null;
  /** measured | supplier | level | default — how much to trust the figure above. */
  leadTimeSource: string | null;
  abcClass: string | null;
  xyzClass: string | null;
  /** The whole calculation in one sentence. Null when the server had no
   *  measurement for this row rather than a measured "nothing sells". */
  reasoning: string | null;
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

export type ReorderSort = 'risk' | 'urgency' | 'shortfall' | 'cover';

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

/** How this row's supplier reads on screen — the name, or a plain marker when
 *  nothing supplies it yet. */
export function supplierLabel(row: Pick<ReorderRow, 'supplierName' | 'supplierCode'>): string {
  return row.supplierName ?? row.supplierCode ?? 'No supplier yet';
}

/* ── Sales velocity → "when does this run out?" in shop words ────────────── */

/**
 * How fast this sells, said the way an owner counts it — never a bare decimal.
 *
 * A brisk seller reads "~4/day"; a slow one that shifts less than one a day reads
 * "~1 every 5 days", which is far easier to picture than "0.2/day". Null means we
 * have no honest figure: either nothing has sold (a measured zero) or this row
 * fell outside the measured window — both show as a dash rather than a fake rate.
 */
export function velocityLabel(row: Pick<ReorderRow, 'velocityPerDay'>): string | null {
  const v = row.velocityPerDay;
  // `== null` catches both the honest null and a field a stale server omitted —
  // either way there is no rate to print, never a NaN.
  if (v == null || v <= 0) return null;
  if (v >= 1) return `~${Math.round(v)}/day`;
  return `~1 every ${Math.max(2, Math.round(1 / v))} days`;
}

export interface CoverSignal {
  /** The badge text — a whole plain sentence, toned by how soon it bites. */
  label: string;
  tone: Tone;
}

/**
 * The headline for a row: when it runs out, in words, colored by urgency.
 *
 * Order matters. Already out is the worst regardless of pace and wears danger.
 * With a real sales rate we say the projected stock-out plainly — "Out in about
 * 6 days" while it is near, "Out around 12 Aug" once it is far enough that a date
 * reads better than a countdown — and color it danger under three days, warning
 * under a week, otherwise a calm success (there is time). A measured zero is "Not
 * selling": low, but nothing is drawing it down, so no deadline and no alarm. When
 * velocity was never measured for this row we fall back to the plain low state
 * rather than invent a cover it cannot support.
 */
export function coverSignal(row: ReorderRow): CoverSignal {
  if (row.available <= 0) return { label: 'Out of stock', tone: 'danger' };
  // `== null` (not `=== null`) so a field a stale server omitted degrades to the
  // plain low state rather than falling through into NaN cover arithmetic.
  if (row.velocityPerDay == null) return { label: 'Running low', tone: 'warning' };
  if (row.velocityPerDay === 0 || row.daysOfCover == null) {
    return { label: 'Not selling', tone: 'info' };
  }
  const days = row.daysOfCover;
  const tone: Tone = days <= 3 ? 'danger' : days <= 7 ? 'warning' : 'success';
  return { label: stockoutPhrase(days, row.projectedStockoutAt), tone };
}

/** The projected stock-out as a phrase: a countdown while it is near, a calendar
 *  date once that is easier to read than "in about 40 days". */
function stockoutPhrase(days: number, projectedStockoutAt: string | null): string {
  if (days < 1) return 'Out within a day';
  if (days < 2) return 'Out in about a day';
  if (days < 14 || !projectedStockoutAt) return `Out in about ${Math.round(days)} days`;
  return `Out around ${formatStockoutDate(projectedStockoutAt)}`;
}

/** A short, monthless-year date — "12 Aug" — the way a person would say it. */
function formatStockoutDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'soon';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * How the supplier's delivery time should read, and how much to trust it.
 *
 * A measured figure and a supplier's claim are the difference between a reorder
 * level that works and one that is optimistic by however much the supplier is
 * optimistic — so the row says which it has, rather than printing both the same.
 */
export function leadTimeSignal(
  row: Pick<ReorderRow, 'measuredLeadTimeDays' | 'leadTimeSource' | 'leadTimeDays'>
): { label: string; detail: string; tone: Tone } | null {
  const days = row.measuredLeadTimeDays ?? row.leadTimeDays;
  if (days === null) return null;
  const label = `${Math.round(days)} days`;
  switch (row.leadTimeSource) {
    case 'measured':
      return { label, detail: 'Measured from their real deliveries', tone: 'success' };
    case 'supplier':
      return { label, detail: 'What the supplier says — not yet checked', tone: 'warning' };
    case 'level':
      return { label, detail: 'The figure set on this stock line', tone: 'info' };
    case 'default':
      return { label, detail: 'Assumed — nothing is known about this one', tone: 'danger' };
    default:
      return { label, detail: 'From the supplier record', tone: 'neutral' };
  }
}

/** How many distinct purchase orders a set of chosen lines would draft — one per
 *  (supplier, location) — so the buyer is told before they commit. */
export function purchaseOrderCount(lines: DraftLine[]): number {
  const groups = new Set(lines.map((l) => `${l.supplierId}:${l.warehouseId}`));
  return groups.size;
}
