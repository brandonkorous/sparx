// The metric layer's vocabulary (docs/129 §3).
//
// A metric is declared ONCE — what a dashboard needs to know to render and query
// it safely — and delegates to the existing reporting service that already
// computes it. The registry is a façade over measures that are correct today; it
// does not recompute aggregation, it makes it uniformly addressable.

import type { TxClient } from '@wizeworks/db';
import type { ModuleSlug } from '@wizeworks/modules';
import type { Grain, ResolvedRange } from './range.js';

export type { Grain, ResolvedRange } from './range.js';

/**
 * How a metric can be asked for on a tile.
 *   • `scalar` — a bare number.
 *   • `kpi`    — a number WITH its own inline trend (`spark`) and, via the tile's
 *                `compare`, a period-over-period delta. The headline unit of a
 *                dense dashboard: a figure you can read a direction off at a glance.
 *   • `timeseries` — one or more named series over time, for a real chart.
 *   • `breakdown`  — a categorical split (a donut / share bars).
 *   • `list`       — a ranked table.
 */
export type TileShape = 'scalar' | 'kpi' | 'timeseries' | 'breakdown' | 'list';

/** How a value is formatted — the client picks the right formatter from this. */
export type MetricUnit = 'currency' | 'count' | 'percent' | 'duration' | 'ratio';

/**
 * Whether a per-site figure is even meaningful for this metric (docs/129 §7).
 * `property` metrics resolve against one site; `tenant` metrics describe the
 * whole business and are labelled as such when a per-site dashboard shows them.
 */
export type MetricScope = 'tenant' | 'property';

/* ── Shape payloads ──────────────────────────────────────────────────────── */

export interface ScalarData {
  value: number;
}

/** A headline number plus a glanceable inline trend. `spark` is the raw per-bucket
 *  values (oldest→newest) for a sparkline; omitted when the metric has no series. */
export interface KpiData {
  value: number;
  spark?: number[];
}

/** One named series in a (possibly multi-series) timeseries. */
export interface TimeseriesSeries {
  key: string;
  label: string;
}
export interface TimeseriesPoint {
  /** ISO date (YYYY-MM-DD) — the bucket start. Extra keys are per-series values. */
  bucket: string;
  [seriesKey: string]: string | number;
}
export interface TimeseriesData {
  grain: Grain;
  /** The series carried in each point, in draw order. A single-series metric
   *  ships one entry; the hero overview ships several. */
  series: TimeseriesSeries[];
  points: TimeseriesPoint[];
}

export interface BreakdownRow {
  key: string;
  label: string;
  value: number;
  /** Optional share of the whole, 0–100, when the metric computes one. */
  sharePct?: number;
}
export interface BreakdownData {
  rows: BreakdownRow[];
}

export interface ListRow {
  id: string;
  label: string;
  value: number;
  /** A secondary figure shown alongside the primary (e.g. unique visitors). */
  secondary?: string;
  /** Per-row params merged into a tile's `drill` target — a row that clicks
   *  through to the specific thing it names. */
  drillParams?: Record<string, string>;
}
export interface ListData {
  rows: ListRow[];
}

export type MetricData = ScalarData | KpiData | TimeseriesData | BreakdownData | ListData;

/* ── Resolution ──────────────────────────────────────────────────────────── */

/**
 * Everything a resolver is handed. `run` opens a fresh tenant-scoped reporting
 * transaction (its own connection, with a statement timeout) so resolvers stay
 * genuinely concurrent — see reporting.ts. A resolver either uses the `tx`
 * directly or passes `{ tx }` into a reportingService call to compose onto it.
 */
export interface MetricContext {
  tenantId: string;
  /** The resolved site, or null when the dashboard covers the whole business. */
  propertyId: string | null;
  range: ResolvedRange;
  /** The shape the tile asked for — a metric may compute differently per shape. */
  shape: TileShape;
  /** Row cap for `breakdown`/`list` shapes. */
  limit?: number;
  run: <T>(fn: (tx: TxClient) => Promise<T>) => Promise<T>;
}

/**
 * One registry entry. `id` is a permanent public contract (docs/129 §4):
 * `<module>.<subject>.<measure>`, added and deprecated but NEVER renamed, because
 * user-authored dashboards will reference it.
 */
export interface MetricDefinition {
  id: string;
  /** Gates visibility — hidden (returns `unavailable`) when the module is off. */
  module: ModuleSlug;
  /** Plain-English, business-owner vocabulary. */
  label: string;
  unit: MetricUnit;
  /** Which grains a timeseries of this metric supports. */
  grains: readonly Grain[];
  /** Which tile shapes this metric can answer. */
  shapes: readonly TileShape[];
  /**
   * FALSE for distinct counts (docs/129 §3). A metric that is not additive across
   * time (or across sites) cannot be summed by any caller — a window total must
   * come from the metric's own windowed resolver, which is exactly what the
   * `scalar` shape returns. Summing per-day distinct visitors is wrong and looks
   * right; this flag is what stops it.
   */
  additive: boolean;
  scope: MetricScope;
  resolve(ctx: MetricContext): Promise<MetricData>;
}

/* ── Query wire shapes ───────────────────────────────────────────────────── */

/** One entry in a batch query. */
export interface MetricRequest {
  /** The caller's handle for this result, echoed back so tiles find their data. */
  key: string;
  metric: string;
  shape: TileShape;
  limit?: number;
  compare?: 'previous_period';
}

export type MetricStatus = 'ok' | 'unavailable' | 'unknown_metric' | 'error';

/** What comes back for one requested metric. Each result carries its own status
 *  so one failure renders one broken tile, never an empty dashboard (docs/129 §5). */
export interface MetricResultEnvelope {
  key: string;
  metric: string;
  shape: TileShape;
  status: MetricStatus;
  unit?: MetricUnit;
  label?: string;
  additive?: boolean;
  scope?: MetricScope;
  data?: MetricData;
  /** Present when the tile asked for a baseline and the metric is a scalar. */
  compare?: { previous: number; deltaPct: number | null };
  /** A human-readable reason when status is `unavailable` or `error`. */
  message?: string;
}
