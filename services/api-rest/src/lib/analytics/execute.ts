// The batch query executor — the whole of `POST /v1/analytics/query`'s work.
//
// One request resolves a dashboard's whole metric list (docs/129 §5), with the
// properties that make dashboards safe to open by the dozen:
//
//   • PARTIAL SUCCESS. Every result carries its own status, so one failing metric
//     renders one broken tile and never an empty dashboard.
//   • PER-METRIC MODULE GATING. A metric whose module is off comes back
//     `unavailable` for that key, not a 403 for the whole request.
//   • BOUNDED CONCURRENCY on the reporting runner (its own connections + a
//     statement timeout), so a slow report degrades reporting only.
//   • A SHORT-TTL CACHE, so overlapping dashboards share work.
//
// The caller (the route) enforces the hard cap on metrics-per-request and
// resolves the site; this function assumes both are done.

import { isModuleEnabled, type ModuleSlug } from '@sparx/auth';

import { cacheGet, cacheSet, metricCacheKey } from './cache.js';
import { ensureMetricsRegistered } from './metrics/index.js';
import { previousRange, type ResolvedRange } from './range.js';
import { getMetric } from './registry.js';
import { makeReportingRunner, mapBounded } from './reporting.js';
import type {
  MetricContext,
  MetricData,
  MetricDefinition,
  MetricRequest,
  MetricResultEnvelope,
  ScalarData,
} from './types.js';

export interface ExecuteInput {
  tenantId: string;
  /** The resolved site, or null for a whole-business dashboard. */
  propertyId: string | null;
  range: ResolvedRange;
  metrics: readonly MetricRequest[];
}

export async function executeQuery(input: ExecuteInput): Promise<MetricResultEnvelope[]> {
  ensureMetricsRegistered();
  const { tenantId, propertyId, range } = input;
  const run = makeReportingRunner(tenantId);

  // One module check per module per request, deduped — several tiles usually
  // share a module.
  const moduleChecks = new Map<ModuleSlug, Promise<boolean>>();
  const moduleEnabled = (module: ModuleSlug): Promise<boolean> => {
    let pending = moduleChecks.get(module);
    if (!pending) {
      pending = isModuleEnabled(tenantId, module);
      moduleChecks.set(module, pending);
    }
    return pending;
  };

  // Resolve one metric's data, going through the cache. Historical windows are
  // immutable, so a hit is common and correct; the open bucket ages out on TTL.
  async function resolveData(
    def: MetricDefinition,
    ctx: MetricContext,
    resolveRangeFor: ResolvedRange
  ): Promise<MetricData> {
    const key = metricCacheKey({
      tenantId,
      propertyId,
      metric: def.id,
      shape: ctx.shape,
      fromISO: resolveRangeFor.from.toISOString(),
      toExclusiveISO: resolveRangeFor.toExclusive.toISOString(),
      grain: resolveRangeFor.grain,
      limit: ctx.limit,
    });
    const cached = await cacheGet<MetricData>(key);
    if (cached) return cached;
    const data = await def.resolve(ctx);
    await cacheSet(key, data);
    return data;
  }

  async function resolveOne(req: MetricRequest): Promise<MetricResultEnvelope> {
    const base = { key: req.key, metric: req.metric, shape: req.shape };
    const def = getMetric(req.metric);
    if (!def) {
      return { ...base, status: 'unknown_metric', message: 'This measure is not available.' };
    }

    const labelled = { ...base, unit: def.unit, label: def.label };

    if (!def.shapes.includes(req.shape)) {
      return {
        ...labelled,
        status: 'error',
        message: `This measure can’t be shown as a ${req.shape}.`,
      };
    }
    if (req.shape === 'timeseries' && !def.grains.includes(range.grain)) {
      return {
        ...labelled,
        status: 'error',
        message: `This measure isn’t available by ${range.grain}.`,
      };
    }
    if (!(await moduleEnabled(def.module))) {
      return {
        ...labelled,
        status: 'unavailable',
        message: 'That part of the platform isn’t switched on for this account.',
      };
    }
    if (def.scope === 'property' && propertyId === null) {
      return {
        ...labelled,
        status: 'unavailable',
        message: 'This is a per-site figure — choose a site to see it.',
      };
    }

    try {
      const ctx: MetricContext = {
        tenantId,
        propertyId,
        range,
        shape: req.shape,
        limit: req.limit,
        run,
      };
      const data = await resolveData(def, ctx, range);

      // A baseline for a headline number (docs/129 §6). Scalars and KPIs compare —
      // "up or down since last period" is a single-number question, and both
      // shapes carry a `.value`. Additive or not, the previous window is resolved
      // the same way the current one is.
      let compare: MetricResultEnvelope['compare'];
      if (req.compare === 'previous_period' && (req.shape === 'scalar' || req.shape === 'kpi')) {
        const prevRange = previousRange(range);
        const prevData = await resolveData(def, { ...ctx, range: prevRange }, prevRange);
        const previous = (prevData as ScalarData).value;
        const current = (data as ScalarData).value;
        compare = {
          previous,
          deltaPct: previous === 0 ? null : Math.round(((current - previous) / previous) * 100),
        };
      }

      return {
        ...labelled,
        status: 'ok',
        additive: def.additive,
        scope: def.scope,
        data,
        compare,
      };
    } catch {
      // A resolver threw (a timeout, a bad query) — one broken tile, never a
      // broken dashboard. The reason is deliberately generic to the client; the
      // detail is on the server logs.
      return {
        ...labelled,
        status: 'error',
        message: 'Couldn’t load this figure just now.',
      };
    }
  }

  return mapBounded(input.metrics, resolveOne);
}
