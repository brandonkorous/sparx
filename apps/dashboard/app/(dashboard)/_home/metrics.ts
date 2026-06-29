import type { SparxModule, ValueFormat } from '@sparx/ui';

// The metrics the main "Performance" panel can plot, one at a time, with a
// previous-period overlay. Each maps to a real timeseries endpoint (resolved in
// data.ts) and carries its own module hue + value format. The set shown in the
// switcher is filtered to the tenant's ACTIVE modules — a CMS-only tenant sees
// Visitors/Pageviews, never Revenue. Shared by the server page (to build the
// series) and the client switcher (to render the tabs), so it lives in a
// non-client module.

export interface PerfMetric {
  key: string;
  label: string;
  /** Sub-label shown under the headline number in the panel. */
  caption: string;
  format: ValueFormat;
  /** Hue + the module that must be active for this metric to appear. */
  module: SparxModule;
}

export const PERF_METRICS: [PerfMetric, ...PerfMetric[]] = [
  {
    key: 'revenue',
    label: 'Revenue',
    caption: 'Net revenue',
    format: 'currency',
    module: 'commerce',
  },
  {
    key: 'orders',
    label: 'Orders',
    caption: 'Orders placed',
    format: 'number',
    module: 'commerce',
  },
  {
    key: 'visitors',
    label: 'Visitors',
    caption: 'Unique visitors',
    format: 'number',
    module: 'builder',
  },
  {
    key: 'pageviews',
    label: 'Pageviews',
    caption: 'Total pageviews',
    format: 'number',
    module: 'builder',
  },
  {
    key: 'subscribers',
    label: 'Subscribers',
    caption: 'Net new subscribers',
    format: 'number',
    module: 'email',
  },
];

export const DEFAULT_METRIC = 'revenue';

/** The metrics available to a tenant, given which modules are active. Falls back
 *  to visitors-led order when commerce is off so a content tenant still leads
 *  with a meaningful trend. */
export function availableMetrics(activeModules: ReadonlySet<string>): PerfMetric[] {
  const list = PERF_METRICS.filter((m) => activeModules.has(m.module));
  return list.length > 0 ? list : PERF_METRICS.filter((m) => m.module === 'builder');
}

/** Resolve the requested metric to one that's actually available, else the first
 *  available (commerce-led when present). */
export function resolveMetric(requested: string | undefined, available: PerfMetric[]): PerfMetric {
  const match = available.find((m) => m.key === requested);
  if (match) return match;
  return available[0] ?? PERF_METRICS[0];
}
