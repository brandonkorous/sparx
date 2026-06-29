import { api } from '@/lib/api-rest-client';

import { type DashboardRange, rangeQs, prevRangeQs } from './range';
import type {
  RevenueSummary,
  RevenueTimeseries,
  ConversionFunnel,
  AbandonedCarts,
  SubscriptionMetrics,
  TopProductRow,
  TopCustomerRow,
  ChannelRevenueReport,
  SiteSummary,
  SiteTimeseries,
  SiteTopPage,
  SiteSourceRow,
  SiteVitals,
  CrmSnapshot,
  AcquisitionPoint,
  LeadsBySource,
  TaskMetrics,
  EmailOverview,
  SubscriberGrowth,
  B2bSummary,
  CollectionsSummary,
  CollectedTimeseries,
  InventorySummary,
  InventoryActivityRow,
  DropshipTimeseries,
  RunsTimeseries,
  CmsSummary,
  CmsCadence,
  CmsRecent,
  TopContent,
  SeoAuditRow,
  Raw,
} from './types';

// The command center's single fan-out: every reporting read it needs, fired in
// parallel, each fail-soft (a disabled module 404s → null → the section
// collapses; an active-but-empty module returns empty → the UI shows a badged
// sample). Gated by the resolved active-module set so we don't spend round trips
// on capabilities the tenant doesn't run. docs/97 §7 (isolated, cached reads).

/** Run a read only when its module is active; swallow failures to null. */
function gate<T>(active: boolean, run: () => Promise<T>): Promise<T | null> {
  return active ? run().catch(() => null) : Promise.resolve(null);
}

export async function gatherRaw(range: DashboardRange, m: ReadonlySet<string>): Promise<Raw> {
  const cur = rangeQs(range);
  const prev = prevRangeQs(range);
  const grain = range.grain;
  const has = (mod: string) => m.has(mod);

  const [
    revCur,
    revPrev,
    revTs,
    revTsPrev,
    funnel,
    abandoned,
    subs,
    topProducts,
    topCustomers,
    channels,
    siteCur,
    sitePrev,
    siteTs,
    siteTsPrev,
    sources,
    topPages,
    vitals,
    crm,
    acquisition,
    leads,
    tasks,
    emailOverview,
    growth,
    b2b,
    collections,
    collectedTs,
    inventory,
    invActivity,
    dropship,
    runs,
    cmsSummary,
    cmsCadence,
    cmsRecent,
    topContent,
    seo,
  ] = await Promise.all([
    gate(has('commerce'), () =>
      api.get<RevenueSummary>(`/v1/commerce/reports/revenue-summary?${cur}`)
    ),
    gate(has('commerce'), () =>
      api.get<RevenueSummary>(`/v1/commerce/reports/revenue-summary?${prev}`)
    ),
    gate(has('commerce'), () =>
      api.get<RevenueTimeseries>(`/v1/commerce/reports/revenue-timeseries?${cur}&grain=${grain}`)
    ),
    gate(has('commerce'), () =>
      api.get<RevenueTimeseries>(`/v1/commerce/reports/revenue-timeseries?${prev}&grain=${grain}`)
    ),
    gate(has('commerce'), () =>
      api.get<ConversionFunnel>(`/v1/commerce/reports/conversion-funnel?${cur}`)
    ),
    gate(has('commerce'), () =>
      api.get<AbandonedCarts>(`/v1/commerce/reports/abandoned-carts?${cur}`)
    ),
    gate(has('commerce'), () =>
      api.get<SubscriptionMetrics>('/v1/commerce/reports/subscription-metrics')
    ),
    gate(has('commerce'), () =>
      api.get<TopProductRow[]>(`/v1/commerce/reports/top-products?${cur}&limit=5`)
    ),
    gate(has('commerce'), () =>
      api.get<TopCustomerRow[]>(`/v1/commerce/reports/top-customers?${cur}&limit=5`)
    ),
    gate(has('commerce'), () =>
      api.get<ChannelRevenueReport>(`/v1/commerce/reports/channel-revenue?${cur}`)
    ),
    gate(has('builder'), () => api.get<SiteSummary>(`/v1/builder/analytics/summary?${cur}`)),
    gate(has('builder'), () => api.get<SiteSummary>(`/v1/builder/analytics/summary?${prev}`)),
    gate(has('builder'), () =>
      api.get<SiteTimeseries>(`/v1/builder/analytics/timeseries?${cur}&grain=${grain}`)
    ),
    gate(has('builder'), () =>
      api.get<SiteTimeseries>(`/v1/builder/analytics/timeseries?${prev}&grain=${grain}`)
    ),
    gate(has('builder'), () => api.get<SiteSourceRow[]>(`/v1/builder/analytics/sources?${cur}`)),
    gate(has('builder'), () =>
      api.get<SiteTopPage[]>(`/v1/builder/analytics/top-pages?${cur}&limit=6`)
    ),
    gate(has('builder'), () => api.get<SiteVitals>(`/v1/builder/analytics/vitals?${cur}`)),
    gate(has('crm'), () => api.get<CrmSnapshot>('/v1/crm/reports/snapshot')),
    gate(has('crm'), () =>
      api.get<AcquisitionPoint[]>(`/v1/crm/reports/acquisition?months=${range.months}`)
    ),
    gate(has('crm'), () => api.get<LeadsBySource>(`/v1/crm/reports/leads-by-source?${cur}`)),
    gate(has('crm'), () => api.get<TaskMetrics>('/v1/crm/reports/tasks')),
    gate(has('email'), () =>
      api.get<EmailOverview>(`/v1/email/analytics/overview?days=${range.days}`)
    ),
    gate(has('email'), () =>
      api.get<SubscriberGrowth>(`/v1/email/analytics/subscriber-growth?${cur}&grain=${grain}`)
    ),
    gate(has('b2b'), () => api.get<B2bSummary>('/v1/b2b/reports/summary')),
    gate(has('invoicing'), () => api.get<CollectionsSummary>('/v1/invoicing/reports/collections')),
    gate(has('invoicing'), () =>
      api.get<CollectedTimeseries>(
        `/v1/invoicing/reports/collected-timeseries?${cur}&grain=${grain}`
      )
    ),
    gate(has('inventory'), () => api.get<InventorySummary>('/v1/inventory/reports/summary')),
    gate(has('inventory'), () =>
      api.get<InventoryActivityRow[]>('/v1/inventory/reports/activity?limit=8')
    ),
    gate(has('dropship'), () =>
      api.get<DropshipTimeseries>(`/v1/dropship/reports/orders-timeseries?${cur}&grain=${grain}`)
    ),
    gate(has('automations'), () =>
      api.get<RunsTimeseries>(`/v1/automations/reports/runs?${cur}&grain=${grain}`)
    ),
    gate(has('cms'), () => api.get<CmsSummary>('/v1/content/reports/summary')),
    gate(has('cms'), () =>
      api.get<CmsCadence>(`/v1/content/reports/cadence?${cur}&grain=${grain}`)
    ),
    gate(has('cms'), () => api.get<CmsRecent>('/v1/content/reports/recent?limit=8')),
    gate(has('cms'), () => api.get<TopContent>(`/v1/content/reports/top-content?${cur}&limit=6`)),
    gate(has('seo'), () => api.get<SeoAuditRow[]>('/v1/seo/audits')),
  ]);

  return {
    revCur,
    revPrev,
    revTs,
    revTsPrev,
    funnel,
    abandoned,
    subs,
    topProducts,
    topCustomers,
    channels,
    siteCur,
    sitePrev,
    siteTs,
    siteTsPrev,
    sources,
    topPages,
    vitals,
    crm,
    acquisition,
    leads,
    tasks,
    emailOverview,
    growth,
    b2b,
    collections,
    collectedTs,
    inventory,
    invActivity,
    dropship,
    runs,
    cmsSummary,
    cmsCadence,
    cmsRecent,
    topContent,
    seo,
  };
}
