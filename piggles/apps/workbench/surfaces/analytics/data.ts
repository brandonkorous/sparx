'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE ANALYTICS DASHBOARD DATA LAYER
//
// A dashboard is a config object fetched from api-rest (its tiles), and its
// figures come back from ONE batch query (docs/129 §5) — never a request per
// tile. Every figure is read-only and computed live (or from a rollup) by the
// analytics metric registry; nothing here is fabricated.
//
// The shapes mirror wizeworks/services/api-rest/src/lib/analytics/{dashboards,types}.ts.
// The workbench is built self-contained, so these are
// declared here rather than imported across the app boundary — the wire contract
// is the seam.
// ══════════════════════════════════════════════════════════════════════════

import { useQuery } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { api } from '../../lib/api/client';

/* ── Dashboard config (mirrors the server) ──────────────────────────────── */

export type TileShape = 'scalar' | 'kpi' | 'timeseries' | 'breakdown' | 'list';
export type MetricUnit = 'currency' | 'count' | 'percent' | 'duration' | 'ratio';
export type Grain = 'day' | 'week' | 'month';

export interface DashboardSummary {
  id: string;
  module: string;
  title: string;
  description: string;
  scope: 'tenant' | 'property';
}

export interface DashboardTile {
  metric: string;
  shape: TileShape;
  title: string;
  compare?: 'previous_period';
  span?: 1 | 2 | 3 | 4;
  limit?: number;
  drill?: { surface: string; params?: Record<string, string> };
  emptyHint?: string;
  /** The word under a donut's centre total (e.g. "visits", "revenue"). */
  centerLabel?: string;
}

export interface DashboardConfig extends DashboardSummary {
  tiles: DashboardTile[];
}

/* ── Query results (mirrors the server) ─────────────────────────────────── */

export type MetricStatus = 'ok' | 'unavailable' | 'unknown_metric' | 'error';

export interface ScalarData {
  value: number;
}
export interface KpiData {
  value: number;
  spark?: number[];
}
export interface TimeseriesSeries {
  key: string;
  label: string;
}
export interface TimeseriesPoint {
  bucket: string;
  [seriesKey: string]: string | number;
}
export interface TimeseriesData {
  grain: Grain;
  series: TimeseriesSeries[];
  points: TimeseriesPoint[];
}
export interface BreakdownRow {
  key: string;
  label: string;
  value: number;
  sharePct?: number;
}
export interface BreakdownData {
  rows: BreakdownRow[];
}
export interface ListRow {
  id: string;
  label: string;
  value: number;
  secondary?: string;
  drillParams?: Record<string, string>;
}
export interface ListData {
  rows: ListRow[];
}
export type MetricData = ScalarData | KpiData | TimeseriesData | BreakdownData | ListData;

export interface MetricResult {
  key: string;
  metric: string;
  shape: TileShape;
  status: MetricStatus;
  unit?: MetricUnit;
  label?: string;
  additive?: boolean;
  scope?: 'tenant' | 'property';
  data?: MetricData;
  compare?: { previous: number; deltaPct: number | null };
  message?: string;
}

interface QueryResponse {
  range: { from: string; to: string; grain: Grain };
  property: string | null;
  results: MetricResult[];
}

/* ── The window ─────────────────────────────────────────────────────────── */

export type RangePreset = '7' | '30' | '90';

export interface Range {
  from: string;
  to: string;
  grain: Grain;
}

export const RANGE_LABEL: Record<RangePreset, string> = {
  '7': 'Last 7 days',
  '30': 'Last 30 days',
  '90': 'Last 90 days',
};

/** The from/to window for a preset, anchored to now. A 90-day window rolls up to
 *  weekly buckets so the timeseries stays readable rather than a hedge of 90 bars. */
export function presetRange(preset: RangePreset): Range {
  const to = new Date();
  const from = new Date(to.getTime() - Number(preset) * 24 * 60 * 60_000);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    grain: preset === '90' ? 'week' : 'day',
  };
}

/* ── Queries ────────────────────────────────────────────────────────────── */

/** The dashboards available to this tenant — the list surface's rows. */
export function useDashboards() {
  return useQuery({
    queryKey: ['analytics', 'dashboards'],
    queryFn: () => api.get<DashboardSummary[]>('/v1/analytics/dashboards'),
  });
}

/** One dashboard's config (its tiles). Fetched when the pane opens. */
export function useDashboard(id: string) {
  return useQuery({
    queryKey: ['analytics', 'dashboard', id],
    queryFn: () => api.get<DashboardConfig>(`/v1/analytics/dashboards/${id}`),
  });
}

/** A stable per-tile key so each tile finds its own result. Index-based because a
 *  dashboard legitimately shows one metric in two shapes (a scalar and a series). */
export function tileKey(index: number): string {
  return `t${index}`;
}

/**
 * The batch query for a whole dashboard — one request, its own result per tile.
 * The active site rides the `x-sparx-property-id` header the client already
 * attaches, so a property-scoped dashboard follows the site switcher for free.
 */
export function useDashboardQuery(dashboard: DashboardConfig | undefined, range: Range) {
  return useQuery({
    queryKey: ['analytics', 'query', dashboard?.id, range],
    enabled: Boolean(dashboard),
    placeholderData: (previous) => previous,
    queryFn: () =>
      api.post<QueryResponse>('/v1/analytics/query', {
        range,
        metrics: (dashboard?.tiles ?? []).map((tile, index) => ({
          key: tileKey(index),
          metric: tile.metric,
          shape: tile.shape,
          limit: tile.limit,
          compare: tile.compare,
        })),
      }),
  });
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

export function analyticsErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}

export function isModuleDisabled(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'MODULE_DISABLED';
}
