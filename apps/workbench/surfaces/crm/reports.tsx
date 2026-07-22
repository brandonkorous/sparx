'use client';

// Reports — how the customer base is doing.
//
// A metrics surface, not a table: KPI tiles across the top, then panels that each
// answer one question — who is joining, how the pipeline is shaped, who wins
// work, where customers come from, and how the audiences are sized. Every panel
// owns its own loading and empty state, so one slow query is one quiet tile, not
// a blank page. Charts use the app's chart wrapper; everything else is silica.

import { useMemo, useState } from 'react';
import { Badge, Button, EmptyState, Heading, Select, Text } from '@wizeworks/silicaui-react';
import { Chart, type EChartsOption } from '@wizeworks/silicaui-charts';
import { BarChart3 } from 'lucide-react';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { useTeamRoster } from '../../lib/api/team';
import { usePipelines } from './pipelines-data';
import { useModuleColor } from '../analytics/charts';
import {
  formatMoney,
  monthLabel,
  useAcquisition,
  usePipelineFunnel,
  useLeadsBySource,
  useSegmentSummary,
  useSnapshot,
  useTaskMetrics,
  useWinLoss,
  useRefreshReports,
  type AcquisitionPoint,
} from './reports-data';

/* ── Proportion bar (a functional data bar, quantised widths, no inline style) ── */

const BAR_WIDTH = [
  'w-0',
  'w-[5%]',
  'w-[10%]',
  'w-[15%]',
  'w-[20%]',
  'w-[25%]',
  'w-[30%]',
  'w-[35%]',
  'w-[40%]',
  'w-[45%]',
  'w-[50%]',
  'w-[55%]',
  'w-[60%]',
  'w-[65%]',
  'w-[70%]',
  'w-[75%]',
  'w-[80%]',
  'w-[85%]',
  'w-[90%]',
  'w-[95%]',
  'w-full',
];

function ProportionRow({
  label,
  value,
  peak,
  trailing,
}: {
  label: string;
  value: number;
  peak: number;
  trailing: string;
}) {
  const step = value <= 0 ? 0 : Math.round((value / Math.max(1, peak)) * 20);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
        <span className="shrink-0 text-sm font-semibold tabular-nums">{trailing}</span>
      </div>
      <div className="bg-base-200 h-1.5 overflow-hidden rounded-full">
        <div className={`bg-module h-full rounded-full ${BAR_WIDTH[step] ?? 'w-0'}`} />
      </div>
    </div>
  );
}

/* ── KPI tile + panel shell ─────────────────────────────────────────────── */

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-base-300 bg-base-100 flex flex-col gap-1 rounded-lg border p-3">
      <span className="text-sm">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-base-300 bg-base-100 flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <Heading level={2} className="text-base font-semibold">
          {title}
        </Heading>
        {action}
      </div>
      {children}
    </section>
  );
}

function Loading() {
  return (
    <Text className="text-sm" role="status">
      Loading…
    </Text>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <Text className="text-sm">{children}</Text>;
}

/* ── Acquisition chart ──────────────────────────────────────────────────── */

function AcquisitionChart({ points }: { points: AcquisitionPoint[] }) {
  const { ref, color } = useModuleColor();
  const option = useMemo<EChartsOption>(
    () => ({
      ...(color ? { color: [color] } : {}),
      grid: { left: 4, right: 8, top: 12, bottom: 2, containLabel: true },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: points.map((p) => monthLabel(p.month)),
        axisTick: { show: false },
        axisLabel: { hideOverlap: true },
      },
      yAxis: { type: 'value', splitNumber: 3, minInterval: 1 },
      series: [
        {
          type: 'bar',
          data: points.map((p) => p.newCustomers),
          barMaxWidth: 28,
          itemStyle: { borderRadius: [4, 4, 0, 0] },
        },
      ],
    }),
    [points, color]
  );
  return (
    <div ref={ref} className="w-full">
      <Chart option={option} className="h-56 w-full" aria-label="New customers per month" />
    </div>
  );
}

/* ── Surface ────────────────────────────────────────────────────────────── */

export function CrmReportsSurface(_props: { ctx: SurfaceContext }) {
  const snapshot = useSnapshot();
  const acquisition = useAcquisition(12);
  const winLoss = useWinLoss();
  const leads = useLeadsBySource();
  const tasks = useTaskMetrics();
  const segments = useSegmentSummary();
  const { data: pipelines } = usePipelines();
  const { members: roster } = useTeamRoster();
  const refreshAll = useRefreshReports();

  const [pipelineId, setPipelineId] = useState<string>('');
  const activePipeline = pipelineId || pipelines?.items[0]?.id;
  const funnel = usePipelineFunnel(activePipeline);

  const repName = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of roster) map.set(m.userId, m.name ?? m.email);
    return map;
  }, [roster]);

  const s = snapshot.data;
  const acqPoints = acquisition.data ?? [];
  const acqHasData = acqPoints.some((p) => p.newCustomers > 0);
  const funnelPeak = Math.max(1, ...(funnel.data ?? []).map((b) => b.count));
  const leadPeak = Math.max(1, ...(leads.data?.bySource ?? []).map((r) => r.count));
  const segPeak = Math.max(1, ...(segments.data?.segments ?? []).map((r) => r.memberCount));

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Reports controls">
        <Text as="span" className="text-sm font-medium">
          How your customers are doing
        </Text>
        <RefreshButton
          className="ml-auto"
          isFetching={snapshot.isFetching}
          updatedAt={snapshot.data ? snapshot.dataUpdatedAt : undefined}
          onRefresh={() => {
            void refreshAll();
          }}
        />
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
          {/* KPI strip */}
          {snapshot.isError ? (
            <EmptyState
              icon={<BarChart3 className="size-6" aria-hidden />}
              title="Could not load your figures"
              description="Something went wrong reaching the server. Try again in a moment."
              actions={
                <Button
                  size="sm"
                  color="module"
                  onClick={() => {
                    void snapshot.refetch();
                  }}
                >
                  Try again
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 @md:grid-cols-3 @2xl:grid-cols-4">
              <KpiTile label="Customers" value={s ? s.customers.toLocaleString() : '—'} />
              <KpiTile
                label="Wholesale accounts"
                value={s ? s.b2bAccounts.toLocaleString() : '—'}
              />
              <KpiTile label="Open deals" value={s ? s.openDeals.toLocaleString() : '—'} />
              <KpiTile label="Pipeline value" value={s ? formatMoney(s.pipelineValue) : '—'} />
              <KpiTile label="Open tasks" value={s ? s.openTasks.toLocaleString() : '—'} />
              <KpiTile label="Overdue tasks" value={s ? s.overdueTasks.toLocaleString() : '—'} />
              <KpiTile
                label="Active segments"
                value={s ? s.activeSegments.toLocaleString() : '—'}
              />
            </div>
          )}

          <div className="grid gap-4 @3xl:grid-cols-2">
            {/* New customers per month */}
            <Panel title="New customers a month">
              {acquisition.isPending ? (
                <Loading />
              ) : !acqHasData ? (
                <Empty>No new customers in this period yet.</Empty>
              ) : (
                <AcquisitionChart points={acqPoints} />
              )}
            </Panel>

            {/* Task health */}
            <Panel title="Tasks">
              {tasks.isPending ? (
                <Loading />
              ) : tasks.data ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <KpiTile label="To do" value={tasks.data.open.toLocaleString()} />
                    <KpiTile label="Overdue" value={tasks.data.overdue.toLocaleString()} />
                    <KpiTile label="Due today" value={tasks.data.dueToday.toLocaleString()} />
                    <KpiTile
                      label="Done (30 days)"
                      value={tasks.data.completedLast30d.toLocaleString()}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ['urgent', 'Urgent'],
                        ['high', 'High'],
                        ['medium', 'Medium'],
                        ['low', 'Low'],
                      ] as const
                    ).map(([key, label]) => (
                      <Badge key={key} color="neutral" variant="soft" size="sm">
                        {label}: {tasks.data.byPriority[key]}
                      </Badge>
                    ))}
                  </div>
                </>
              ) : (
                <Empty>No task figures yet.</Empty>
              )}
            </Panel>

            {/* Pipeline funnel */}
            <Panel
              title="Pipeline"
              action={
                (pipelines?.items.length ?? 0) > 0 ? (
                  <div className="w-44">
                    <Select
                      size="sm"
                      color="module"
                      aria-label="Which pipeline"
                      value={activePipeline ?? ''}
                      items={Object.fromEntries(
                        (pipelines?.items ?? []).map((p) => [p.id, p.name])
                      )}
                      onValueChange={(next) => {
                        setPipelineId(next as string);
                      }}
                    />
                  </div>
                ) : null
              }
            >
              {!activePipeline ? (
                <Empty>Create a pipeline to see its funnel.</Empty>
              ) : funnel.isPending ? (
                <Loading />
              ) : (funnel.data?.length ?? 0) === 0 ? (
                <Empty>This pipeline has no stages yet.</Empty>
              ) : (
                <div className="flex flex-col gap-3">
                  {funnel.data?.map((b) => (
                    <ProportionRow
                      key={b.stageId}
                      label={b.stageName}
                      value={b.count}
                      peak={funnelPeak}
                      trailing={`${b.count.toLocaleString()} · ${formatMoney(b.totalValue)}`}
                    />
                  ))}
                </div>
              )}
            </Panel>

            {/* Win / loss */}
            <Panel title="Won and lost, by person">
              {winLoss.isPending ? (
                <Loading />
              ) : (winLoss.data?.length ?? 0) === 0 ? (
                <Empty>No closed deals to compare yet.</Empty>
              ) : (
                <ul className="divide-base-300 flex flex-col divide-y">
                  {winLoss.data?.map((row) => (
                    <li
                      key={row.repId ?? 'unassigned'}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {row.repId ? (repName.get(row.repId) ?? 'A team member') : 'Unassigned'}
                      </span>
                      <Badge color="success" variant="soft" size="sm">
                        {row.won} won
                      </Badge>
                      <Badge color="danger" variant="soft" size="sm">
                        {row.lost} lost
                      </Badge>
                      <span className="text-sm tabular-nums">
                        {Math.round(row.winRate * 100)}% win rate
                      </span>
                      <span className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums">
                        {formatMoney(row.totalWonValue)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {/* Leads by source */}
            <Panel title="Where new customers come from">
              {leads.isPending ? (
                <Loading />
              ) : (leads.data?.bySource.length ?? 0) === 0 ? (
                <Empty>No new customers in this period yet.</Empty>
              ) : (
                <div className="flex flex-col gap-3">
                  <Text className="text-sm">{leads.data?.rangeLabel}</Text>
                  {leads.data?.bySource.map((row) => (
                    <ProportionRow
                      key={row.source}
                      label={row.label}
                      value={row.count}
                      peak={leadPeak}
                      trailing={`${row.count.toLocaleString()} · ${row.sharePct}%`}
                    />
                  ))}
                </div>
              )}
            </Panel>

            {/* Segments */}
            <Panel title="Audiences by size">
              {segments.isPending ? (
                <Loading />
              ) : (segments.data?.segments.length ?? 0) === 0 ? (
                <Empty>No segments yet.</Empty>
              ) : (
                <div className="flex flex-col gap-3">
                  {segments.data?.segments.map((row) => (
                    <ProportionRow
                      key={row.id}
                      label={row.name}
                      value={row.memberCount}
                      peak={segPeak}
                      trailing={row.memberCount.toLocaleString()}
                    />
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
