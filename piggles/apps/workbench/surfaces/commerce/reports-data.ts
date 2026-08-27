'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE REPORTS DATA LAYER
//
// Reports show how selling is going: revenue over a period, revenue day by day,
// the best sellers, and where the sales came from. Every figure is read-only and
// comes from api-rest's reportingService, which computes it live from real
// orders — nothing here is fabricated. Money is integer cents throughout, the
// same as every other commerce figure.
//
// The window is a from/to pair (ISO). The endpoints default to the last 30 days
// when both are omitted; this layer always sends an explicit window so the
// on-screen range label and the figures agree.
// ══════════════════════════════════════════════════════════════════════════

import { useQuery } from '@wizeworks/query';
import { apiErrorMessage } from '../../lib/api-error';
import { channelLabel } from '../../lib/console/channels';
import { api } from '../../lib/api/client';

/* ── Shapes (mirror reporting-service.ts) ───────────────────────────────── */

export interface RevenueSummary {
  rangeLabel: string;
  ordersCount: number;
  grossRevenueCents: number;
  refundedCents: number;
  netRevenueCents: number;
  averageOrderValueCents: number;
  currency: string;
}

export interface RevenuePoint {
  bucket: string;
  ordersCount: number;
  grossCents: number;
  discountCents: number;
  refundedCents: number;
  netCents: number;
}

export interface RevenueTimeseries {
  range: { from: string; to: string; grain: string };
  points: RevenuePoint[];
  totals: {
    ordersCount: number;
    grossCents: number;
    discountCents: number;
    refundedCents: number;
    netCents: number;
  };
  currency: string;
}

export interface TopProduct {
  productId: string;
  productTitle: string;
  unitsSold: number;
  revenueCents: number;
}

export interface ChannelRow {
  channel: string;
  orders: number;
  revenueCents: number;
  sharePct: number;
}

export interface ChannelBreakdown {
  rangeLabel: string;
  totalOrders: number;
  totalRevenueCents: number;
  byChannel: ChannelRow[];
  currency: string;
}

/**
 * How many visits became orders.
 *
 * EVERY rate is `number | null`, and null is never 0 (docs/152 A1): a business
 * selling at the counter or over the phone has no web visits at all.
 */
export interface ConversionFunnel {
  rangeLabel: string;
  sessions: number;
  visitors: number;
  cartsCreated: number;
  checkoutsStarted: number;
  ordersPlaced: number;
  sessionToCartRate: number | null;
  cartToCheckoutRate: number | null;
  checkoutToOrderRate: number | null;
  overallConversion: number | null;
  sessionToOrderRate: number | null;
}

/* ── The window ─────────────────────────────────────────────────────────── */

export type RangePreset = '7' | '30' | '90';

export interface Range {
  from: string;
  to: string;
}

/** The from/to pair for a "last N days" preset, anchored to now. */
export function presetRange(preset: RangePreset): Range {
  const to = new Date();
  const from = new Date(to.getTime() - Number(preset) * 24 * 60 * 60_000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export const RANGE_LABEL: Record<RangePreset, string> = {
  '7': 'Last 7 days',
  '30': 'Last 30 days',
  '90': 'Last 90 days',
};

function rangeQuery(range: Range): Record<string, string> {
  return { from: range.from, to: range.to };
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useRevenueSummary(range: Range) {
  return useQuery({
    queryKey: ['commerce', 'reports', 'revenue-summary', range],
    queryFn: () =>
      api.get<RevenueSummary>('/v1/commerce/reports/revenue-summary', rangeQuery(range)),
    placeholderData: (previous) => previous,
  });
}

export function useRevenueTimeseries(range: Range) {
  return useQuery({
    queryKey: ['commerce', 'reports', 'revenue-timeseries', range],
    queryFn: () =>
      api.get<RevenueTimeseries>('/v1/commerce/reports/revenue-timeseries', {
        ...rangeQuery(range),
        grain: 'day',
      }),
    placeholderData: (previous) => previous,
  });
}

export function useTopProducts(range: Range) {
  return useQuery({
    queryKey: ['commerce', 'reports', 'top-products', range],
    queryFn: () =>
      api.get<TopProduct[]>('/v1/commerce/reports/top-products', {
        ...rangeQuery(range),
        limit: 8,
      }),
    placeholderData: (previous) => previous,
  });
}

export function useConversionFunnel(range: Range) {
  return useQuery({
    queryKey: ['commerce', 'reports', 'conversion-funnel', range],
    queryFn: () =>
      api.get<ConversionFunnel>('/v1/commerce/reports/conversion-funnel', rangeQuery(range)),
    placeholderData: (previous) => previous,
  });
}

export function useChannelBreakdown(range: Range) {
  return useQuery({
    queryKey: ['commerce', 'reports', 'channel-breakdown', range],
    queryFn: () =>
      api.get<ChannelBreakdown>('/v1/commerce/reports/channel-breakdown', rangeQuery(range)),
    placeholderData: (previous) => previous,
  });
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

export function reportsErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}

export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}

/** A whole-number money label for a headline figure — no cents on a KPI. */
export function formatCentsRounded(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** A sales channel's plain-language name — a shop owner does not know
 *  "b2b_portal". Re-exported rather than redefined: the report and the order it
 *  is counting must call the same sale the same thing. */
export { channelLabel };
