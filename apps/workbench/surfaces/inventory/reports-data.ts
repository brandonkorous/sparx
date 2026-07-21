'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE INVENTORY REPORTING DATA LAYER
//
// The Reports surface asks three business questions and this file answers each
// with ONE server read — never by loading rows and doing the sums in the
// browser. The arithmetic behind "what is my stock worth", "what is sitting
// still" and "how fast does it turn over" is done in the database against the
// master stock model + the movement ledger, so every figure reconciles exactly
// to what the operational Stock surfaces show.
//
//   GET /v1/inventory/reports/summary        → valuation + stock-health counts
//                                              + value-by-location + feed health
//   GET /v1/inventory/reports/turnover       → COGS / turns / days-of-stock over
//                                              a date range (server-side window)
//   GET /v1/inventory/reports/aging          → how long stock has sat unsold,
//                                              bucketed, + the priciest dead items
//
// The date range (turnover) and the location (ageing) are SERVER params. A
// report is a question about ALL of your stock, so narrowing it in the browser
// would answer it about the handful of rows that happened to load.
//
// Shared shop-language helpers (formatCents, plural, Tone) come from ./data —
// this module owns only the reporting shapes and their own plain-words maps.
// ══════════════════════════════════════════════════════════════════════════

import { useQuery } from '@sparx/query';
import { api } from '../../lib/api/client';
import type { Tone } from './data';

/* ── Shapes (mirror the report route responses exactly) ──────────────────── */

/** What everything on hand is worth, at what it cost you and at what it sells for. */
export interface ValuationSummary {
  totalUnits: number;
  totalAllocated: number;
  totalAvailable: number;
  totalCostCents: number;
  totalRetailCents: number;
  currency: string;
}

/** How many of your products look healthy, thin, or sold out — counted over
 *  what a shopper can actually buy, not raw on-hand. */
export interface StockStatusSummary {
  skuCount: number;
  outOfStock: number;
  lowStock: number;
  healthy: number;
}

/** One place's share of the total: how much is kept there. */
export interface LocationValue {
  warehouseId: string;
  name: string;
  type: string;
  skuCount: number;
  onHand: number;
  available: number;
}

/** How your connected stock feeds are doing, in one line. */
export interface SourcesHealth {
  total: number;
  active: number;
  paused: number;
  error: number;
  lastSyncAt: string | null;
}

/** One product/place that needs attention on the overview. */
export interface LowOrOutItem {
  variantId: string;
  warehouseId: string;
  sku: string;
  title: string;
  location: string;
  onHand: number;
  available: number;
  status: 'out' | 'low';
}

export interface InventorySummary {
  valuation: ValuationSummary;
  stockStatus: StockStatusSummary;
  byLocation: LocationValue[];
  sources: SourcesHealth;
  lowOrOut: LowOrOutItem[];
  lowStockThreshold: number;
}

/** How fast stock sells through, over a chosen window. */
export interface TurnoverReport {
  range: { from: string; to: string };
  periodDays: number;
  /** What the goods you sold in the window had cost you. */
  cogsCents: number;
  unitsSold: number;
  /** The average value tied up in stock across the window. */
  avgInventoryValueCents: number;
  /** Times the whole of your stock sold through, over the window. */
  turnover: number;
  /** The same, scaled to a full year — "sells through N times a year". */
  turnoverAnnualized: number;
  /** How many days of stock you hold at that selling rate. Null when nothing
   *  sold, because you cannot divide by a standstill. */
  daysInventoryOutstanding: number | null;
}

export type AgingBucketKey = '0-30' | '31-60' | '61-90' | '90+' | 'never';

/** One age band: how many levels, units and pounds of stock last sold that long
 *  ago (or never). */
export interface AgingBucket {
  bucket: AgingBucketKey;
  levels: number;
  units: number;
  costCents: number;
}

/** One product sitting still — the money in it and how long since it last sold. */
export interface DeadStockItem {
  variantId: string;
  warehouseId: string;
  sku: string | null;
  title: string | null;
  warehouseCode: string;
  onHand: number;
  costCents: number;
  lastSaleAt: string | null;
  daysSinceLastSale: number | null;
}

export interface AgingReport {
  deadStockDays: number;
  buckets: AgingBucket[];
  deadStock: DeadStockItem[];
}

/* ── Date range for the turnover window ──────────────────────────────────── */

/**
 * How far back to measure "how fast does it sell". Kept as a small set of plain
 * choices rather than a free date picker: an owner asks "this month" or "this
 * quarter", not "the 3rd to the 27th", and every extra control on a report is
 * one more thing between them and the number.
 */
export interface RangePreset {
  days: number;
  label: string;
}

export const RANGE_PRESETS: RangePreset[] = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
  { days: 365, label: 'Last 12 months' },
];

/** The from/to the turnover endpoint wants, worked out from a preset's length.
 *  `to` is now, so the window always ends today. */
export function rangeForDays(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

/* ── Query keys ──────────────────────────────────────────────────────────── */

export const reportKeys = {
  all: ['inventory', 'reports'] as const,
  summary: () => [...reportKeys.all, 'summary'] as const,
  turnover: (range: { from: string; to: string }) =>
    [...reportKeys.all, 'turnover', range] as const,
  aging: (filter: { warehouseId: string; deadStockDays: number }) =>
    [...reportKeys.all, 'aging', filter] as const,
};

/* ── Reads ───────────────────────────────────────────────────────────────── */

/** The headline: valuation, stock health, value by location, feed health. */
export function useInventorySummary() {
  return useQuery({
    queryKey: reportKeys.summary(),
    queryFn: () => api.get<InventorySummary>('/v1/inventory/reports/summary'),
  });
}

/**
 * Turnover over the chosen window.
 *
 * `placeholderData` keeps the last window on screen while a longer one loads, so
 * switching "Last 30 days" to "Last 90 days" does not blink the whole card out
 * to a spinner and back.
 */
export function useTurnoverReport(range: { from: string; to: string }) {
  return useQuery({
    queryKey: reportKeys.turnover(range),
    queryFn: () =>
      api.get<TurnoverReport>('/v1/inventory/reports/turnover', {
        from: range.from,
        to: range.to,
      }),
    placeholderData: (previous) => previous,
  });
}

/**
 * Ageing + the priciest dead stock, optionally at one location.
 *
 * `deadStockDays` sets what counts as "sitting still"; the location narrows both
 * the buckets and the dead-stock list to one place, which is a real question —
 * "which of my shops is holding money it isn't turning". `take` caps the list to
 * the worst offenders by value, because the point is the ten that matter, not
 * every dusty line.
 */
export function useAgingReport(filter: { warehouseId: string; deadStockDays: number }) {
  return useQuery({
    queryKey: reportKeys.aging(filter),
    queryFn: () =>
      api.get<AgingReport>('/v1/inventory/reports/aging', {
        ...(filter.warehouseId ? { warehouse_id: filter.warehouseId } : {}),
        dead_stock_days: filter.deadStockDays,
        take: 10,
      }),
    placeholderData: (previous) => previous,
  });
}

/* ── Saying what the numbers mean, in shop words ─────────────────────────── */

/** The money sitting in stock that has not sold in the dead-stock window — the
 *  '90+' and 'never' bands totalled. Computed from the full buckets (not the
 *  capped list) so the headline figure is the real total. */
export function deadStockValueCents(report: AgingReport): number {
  return report.buckets
    .filter((b) => b.bucket === '90+' || b.bucket === 'never')
    .reduce((sum, b) => sum + b.costCents, 0);
}

/** How many product/place levels are in that dead-stock money. */
export function deadStockLevelCount(report: AgingReport): number {
  return report.buckets
    .filter((b) => b.bucket === '90+' || b.bucket === 'never')
    .reduce((sum, b) => sum + b.levels, 0);
}

/** An age band said the way an owner would say it. */
export function agingBucketLabel(bucket: AgingBucketKey): string {
  switch (bucket) {
    case '0-30':
      return 'Sold in the last month';
    case '31-60':
      return 'Last sold 1–2 months ago';
    case '61-90':
      return 'Last sold 2–3 months ago';
    case '90+':
      return 'Not sold in over 3 months';
    case 'never':
      return 'Never sold';
  }
}

/** Older stock is money working less hard, so the bands warm from calm to
 *  alarming as they age. */
export function agingBucketTone(bucket: AgingBucketKey): Tone {
  switch (bucket) {
    case '0-30':
      return 'success';
    case '31-60':
      return 'info';
    case '61-90':
      return 'warning';
    case '90+':
    case 'never':
      return 'danger';
  }
}

/**
 * How fast the whole of your stock turns over, in a sentence.
 *
 * Turnover annualized is a bare ratio nobody outside a finance team reads
 * fluently, so it is paired with what it MEANS: how many days of stock that pace
 * implies. A standstill (nothing sold) is its own answer, not a zero.
 */
export function turnoverHeadline(report: TurnoverReport): { value: string; meaning: string } {
  if (report.unitsSold === 0) {
    return {
      value: 'None sold',
      meaning: 'Nothing sold in this period, so there is no selling pace to measure yet.',
    };
  }
  const times = report.turnoverAnnualized;
  const value = times >= 10 ? `${Math.round(times)}×` : `${times.toFixed(1)}×`;
  const meaning =
    report.daysInventoryOutstanding === null
      ? 'How many times a year your stock sells through at this pace.'
      : `About ${String(report.daysInventoryOutstanding)} days of stock on hand at this selling pace.`;
  return { value, meaning };
}
