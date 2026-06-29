import { api } from '@/lib/api-rest-client';

import { resolveRange } from './range';
import { gatherRaw } from './gather';
import { buildKpis } from './kpis';
import { buildPerf } from './perf';
import { buildFunnel } from './funnel';
import { buildAlerts } from './alerts';
import { buildActivity } from './activity';
import { SAMPLE_SOURCES, SAMPLE_TOP_PAGES } from './samples';
import type { DashboardData } from './types';

// The command center's single entry point. Resolves the active module set,
// fans out every reporting read (gather.ts), and assembles the normalized,
// fail-soft view model the page renders. URL-driven and force-dynamic: a new
// range/metric is a navigation that re-runs this with fresh reads.

interface HomeFlags {
  modules: { slug: string; enabled: boolean }[];
}

/** Active modules from the tenant flags, plus the derived capabilities that
 *  don't have their own flag (invoicing/finance ride commerce/B2B; SEO rides
 *  the site/CMS; automations exist whenever anything is on). */
async function activeModules(): Promise<Set<string>> {
  const home = await api.get<HomeFlags>('/v1/dashboard/home').catch(() => null);
  const set = new Set<string>((home?.modules ?? []).filter((x) => x.enabled).map((x) => x.slug));
  if (set.has('commerce') || set.has('b2b')) {
    set.add('invoicing');
    set.add('finance');
  }
  if (set.has('builder') || set.has('cms')) set.add('seo');
  if (set.size > 0) set.add('automations');
  return set;
}

export async function loadDashboard(searchParams: {
  range?: string;
  compare?: string;
  metric?: string;
}): Promise<DashboardData> {
  const range = resolveRange(searchParams);
  const modules = await activeModules();
  const raw = await gatherRaw(range, modules);

  const funnel = buildFunnel(raw, modules);
  const sourcesSample = !(raw.sources && raw.sources.length > 0);
  const topPagesSample = !(raw.topPages && raw.topPages.length > 0);

  return {
    range,
    modules,
    kpis: buildKpis(raw, modules),
    perf: buildPerf(raw, searchParams.metric, modules, range),
    sources: sourcesSample ? SAMPLE_SOURCES : raw.sources,
    sourcesSample,
    topPages: topPagesSample ? SAMPLE_TOP_PAGES : raw.topPages,
    topPagesSample,
    funnel: funnel.stages,
    funnelSample: funnel.isSample,
    topProducts: raw.topProducts,
    topCustomers: raw.topCustomers,
    channels: raw.channels,
    crm: raw.crm,
    acquisition: raw.acquisition,
    email: { overview: raw.emailOverview, growth: raw.growth },
    cms: { summary: raw.cmsSummary, cadence: raw.cmsCadence, topContent: raw.topContent },
    actionItems: buildAlerts(raw, modules),
    activity: buildActivity(raw, modules),
    vitals: raw.vitals,
    currency: raw.revCur?.currency ?? 'USD',
  };
}
