import type { SparxModule } from '@sparx/ui';
import type { PerfMetric } from './metrics';
import type { DashboardRange } from './range';

// Raw reporting-endpoint response shapes the command center consumes. These
// mirror the api-rest contracts (docs/97 §7); only the fields the dashboard
// actually reads are declared. Every read is fail-soft (`.catch(() => null)`),
// so each slice is independently nullable.

// ── Commerce ────────────────────────────────────────────────
export interface RevenueSummary {
  rangeLabel: string;
  ordersCount: number;
  grossRevenueCents: number;
  refundedCents: number;
  netRevenueCents: number;
  averageOrderValueCents: number;
  currency: string;
}
export interface RevenueTsPoint {
  bucket: string;
  ordersCount: number;
  grossCents: number;
  netCents: number;
}
export interface RevenueTimeseries {
  range: { from: string; to: string; grain: string };
  points: RevenueTsPoint[];
  totals: { ordersCount: number; netCents: number };
  currency: string;
}
export interface ConversionFunnel {
  rangeLabel: string;
  sessions: number;
  cartsCreated: number;
  checkoutsStarted: number;
  ordersPlaced: number;
  cartToCheckoutRate: number;
  checkoutToOrderRate: number;
  overallConversion: number;
}
export interface AbandonedCarts {
  abandonedCount: number;
  recoveredCount: number;
  recoveryRate: number;
  recoveredRevenueCents: number;
}
export interface SubscriptionMetrics {
  activeCount: number;
  mrrCents: number;
  churnedThisPeriod: number;
  newThisPeriod: number;
  currency: string;
}
export interface TopProductRow {
  productId: string;
  productTitle: string;
  unitsSold: number;
  revenueCents: number;
}
export interface TopCustomerRow {
  customerId: string;
  customerName: string;
  ordersCount: number;
  totalSpentCents: number;
}
export interface ChannelRevenueReport {
  rangeLabel: string;
  totalNetAfterFeesCents: number;
  byChannel: {
    channel: string;
    label: string;
    orders: number;
    netAfterFeesCents: number;
    sharePct: number;
  }[];
  currency: string;
}

// ── Site traffic (builder analytics) ────────────────────────
export interface SiteSummary {
  visitors: number;
  pageviews: number;
  sessions: number;
  signups: number;
  pagesPerVisit: number;
  topReferrerHost: string | null;
  topReferrerVisits: number;
}
export interface SiteTsPoint {
  bucket: string;
  visitors: number;
  pageviews: number;
}
export interface SiteTimeseries {
  range: { from: string; to: string; grain: string };
  points: SiteTsPoint[];
  totals: { visitors: number; pageviews: number };
}
export interface SiteTopPage {
  path: string;
  views: number;
  visitors: number;
}
export interface SiteSourceRow {
  source: string;
  visits: number;
}
export interface SiteVitals {
  load: number | null;
  lcp: number | null;
  cls: number | null;
  samples: number;
}

// ── CRM ─────────────────────────────────────────────────────
export interface CrmSnapshot {
  customers: number;
  b2bAccounts: number;
  openDeals: number;
  pipelineValue: number;
  openTasks: number;
  overdueTasks: number;
  activeSegments: number;
}
export interface AcquisitionPoint {
  month: string;
  newCustomers: number;
}
export interface LeadsBySource {
  rangeLabel: string;
  totalLeads: number;
  bySource: { source: string; label: string; count: number; sharePct: number }[];
}
export interface TaskMetrics {
  open: number;
  overdue: number;
  dueToday: number;
}

// ── Email ───────────────────────────────────────────────────
export interface EmailOverview {
  days: number;
  counts: {
    accepted: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
  };
  recent: { type: string; recipient: string; occurredAt: string; broadcastId: string | null }[];
}
export interface SubscriberGrowthPoint {
  bucket: string;
  added: number;
  removed: number;
  net: number;
}
export interface SubscriberGrowth {
  points: SubscriberGrowthPoint[];
  totals: { added: number; removed: number; net: number };
  currentSubscribers: number;
}

// ── B2B ─────────────────────────────────────────────────────
export interface B2bSummary {
  accounts: { total: number; active: number; creditHold: number };
  openQuotes: number;
  invoices: {
    outstandingCents: number;
    overdueCount: number;
    overdueCents: number;
  };
  approvalQueue: number;
}

// ── Invoicing / finance ─────────────────────────────────────
export interface CollectionsSummary {
  collectedThisMonthCents: number;
  collectedLastMonthCents: number;
  avgDaysToPay: number | null;
  openBalance: {
    invoicedOpenCents: number;
    overdueCents: number;
    overdueCount: number;
  };
  currency: string;
}
export interface CollectedTimeseries {
  points: { bucket: string; collectedCents: number }[];
  totals: { collectedCents: number };
}

// ── Inventory ───────────────────────────────────────────────
export interface InventorySummary {
  valuation: { totalUnits: number; totalCostCents: number; totalRetailCents: number };
  stockStatus: { skuCount: number; outOfStock: number; lowStock: number; healthy: number };
  lowOrOut: {
    variantId: string;
    sku: string;
    title: string;
    location: string;
    available: number;
    status: 'out' | 'low';
  }[];
}

export interface InventoryActivityRow {
  id: string;
  delta: number;
  reason: string;
  createdAt: string;
  sku: string;
  title: string;
  location: string;
}

// ── Dropship ────────────────────────────────────────────────
export interface DropshipTimeseries {
  totals: {
    ordersCount: number;
    revenueCents: number;
    costCents: number;
    profitCents: number;
    marginPct: number;
  };
}

// ── Automations ─────────────────────────────────────────────
export interface RunsTimeseries {
  points: { bucket: string; runsCount: number; completedCount: number; failedCount: number }[];
  totals: { runsCount: number; failedCount: number; successRate: number };
}

// ── Content / CMS ───────────────────────────────────────────
export interface CmsSummary {
  total: number;
  byStatus: { draft: number; scheduled: number; published: number; archived: number };
  publishedLast30d: number;
  scheduledUpcoming: number;
}
export interface CmsCadencePoint {
  bucket: string;
  publishedCount: number;
}
export interface CmsCadence {
  points: CmsCadencePoint[];
  totals: { publishedCount: number };
}
export interface CmsRecentEntry {
  id: string;
  title: string;
  typeName: string;
  status: string;
  author: string | null;
  publishedAt: string | null;
  scheduledAt: string | null;
  updatedAt: string;
}
export interface CmsRecent {
  activity: CmsRecentEntry[];
  published: CmsRecentEntry[];
  upcoming: CmsRecentEntry[];
}
export interface TopContentItem {
  id: string;
  title: string;
  typeName: string;
  path: string;
  views: number;
  visitors: number;
}
export interface TopContent {
  totalViews: number;
  items: TopContentItem[];
}

// ── SEO ─────────────────────────────────────────────────────
export interface SeoAuditRow {
  id: string;
  title: string | null;
  path: string | null;
  score: number;
  grade: string;
  fixFirst: string | null;
}

// ── View models (normalized for the UI) ─────────────────────

export type Trend = 'up' | 'down' | 'neutral';

export interface Delta {
  value: string;
  trend: Trend;
}

/** A headline KPI tile: a number with a delta-vs-previous and a trend sparkline.
 *  `icon` is a key resolved to a lucide icon in the component, so the data layer
 *  stays JSX-free. `hint` shows when there's no delta to display. */
export interface Kpi {
  key: string;
  label: string;
  module: SparxModule;
  value: string;
  delta?: Delta;
  hint?: string;
  spark?: number[];
  icon: string;
  href: string;
}

/** One x-position on the Performance chart: current value + optional previous.
 *  The index signature lets it satisfy the chart `data` contract (Record). */
export interface PerfPoint {
  label: string;
  value: number;
  prev?: number;
  [k: string]: string | number | undefined;
}

export interface PerfPanel {
  metric: PerfMetric;
  available: PerfMetric[];
  points: PerfPoint[];
  total: string;
  delta?: Delta;
  isSample: boolean;
}

export interface FunnelStage {
  label: string;
  value: number;
  /** Conversion from the previous stage, e.g. "32%". */
  rate?: string;
  module: SparxModule;
}

export type ActionSeverity = 'danger' | 'warning' | 'info';

export interface ActionItem {
  key: string;
  severity: ActionSeverity;
  title: string;
  hint?: string;
  href: string;
  module: SparxModule;
  icon: string;
}

export interface ActivityItem {
  key: string;
  title: string;
  meta: string;
  at: string;
  module: SparxModule;
}

/** Everything the command center renders, normalized + fail-soft. */
export interface DashboardData {
  range: DashboardRange;
  modules: Set<string>;
  kpis: Kpi[];
  perf: PerfPanel | null;
  sources: { source: string; visits: number }[] | null;
  sourcesSample: boolean;
  topPages: SiteTopPage[] | null;
  topPagesSample: boolean;
  funnel: FunnelStage[] | null;
  funnelSample: boolean;
  topProducts: TopProductRow[] | null;
  topCustomers: TopCustomerRow[] | null;
  channels: ChannelRevenueReport | null;
  crm: CrmSnapshot | null;
  acquisition: AcquisitionPoint[] | null;
  email: { overview: EmailOverview | null; growth: SubscriberGrowth | null };
  cms: { summary: CmsSummary | null; cadence: CmsCadence | null; topContent: TopContent | null };
  actionItems: ActionItem[];
  activity: ActivityItem[];
  vitals: SiteVitals | null;
  currency: string;
}

/** The raw, fail-soft bundle gather.ts returns — every reporting read the
 *  command center fans out, each independently nullable. Builders derive the
 *  view models above from this. */
export interface Raw {
  // commerce
  revCur: RevenueSummary | null;
  revPrev: RevenueSummary | null;
  revTs: RevenueTimeseries | null;
  revTsPrev: RevenueTimeseries | null;
  funnel: ConversionFunnel | null;
  abandoned: AbandonedCarts | null;
  subs: SubscriptionMetrics | null;
  topProducts: TopProductRow[] | null;
  topCustomers: TopCustomerRow[] | null;
  channels: ChannelRevenueReport | null;
  // traffic
  siteCur: SiteSummary | null;
  sitePrev: SiteSummary | null;
  siteTs: SiteTimeseries | null;
  siteTsPrev: SiteTimeseries | null;
  sources: SiteSourceRow[] | null;
  topPages: SiteTopPage[] | null;
  vitals: SiteVitals | null;
  // crm
  crm: CrmSnapshot | null;
  acquisition: AcquisitionPoint[] | null;
  leads: LeadsBySource | null;
  tasks: TaskMetrics | null;
  // email
  emailOverview: EmailOverview | null;
  growth: SubscriberGrowth | null;
  // b2b / finance
  b2b: B2bSummary | null;
  collections: CollectionsSummary | null;
  collectedTs: CollectedTimeseries | null;
  // ops
  inventory: InventorySummary | null;
  invActivity: InventoryActivityRow[] | null;
  dropship: DropshipTimeseries | null;
  runs: RunsTimeseries | null;
  // content
  cmsSummary: CmsSummary | null;
  cmsCadence: CmsCadence | null;
  cmsRecent: CmsRecent | null;
  topContent: TopContent | null;
  seo: SeoAuditRow[] | null;
}
