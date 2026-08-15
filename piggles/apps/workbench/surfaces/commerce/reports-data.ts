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

import { useQuery } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
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
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
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

const CHANNEL_LABEL: Record<string, string> = {
  storefront: 'Your website',
  b2b_portal: 'Wholesale portal',
  admin: 'Added by your team',
  subscription: 'Subscriptions',
  mcp: 'AI assistant',
  import: 'Imported',
  // Not a Piggles channel — see the note in surfaces/commerce/data.ts.
  sparx_market: 'Marketplace',
  marketplace: 'Marketplaces',
  unknown: 'Other',
};

/** A sales channel's plain-language name — a shop owner does not know "b2b_portal". */
export function channelLabel(channel: string): string {
  return CHANNEL_LABEL[channel] ?? channel;
}
