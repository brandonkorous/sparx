// Default dashboards, as data (docs/129 §6, §8, §9).
//
// A dashboard is a config object — a list of tile specs rendered by one generic
// renderer — NOT a hand-written component with tiles in its markup. That is the
// whole of what "build it as if it might be customised" means in practice: when
// user-authored dashboards arrive they move this same shape into a table, and the
// pane, its descriptor and saved workspaces need no change (docs/129 §9).
//
// Addressed by a built-in slug today; the slug slot later holds a UUID for a
// user's own dashboard. Metric ids are permanent (docs/129 §4), so a dashboard
// saved against v1 still resolves later.

import type { ModuleSlug } from '@wizeworks/auth';
import type { TileShape } from './types.js';

/** One tile: a QUESTION answered by a metric, in a given shape. */
export interface DashboardTile {
  metric: string;
  shape: TileShape;
  /** The question, not the metric name — "Most-read pages", not "top_pages". */
  title: string;
  /** A number with no baseline is not an answer — scalars usually compare. */
  compare?: 'previous_period';
  /** Grid columns at the widest container size (the grid is 4 wide). `4` is the
   *  full-width hero. */
  span?: 1 | 2 | 3 | 4;
  /** Row cap for breakdown/list shapes. */
  limit?: number;
  /**
   * Where this tile clicks through to — a workbench surface key and optional
   * params (docs/129 §6). The renderer merges any per-row `drillParams` on top,
   * so "12 unpaid" opens the invoice list already filtered. The differentiating
   * feature: a dashboard is the front door of the app, not a weekly report.
   */
  drill?: { surface: string; params?: Record<string, string> };
  /**
   * What a new tenant sees. The zero state is the state most likely to be seen by
   * someone deciding whether to stay (docs/129 §6), so it says what will make data
   * appear rather than drawing an empty chart.
   */
  emptyHint?: string;
  /** The word under a donut's centre total (e.g. "visits", "revenue"). */
  centerLabel?: string;
}

export interface DashboardConfig {
  /** Built-in slug today; a UUID slot for user dashboards later. */
  id: string;
  /** The owning module — drives the pane's accent hue and gates the dashboard. */
  module: ModuleSlug;
  title: string;
  /** One plain-English line describing what the screen answers. */
  description: string;
  /**
   * Whether the dashboard reads per-site figures (`property`) or describes the
   * whole business (`tenant`). A `property` dashboard is opened for a site.
   */
  scope: 'tenant' | 'property';
  /**
   * Present for every tenant regardless of which modules are on (docs/129 §8) —
   * the cross-module "Business" default. Others appear only where their module is
   * active.
   */
  alwaysAvailable?: boolean;
  tiles: readonly DashboardTile[];
}

/**
 * Traffic — the most complete default we can ship today and the only fully
 * property-scoped set (docs/129 §8, §10). Visitors and pageviews over time · where
 * visits came from · most-read pages · site speed. Every tile's data already
 * exists and is site-scoped, so this needs no migration.
 */
const TRAFFIC_DASHBOARD: DashboardConfig = {
  id: 'traffic',
  module: 'builder',
  title: 'Traffic',
  description: 'How busy your site has been, where people came from, and what they read.',
  scope: 'property',
  tiles: [
    // The KPI strip — each a number, its period-over-period delta, and an inline
    // trend. The renderer collects every `kpi` tile into one dense row.
    {
      metric: 'builder.traffic.visitors',
      shape: 'kpi',
      title: 'Visitors',
      compare: 'previous_period',
      emptyHint: 'Counts appear as soon as people start arriving.',
    },
    {
      metric: 'builder.traffic.pageviews',
      shape: 'kpi',
      title: 'Page views',
      compare: 'previous_period',
    },
    {
      metric: 'builder.traffic.sessions',
      shape: 'kpi',
      title: 'Visits',
      compare: 'previous_period',
    },
    {
      metric: 'builder.traffic.pages_per_visit',
      shape: 'kpi',
      title: 'Pages per visit',
      compare: 'previous_period',
    },
    {
      metric: 'builder.traffic.avg_load',
      shape: 'kpi',
      title: 'Avg. load time',
      compare: 'previous_period',
      emptyHint: 'Speed needs a few real visits to measure.',
    },
    // The hero — visitors and page views over time, full width.
    {
      metric: 'builder.traffic.overview',
      shape: 'timeseries',
      title: 'Visitors and page views over time',
      span: 4,
      emptyHint: 'Each day’s figures show here once the first visitors arrive.',
    },
    {
      metric: 'builder.traffic.sources',
      shape: 'breakdown',
      title: 'Where visits came from',
      span: 2,
      limit: 6,
      centerLabel: 'visits',
      emptyHint:
        'Once people find your site, this shows whether they came from search, social, or a link.',
    },
    {
      metric: 'builder.traffic.top_pages',
      shape: 'list',
      title: 'Most-read pages',
      span: 2,
      limit: 10,
      emptyHint: 'Your busiest pages will be listed here.',
    },
  ],
};

/**
 * Sales — the commerce default (docs/129 §8). Is business up or down · how many
 * orders · what's selling · where the sales came from. Tenant-scoped: commerce
 * revenue is not yet in a per-site rollup (docs/130 §2.4), so this reads across
 * the whole business.
 */
const SALES_DASHBOARD: DashboardConfig = {
  id: 'sales',
  module: 'commerce',
  title: 'Sales',
  description:
    'How selling is going across your whole business — money in, orders, and what’s selling.',
  scope: 'tenant',
  tiles: [
    {
      metric: 'commerce.revenue.net',
      shape: 'kpi',
      title: 'Revenue',
      compare: 'previous_period',
      emptyHint: 'Your revenue shows here after your first sale.',
    },
    {
      metric: 'commerce.orders.count',
      shape: 'kpi',
      title: 'Orders',
      compare: 'previous_period',
    },
    {
      metric: 'commerce.orders.aov',
      shape: 'kpi',
      title: 'Average order',
      compare: 'previous_period',
    },
    {
      metric: 'commerce.revenue.net',
      shape: 'timeseries',
      title: 'Revenue over time',
      span: 4,
      emptyHint: 'Each period’s revenue shows here once orders start coming in.',
    },
    {
      metric: 'commerce.revenue.by_channel',
      shape: 'breakdown',
      title: 'Where sales came from',
      span: 2,
      limit: 6,
      centerLabel: 'revenue',
      emptyHint: 'Your sales split by how the order was placed.',
    },
    {
      metric: 'commerce.revenue.by_attribution',
      shape: 'breakdown',
      title: 'What brings in sales',
      span: 2,
      limit: 6,
      centerLabel: 'revenue',
      emptyHint:
        'Your sales split by what brought the buyer to your site — search, social, or a link. Sales placed before this was switched on, and any without a matching same-day visit, show as “Unattributed”.',
    },
    {
      metric: 'commerce.products.top',
      shape: 'list',
      title: 'Best sellers',
      span: 2,
      limit: 10,
      drill: { surface: 'commerce.product.detail' },
      emptyHint: 'Your top products by revenue will be listed here.',
    },
  ],
};

/**
 * Customers — the CRM default (docs/129 §8). New customers over time · where they
 * came from · what needs doing. Tenant-scoped.
 */
const CUSTOMERS_DASHBOARD: DashboardConfig = {
  id: 'customers',
  module: 'crm',
  title: 'Customers',
  description: 'Who’s coming in, where they came from, and what needs your attention.',
  scope: 'tenant',
  tiles: [
    {
      metric: 'crm.customers.new',
      shape: 'kpi',
      title: 'New customers',
      compare: 'previous_period',
      emptyHint: 'New customers show here as they’re added.',
    },
    {
      metric: 'crm.tasks.open',
      shape: 'kpi',
      title: 'Open tasks',
    },
    {
      metric: 'crm.tasks.overdue',
      shape: 'kpi',
      title: 'Overdue tasks',
    },
    {
      metric: 'crm.customers.new',
      shape: 'timeseries',
      title: 'New customers over time',
      span: 4,
      emptyHint: 'Each period’s new customers show here as they’re added.',
    },
    {
      metric: 'crm.leads.by_source',
      shape: 'breakdown',
      title: 'Where customers came from',
      span: 2,
      limit: 6,
      centerLabel: 'customers',
      emptyHint: 'Your customers split by how they first reached you.',
    },
  ],
};

const DASHBOARDS: readonly DashboardConfig[] = [
  TRAFFIC_DASHBOARD,
  SALES_DASHBOARD,
  CUSTOMERS_DASHBOARD,
];

const BY_ID = new Map(DASHBOARDS.map((d) => [d.id, d]));

/** Every built-in dashboard, unfiltered. */
export function listDashboards(): readonly DashboardConfig[] {
  return DASHBOARDS;
}

export function getDashboard(id: string): DashboardConfig | undefined {
  return BY_ID.get(id);
}

/** A dashboard is offered when its module is active, or always for the
 *  cross-module Business default. */
export function isDashboardAvailable(
  dashboard: DashboardConfig,
  enabled: ReadonlySet<string>
): boolean {
  return dashboard.alwaysAvailable === true || enabled.has(dashboard.module);
}
