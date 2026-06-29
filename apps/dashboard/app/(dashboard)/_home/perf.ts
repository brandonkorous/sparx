import type { DashboardRange, Grain } from './range';
import { availableMetrics, resolveMetric, type PerfMetric } from './metrics';
import { computeDelta, fmtNumber } from './format';
import { sampleSeries } from './samples';
import type { PerfPanel, PerfPoint, Raw } from './types';

// Builds the hero "Performance" panel: the selected metric's timeseries with a
// previous-period ghost overlay, the period total, and the delta vs previous.
// One metric at a time (the switcher changes ?metric=), each sourced from its
// own real timeseries endpoint; falls back to a badged sample when the tenant
// has no data yet so the centerpiece never renders empty.

function bucketLabel(bucket: string, grain: Grain): string {
  const d = new Date(`${bucket}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return bucket;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    ...(grain === 'month' ? {} : { day: 'numeric' }),
    timeZone: 'UTC',
  });
}

/** Synthetic bucket dates spanning the range, for the sample fallback axis. */
function genBuckets(range: DashboardRange): string[] {
  const step = range.grain === 'month' ? 30 : range.grain === 'week' ? 7 : 1;
  const count =
    range.grain === 'month' ? 12 : range.grain === 'week' ? Math.ceil(range.days / 7) : range.days;
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(range.to.getTime() - i * step * 86_400_000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

interface Source {
  cur: { bucket: string; value: number }[];
  prev: number[];
}

function sourceFor(metricKey: string, raw: Raw): Source {
  switch (metricKey) {
    case 'orders':
      return {
        cur: (raw.revTs?.points ?? []).map((p) => ({ bucket: p.bucket, value: p.ordersCount })),
        prev: (raw.revTsPrev?.points ?? []).map((p) => p.ordersCount),
      };
    case 'visitors':
      return {
        cur: (raw.siteTs?.points ?? []).map((p) => ({ bucket: p.bucket, value: p.visitors })),
        prev: (raw.siteTsPrev?.points ?? []).map((p) => p.visitors),
      };
    case 'pageviews':
      return {
        cur: (raw.siteTs?.points ?? []).map((p) => ({ bucket: p.bucket, value: p.pageviews })),
        prev: (raw.siteTsPrev?.points ?? []).map((p) => p.pageviews),
      };
    case 'subscribers':
      return {
        cur: (raw.growth?.points ?? []).map((p) => ({ bucket: p.bucket, value: p.net })),
        prev: [],
      };
    case 'revenue':
    default:
      return {
        cur: (raw.revTs?.points ?? []).map((p) => ({ bucket: p.bucket, value: p.netCents / 100 })),
        prev: (raw.revTsPrev?.points ?? []).map((p) => p.netCents / 100),
      };
  }
}

function totalLabel(value: number, metric: PerfMetric): string {
  if (metric.format === 'currency') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  }
  return fmtNumber(Math.round(value));
}

export function buildPerf(
  raw: Raw,
  metricKey: string | undefined,
  modules: ReadonlySet<string>,
  range: DashboardRange
): PerfPanel | null {
  const available = availableMetrics(modules);
  if (available.length === 0) return null;
  const metric = resolveMetric(metricKey, available);
  const src = sourceFor(metric.key, raw);

  const live = src.cur.length >= 2;
  let points: PerfPoint[];
  let isSample: boolean;

  if (live) {
    points = src.cur.map((p, i) => ({
      label: bucketLabel(p.bucket, range.grain),
      value: p.value,
      prev: range.compare && src.prev[i] != null ? src.prev[i] : undefined,
    }));
    isSample = false;
  } else {
    const buckets = genBuckets(range);
    const base = metric.format === 'currency' ? 9000 : metric.key === 'orders' ? 40 : 600;
    const sample = sampleSeries(buckets.length, base);
    const samplePrev = sampleSeries(buckets.length, base * 0.85);
    points = buckets.map((b, i) => ({
      label: bucketLabel(b, range.grain),
      value: sample[i] ?? 0,
      prev: range.compare ? (samplePrev[i] ?? 0) : undefined,
    }));
    isSample = true;
  }

  const curTotal = points.reduce((s, p) => s + p.value, 0);
  const prevTotal = points.reduce((s, p) => s + (p.prev ?? 0), 0);
  const delta =
    range.compare && points.some((p) => p.prev != null)
      ? computeDelta(curTotal, prevTotal)
      : undefined;

  return {
    metric,
    available,
    points,
    total: totalLabel(curTotal, metric),
    delta,
    isSample,
  };
}
