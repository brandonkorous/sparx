'use client';

// ══════════════════════════════════════════════════════════════════════════
// HOW YOUR SUPPLIERS ACTUALLY BEHAVE (docs/146 Phase 8.1, 8.3, 8.4)
//
// Three related reads that all answer one question a business normally has to
// answer from memory: is this supplier any good, and what do they really charge?
//
//   scorecards    on time, in full, at the agreed price, undamaged
//   late orders   what is overdue right now, worst first
//   price breaks  "£4.10 each, or £3.60 if you take fifty"
//
// ── The rule that shapes every type in here ───────────────────────────────
//
// EVERY MEASURED FIGURE IS `number | null`, AND EVERY ONE CARRIES ITS SAMPLE
// COUNT. Nothing in this file may present an unmeasured thing as a measurement.
// "0% on time" for a supplier who never quoted a delivery date is a number a
// person acts on, and it is wrong in the direction that ends a relationship. The
// surfaces read `null` as "we cannot say" and print words, never a figure.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { api } from '../../lib/api/client';
import type { Tone } from './data';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

/** One supplier's card. Mirrors the server's SupplierScorecardRow. */
export interface SupplierScorecard {
  supplierId: string;
  supplierName: string | null;
  supplierCode: string | null;
  /** How far back the measurement reaches — 365 by default. */
  windowDays: number;
  measuredAt: string;

  ordersPlaced: number;
  deliveries: number;
  spendCents: number;
  receivedUnits: number;

  /** 0–1. Null when nobody ever set a date for them to be late for. */
  onTimeRate: number | null;
  onTimeSample: number;
  lateDeliveries: number;
  /** Averaged over the LATE ones only. Null when none were. */
  avgDaysLate: number | null;

  /** 0–1, over lines on finished orders. Null until an order has finished. */
  fillRate: number | null;
  fillRateSample: number;
  shortLines: number;

  leadTimeMeanDays: number | null;
  leadTimePromisedDays: number | null;
  /** Measured minus promised. Positive = slower than they said. */
  leadTimeVarianceDays: number | null;
  leadTimeSample: number;

  /** Signed percent: +4 means they invoiced 4% above the agreed price. */
  priceVariancePct: number | null;
  priceVarianceCents: number | null;
  priceVarianceSample: number;

  /** 0–1. Null only when nothing was received at all. */
  damageRate: number | null;
  damagedUnits: number;

  /** 0–100, or NULL when too little could be measured to publish one. */
  score: number | null;
  grade: string | null;
  /** How many of the four components the score stands on. */
  scoredComponents: number;
}

export interface SupplierScorecardReport {
  items: SupplierScorecard[];
  total: number;
  /** Null when the pass has never run — which is what lets the screen tell
   *  "nobody has a problem" apart from "nobody has looked". */
  measuredAt: string | null;
  /** Suppliers on file who could not be graded. */
  unscored: number;
}

export interface LatePurchaseOrder {
  purchaseOrderId: string;
  number: string;
  supplierId: string;
  supplierName: string | null;
  warehouseId: string;
  status: string;
  orderedAt: string | null;
  dueAt: string;
  /** Whether the due date is the buyer's own or derived from the supplier's
   *  stated lead time. A buyer on the phone needs to know which they are
   *  quoting. */
  dueSource: 'expected_arrival' | 'supplier_lead_time';
  daysLate: number;
  unitsOutstanding: number;
  valueOutstandingCents: number;
  /** Null when it has never been flagged. NOT the same as "on time". */
  alertedAt: string | null;
}

export interface LateOrdersReport {
  items: LatePurchaseOrder[];
  total: number;
  /** Open orders with no due date at all — nobody can be late on them, which is
   *  a gap in the paperwork rather than good news. */
  undated: number;
}

export interface PriceBreak {
  id: string;
  supplierVariantId: string;
  /** In base units. */
  minQuantity: number;
  unitCostCents: number;
}

export interface PriceLadder {
  supplierVariantId: string;
  supplierId: string;
  variantId: string;
  /** The price below the first break. Null when the link has no cost recorded —
   *  which must never render as free. */
  baseUnitCostCents: number | null;
  breaks: PriceBreak[];
}

/* ── Query keys ─────────────────────────────────────────────────────────── */

export const performanceKeys = {
  all: ['inventory', 'supplier-performance'] as const,
  scorecards: (scoredOnly: boolean) => [...performanceKeys.all, 'scorecards', scoredOnly] as const,
  scorecard: (supplierId: string) => [...performanceKeys.all, 'scorecard', supplierId] as const,
  late: (supplierId: string) => [...performanceKeys.all, 'late', supplierId] as const,
  ladder: (supplierVariantId: string) =>
    [...performanceKeys.all, 'ladder', supplierVariantId] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────── */

export function useSupplierScorecards(options: { scoredOnly?: boolean } = {}) {
  const scoredOnly = options.scoredOnly ?? false;
  return useQuery({
    queryKey: performanceKeys.scorecards(scoredOnly),
    queryFn: () =>
      api.get<SupplierScorecardReport>('/v1/inventory/suppliers/scorecards', {
        ...(scoredOnly ? { scored_only: true } : {}),
        take: 200,
      }),
    placeholderData: (previous) => previous,
  });
}

/**
 * One supplier's card, for the panel on their detail pane.
 *
 * A 404 here is EXPECTED and is not an error: it means the nightly pass has
 * never reached this supplier. `retry: false` so an unmeasured supplier does not
 * cost three round-trips before the panel can say so in words.
 */
export function useSupplierScorecard(supplierId: string) {
  return useQuery({
    queryKey: performanceKeys.scorecard(supplierId),
    queryFn: () => api.get<SupplierScorecard>(`/v1/inventory/suppliers/${supplierId}/scorecard`),
    enabled: supplierId !== '' && supplierId !== 'new',
    retry: false,
  });
}

export function useLatePurchaseOrders(supplierId = '') {
  return useQuery({
    queryKey: performanceKeys.late(supplierId),
    queryFn: () =>
      api.get<LateOrdersReport>('/v1/inventory/purchase-orders/late', {
        ...(supplierId ? { supplier_id: supplierId } : {}),
        take: 200,
      }),
    placeholderData: (previous) => previous,
  });
}

export function usePriceLadder(supplierVariantId: string) {
  return useQuery({
    queryKey: performanceKeys.ladder(supplierVariantId),
    queryFn: () =>
      api.get<PriceLadder>(`/v1/inventory/supplier-variants/${supplierVariantId}/price-breaks`),
    enabled: supplierVariantId !== '',
  });
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

export interface ScorecardSweepResult {
  suppliersMeasured: number;
  suppliersScored: number;
  windowDays: number;
}

export function useRecomputeScorecards() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<ScorecardSweepResult>('/v1/inventory/suppliers/scorecards/recompute', {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: performanceKeys.all });
    },
  });
}

/** Replace the whole ladder in one write — a price list arrives as a list, and
 *  patching it row by row is how two of five rungs end up describing last
 *  year's terms. */
export function useSetPriceBreaks(supplierVariantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (breaks: { minQuantity: number; unitCostCents: number }[]) =>
      api.put<PriceLadder>(`/v1/inventory/supplier-variants/${supplierVariantId}/price-breaks`, {
        breaks,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: performanceKeys.all });
    },
  });
}

/* ── Saying it out loud ─────────────────────────────────────────────────── */

/**
 * A grade's colour.
 *
 * An UNGRADED supplier is `neutral` and that is the one case where neutral is
 * earned: it genuinely carries no judgement, which is the whole point. Every
 * other value distinguishes A from D and so must carry colour (DESIGN.md RULE
 * #4).
 */
export function gradeTone(grade: string | null): Tone {
  switch (grade) {
    case 'A':
      return 'success';
    case 'B':
      return 'info';
    case 'C':
      return 'warning';
    case 'D':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function gradeLabel(grade: string | null): string {
  switch (grade) {
    case 'A':
      return 'Excellent';
    case 'B':
      return 'Good';
    case 'C':
      return 'Patchy';
    case 'D':
      return 'Poor';
    default:
      return 'Not enough to judge';
  }
}

/** A 0–1 rate as a percentage — or the honest words when nobody could measure
 *  it. NEVER "0%": that is a claim, and absence is not one. */
export function rateOrUnknown(rate: number | null): string {
  return rate === null ? 'Not measured' : `${Math.round(rate * 100)}%`;
}

/**
 * How worrying an on-time rate is.
 *
 * Anchored to what distributors actually manage: above 95% is genuinely good,
 * 85–95% is normal and liveable, below 70% is a supplier whose dates cannot be
 * planned against at all.
 */
export function onTimeTone(rate: number | null): Tone {
  if (rate === null) return 'neutral';
  if (rate >= 0.95) return 'success';
  if (rate >= 0.85) return 'info';
  if (rate >= 0.7) return 'warning';
  return 'danger';
}

export function fillRateTone(rate: number | null): Tone {
  if (rate === null) return 'neutral';
  if (rate >= 0.98) return 'success';
  if (rate >= 0.9) return 'info';
  if (rate >= 0.8) return 'warning';
  return 'danger';
}

/** Overcharging is the only direction that is bad news. A supplier who invoices
 *  BELOW the agreed price has not done anything wrong. */
export function priceVarianceTone(pct: number | null): Tone {
  if (pct === null) return 'neutral';
  if (pct <= 0) return 'success';
  if (pct < 1) return 'info';
  if (pct < 5) return 'warning';
  return 'danger';
}

export function damageTone(rate: number | null): Tone {
  if (rate === null) return 'neutral';
  if (rate === 0) return 'success';
  if (rate < 0.01) return 'info';
  if (rate < 0.05) return 'warning';
  return 'danger';
}

/** How overdue an order is, as a colour. A day late is a nudge; a fortnight is
 *  a supply problem. */
export function latenessTone(daysLate: number): Tone {
  if (daysLate >= 14) return 'danger';
  if (daysLate >= 3) return 'warning';
  return 'info';
}

/** What a score stands on, said plainly. Four components is a scorecard; two is
 *  a partial view, and the screen must not let the letter hide that. */
export function componentsLabel(scoredComponents: number): string {
  switch (scoredComponents) {
    case 0:
      return 'nothing measurable yet';
    case 1:
      return 'one measure only';
    case 4:
      return 'all four measures';
    default:
      return `${scoredComponents} of four measures`;
  }
}
