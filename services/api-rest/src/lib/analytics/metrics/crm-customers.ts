// Customers metrics — the CRM dashboard's measures (docs/129 §8).
//
// Leads and tasks delegate to the CRM `reportingService` (the same functions MCP
// and GraphQL already call). New-customers-over-time is the one measure the
// service doesn't yet offer at an arbitrary grain — `acquisitionByMonth` is
// month-only — so it is aggregated here with a single grouped query; this is the
// kind of light aggregation that should migrate into `reportingService` when the
// route-collapse of docs/130 §1.4 reaches CRM.
//
// CRM figures are tenant-scoped today, so this is a whole-business dashboard.

import { reportingService } from '@sparx/crm';
import type { TxClient } from '@sparx/db';
import {
  startOfUtcDay,
  utcDateKey,
  eachUtcDay,
  bucketStartFor,
} from '../../site-analytics-reports.js';
import type {
  Grain,
  MetricContext,
  MetricData,
  MetricDefinition,
  TimeseriesPoint,
} from '../types.js';

const ALL_GRAINS = ['day', 'week', 'month'] as const;

function svc(ctx: MetricContext, tx: TxClient) {
  return { tenantId: ctx.tenantId, tx };
}

// A source's plain-language name for the leads donut.
const SOURCE_LABEL: Record<string, string> = {
  storefront: 'Your website',
  b2b_portal: 'Wholesale portal',
  direct: 'Direct',
  admin: 'Added by your team',
  import: 'Imported',
  subscription: 'Subscriptions',
  mcp: 'AI assistant',
};

function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] ?? source;
}

/** New customers per UTC day in the window, keyed `YYYY-MM-DD`. RLS scopes the
 *  raw read to the tenant via the enclosing reporting transaction. */
async function newCustomersByDay(ctx: MetricContext, tx: TxClient): Promise<Map<string, number>> {
  const { from, toExclusive } = ctx.range;
  const rows = await tx.$queryRaw<{ bucket: Date; c: number }[]>`
    SELECT (created_at AT TIME ZONE 'UTC')::date AS bucket, COUNT(*)::int AS c
    FROM customers
    WHERE deleted_at IS NULL
      AND created_at >= ${from} AND created_at < ${toExclusive}
    GROUP BY 1 ORDER BY 1
  `;
  const map = new Map<string, number>();
  for (const r of rows) map.set(utcDateKey(startOfUtcDay(new Date(r.bucket))), Number(r.c));
  return map;
}

/** Fill every day in the window (zeros included), then roll up to the grain. */
function seriesFromDaily(
  byDay: Map<string, number>,
  from: Date,
  to: Date,
  grain: Grain
): { points: TimeseriesPoint[]; daily: number[]; total: number } {
  const daily = eachUtcDay(from, to).map((d) => ({
    bucket: utcDateKey(d),
    value: byDay.get(utcDateKey(d)) ?? 0,
  }));
  const total = daily.reduce((sum, p) => sum + p.value, 0);

  let rolled = daily;
  if (grain !== 'day') {
    const map = new Map<string, number>();
    for (const p of daily) {
      const key = bucketStartFor(p.bucket, grain);
      map.set(key, (map.get(key) ?? 0) + p.value);
    }
    rolled = [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([bucket, value]) => ({ bucket, value }));
  }

  return {
    points: rolled.map((p) => ({ bucket: p.bucket, new: p.value })),
    daily: daily.map((p) => p.value),
    total,
  };
}

export const CRM_CUSTOMERS_METRICS: readonly MetricDefinition[] = [
  {
    id: 'crm.customers.new',
    module: 'crm',
    label: 'New customers',
    unit: 'count',
    grains: ALL_GRAINS,
    shapes: ['kpi', 'timeseries', 'scalar'],
    additive: true,
    scope: 'tenant',
    async resolve(ctx): Promise<MetricData> {
      const byDay = await ctx.run((tx) => newCustomersByDay(ctx, tx));
      const { points, daily, total } = seriesFromDaily(
        byDay,
        ctx.range.from,
        ctx.range.to,
        ctx.range.grain
      );
      if (ctx.shape === 'timeseries') {
        return { grain: ctx.range.grain, series: [{ key: 'new', label: 'New customers' }], points };
      }
      return { value: total, spark: ctx.shape === 'kpi' ? daily : undefined };
    },
  },
  {
    id: 'crm.tasks.open',
    module: 'crm',
    label: 'Open tasks',
    unit: 'count',
    grains: ALL_GRAINS,
    shapes: ['kpi', 'scalar'],
    // A point-in-time count — "how many are open right now", not a windowed sum.
    additive: false,
    scope: 'tenant',
    async resolve(ctx): Promise<MetricData> {
      const metrics = await ctx.run((tx) => reportingService.taskMetrics(svc(ctx, tx)));
      return { value: metrics.open };
    },
  },
  {
    id: 'crm.tasks.overdue',
    module: 'crm',
    label: 'Overdue tasks',
    unit: 'count',
    grains: ALL_GRAINS,
    shapes: ['kpi', 'scalar'],
    additive: false,
    scope: 'tenant',
    async resolve(ctx): Promise<MetricData> {
      const metrics = await ctx.run((tx) => reportingService.taskMetrics(svc(ctx, tx)));
      return { value: metrics.overdue };
    },
  },
  {
    id: 'crm.leads.by_source',
    module: 'crm',
    label: 'Where customers came from',
    unit: 'count',
    grains: ALL_GRAINS,
    shapes: ['breakdown'],
    additive: true,
    scope: 'tenant',
    async resolve(ctx): Promise<MetricData> {
      const leads = await ctx.run((tx) =>
        reportingService.leadsBySource(svc(ctx, tx), {
          range: { from: ctx.range.from.toISOString(), to: ctx.range.to.toISOString() },
        })
      );
      const rows = ctx.limit ? leads.bySource.slice(0, ctx.limit) : leads.bySource;
      return {
        rows: rows.map((r) => ({
          // The service already resolves a friendly label; fall back to our own
          // map, then the raw source key.
          key: r.source,
          label: r.label || sourceLabel(r.source),
          value: r.count,
          sharePct: r.sharePct,
        })),
      };
    },
  },
];
