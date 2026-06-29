import { requireSession } from '@sparx/auth';
import { Container, Grid, Heading, Stack, Text } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { OnboardingBanner } from './_components/onboarding-banner';
import { LegalReacceptBanner } from './_components/legal-reaccept-banner';
import { loadOnboardingProgress } from './welcome/onboarding';

import { loadDashboard } from './_home/data';
import { RangeControl } from './_home/controls';
import { CreateMenu } from './_home/create-menu';
import { NeedsAttention } from './_home/needs-attention';
import { KpiStrip } from './_home/kpi-strip';
import { PerformancePanel } from './_home/performance-panel';
import { ConversionFunnel } from './_home/funnel-card';
import { TrafficSourcesCard, TopPagesCard } from './_home/acquisition';
import { SalesByChannelCard, TopListsCard } from './_home/cards-commerce';
import { CrmPipelineCard, EmailCard, ContentCard } from './_home/cards-engagement';
import { ActivityFeed } from './_home/activity-feed';
import { WebVitalsCard } from './_home/vitals-card';

// The command center — the business-OS home. Not a launcher (the sidebar is
// navigation): a one-screen, at-a-glance read on the whole business. Built on
// the inverted pyramid — attention → KPIs → trend → funnel → module deep-dives
// → activity — and ordered by the GA4 lifecycle (acquisition → engagement →
// monetization → retention) so it stays a real command center for a content-only
// tenant too. Everything is real, module-gated, fail-soft data (see _home/).

export const dynamic = 'force-dynamic';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const present = (v: unknown): boolean => v != null;

export default async function DashboardHome({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; compare?: string; metric?: string }>;
}): Promise<React.JSX.Element> {
  const sp = await searchParams;
  const { user } = await requireSession();
  const [data, onboarding, legalStatus] = await Promise.all([
    loadDashboard(sp),
    // Both banners are non-critical chrome — never let one failing read take
    // down the whole command center.
    loadOnboardingProgress(user.tenantId).catch(() => null),
    api.get<{ stale: string[] }>('/v1/me/legal-status').catch(() => ({ stale: [] as string[] })),
  ]);
  const m = data.modules;
  const showAcquisition =
    m.has('builder') && (present(data.funnel) || present(data.sources) || present(data.topPages));
  const showDeepDive =
    (m.has('commerce') &&
      (present(data.channels) || present(data.topProducts) || present(data.topCustomers))) ||
    (m.has('crm') && present(data.crm)) ||
    (m.has('email') && (present(data.email.overview) || present(data.email.growth))) ||
    (m.has('cms') && present(data.cms.summary));

  return (
    <Container size="xl">
      <Stack gap={8} className="py-8">
        <Stack direction="row" align="end" justify="between" gap={4} className="flex-wrap">
          <Stack gap={1}>
            <Heading level={1}>{greeting()}</Heading>
            <Text variant="muted">Your business at a glance · {data.range.label}</Text>
          </Stack>
          <Stack direction="row" align="center" gap={2} className="flex-wrap">
            <RangeControl active={data.range.key} />
            <CreateMenu modules={m} />
          </Stack>
        </Stack>

        <LegalReacceptBanner staleDocs={legalStatus.stale} />
        {onboarding && <OnboardingBanner progress={onboarding} />}

        {/* 1 · Needs attention — collapses when clean. */}
        <NeedsAttention items={data.actionItems} />

        {/* 2 · Headline KPIs. */}
        <KpiStrip kpis={data.kpis} />

        {/* 3 · Hero trend. */}
        {data.perf && <PerformancePanel perf={data.perf} rangeLabel={data.range.label} />}

        {/* 4 · Acquisition — funnel + sources + top pages. */}
        {showAcquisition && (
          <Grid cols={1} lgCols={3} gap={4}>
            {data.funnel && <ConversionFunnel stages={data.funnel} isSample={data.funnelSample} />}
            {data.sources && (
              <TrafficSourcesCard sources={data.sources} isSample={data.sourcesSample} />
            )}
            {data.topPages && <TopPagesCard pages={data.topPages} isSample={data.topPagesSample} />}
          </Grid>
        )}

        {/* 5 · Module deep-dives — GA4 lifecycle order, one tinted card per hue. */}
        {showDeepDive && (
          <Grid cols={1} lgCols={2} gap={4}>
            {m.has('commerce') && data.channels && <SalesByChannelCard channels={data.channels} />}
            {m.has('commerce') && (present(data.topProducts) || present(data.topCustomers)) && (
              <TopListsCard products={data.topProducts} customers={data.topCustomers} />
            )}
            {m.has('crm') && data.crm && (
              <CrmPipelineCard crm={data.crm} acquisition={data.acquisition} />
            )}
            {m.has('email') && (present(data.email.overview) || present(data.email.growth)) && (
              <EmailCard overview={data.email.overview} growth={data.email.growth} />
            )}
            {m.has('cms') && data.cms.summary && (
              <ContentCard
                summary={data.cms.summary}
                cadence={data.cms.cadence}
                topContent={data.cms.topContent}
              />
            )}
          </Grid>
        )}

        {/* 6 · Recent activity (+ site speed when a site is live). */}
        {m.has('builder') ? (
          <Grid cols={1} lgCols={3} gap={4}>
            <div className="lg:col-span-2">
              <ActivityFeed items={data.activity} />
            </div>
            <WebVitalsCard vitals={data.vitals} />
          </Grid>
        ) : (
          <ActivityFeed items={data.activity} />
        )}
      </Stack>
    </Container>
  );
}
