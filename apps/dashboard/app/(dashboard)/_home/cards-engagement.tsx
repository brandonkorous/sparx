import { Card, CardBody, CardTitle } from '@wizeworks/silicaui-react';
import { ModuleProvider, Sparkline } from '@sparx/ui';

import { CardLink, MetricTile } from '../_components/overview-bits';
import { fmtMoneyCompact, fmtNumber, fmtPercent, ratio } from './format';
import type {
  AcquisitionPoint,
  CmsCadence,
  CmsSummary,
  CrmSnapshot,
  EmailOverview,
  SubscriberGrowth,
  TopContent,
} from './types';

// Engagement / retention deep-dives — each its module's single tinted card:
// CRM (cyan), Email (the email hue), Content (teal). A sparkline carries the
// trend; a compact metric cluster carries the level.

export function CrmPipelineCard({
  crm,
  acquisition,
}: {
  crm: CrmSnapshot;
  acquisition: AcquisitionPoint[] | null;
}) {
  const spark = (acquisition ?? []).map((p) => p.newCustomers);
  return (
    <ModuleProvider module="crm">
      <Card className="bg-module bg-soft">
        <CardBody>
          <div className="flex flex-row items-center justify-between gap-2">
            <CardTitle>CRM & pipeline</CardTitle>
            <CardLink href="/crm">Open</CardLink>
          </div>
          <div className="flex flex-col gap-4">
            {spark.length > 1 && <Sparkline data={spark} color="module" height={44} />}
            <div className="grid grid-cols-3 gap-3">
              <MetricTile value={fmtNumber(crm.customers)} label="Customers" tone="module" />
              <MetricTile value={fmtNumber(crm.openDeals)} label="Open deals" />
              <MetricTile
                value={fmtMoneyCompact(Math.round(crm.pipelineValue * 100))}
                label="Pipeline"
              />
            </div>
          </div>
        </CardBody>
      </Card>
    </ModuleProvider>
  );
}

export function EmailCard({
  overview,
  growth,
}: {
  overview: EmailOverview | null;
  growth: SubscriberGrowth | null;
}) {
  const spark = (growth?.points ?? []).map((p) => p.net);
  const openRate = overview ? ratio(overview.counts.opened, overview.counts.delivered) * 100 : null;
  const clickRate = overview
    ? ratio(overview.counts.clicked, overview.counts.delivered) * 100
    : null;
  return (
    <ModuleProvider module="email">
      <Card className="bg-module bg-soft">
        <CardBody>
          <div className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Email</CardTitle>
            <CardLink href="/email">Open</CardLink>
          </div>
          <div className="flex flex-col gap-4">
            {spark.length > 1 && <Sparkline data={spark} color="module" height={44} />}
            <div className="grid grid-cols-3 gap-3">
              <MetricTile
                value={growth ? fmtNumber(growth.currentSubscribers) : '—'}
                label="Subscribers"
                tone="module"
              />
              <MetricTile value={openRate != null ? fmtPercent(openRate) : '—'} label="Open rate" />
              <MetricTile
                value={clickRate != null ? fmtPercent(clickRate) : '—'}
                label="Click rate"
              />
            </div>
          </div>
        </CardBody>
      </Card>
    </ModuleProvider>
  );
}

export function ContentCard({
  summary,
  cadence,
  topContent,
}: {
  summary: CmsSummary | null;
  cadence: CmsCadence | null;
  topContent: TopContent | null;
}) {
  const spark = (cadence?.points ?? []).map((p) => p.publishedCount);
  const top = topContent?.items.slice(0, 3) ?? [];
  return (
    <ModuleProvider module="cms">
      <Card className="bg-module bg-soft">
        <CardBody>
          <div className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Content</CardTitle>
            <CardLink href="/cms/content">Open</CardLink>
          </div>
          <div className="flex flex-col gap-4">
            {spark.length > 1 && <Sparkline data={spark} color="module" height={44} />}
            <div className="grid grid-cols-3 gap-3">
              <MetricTile
                value={fmtNumber(summary?.byStatus.published)}
                label="Published"
                tone="module"
              />
              <MetricTile value={fmtNumber(summary?.byStatus.draft)} label="Drafts" />
              <MetricTile value={fmtNumber(summary?.scheduledUpcoming)} label="Scheduled" />
            </div>
            {top.length > 0 && (
              <div className="flex flex-col gap-0">
                {top.map((c) => (
                  <div
                    key={c.id}
                    className="border-base-300 flex items-center justify-between gap-3 border-b py-2 last:border-b-0"
                  >
                    <span className="text-base-content truncate text-sm">{c.title}</span>
                    <span className="text-base-content shrink-0 text-xs tabular-nums">
                      {fmtNumber(c.views)} views
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </ModuleProvider>
  );
}
