// Automations overview (docs/34 overview archetype, founder lens) — the
// operator's one-glance answer to "is it working, and is it saving me time?".
// It opens with a run-health KPI strip, a "needs attention" queue of failing /
// paused rules, run-activity over time + a by-trigger split, then the full live
// automations table (the old list, preserved in-place) and a recent-activity
// feed.
//
// Automations is a PLATFORM capability, not a gated module (docs/81 §1, §3): no
// ModuleGate. The surface is reachable whenever ≥1 trigger-capable module is
// active; with none we keep the original activation upsell (the guard below).
// The page reads `/v1/automations` (the API-first spine the dashboard + MCP
// both consume) and fails soft to "—" / a compact empty state per the overview
// archetype — never illustrative sample data.

import Link from 'next/link';
import {
  AlertTriangle,
  Clock,
  History,
  ListChecks,
  Pause,
  PlayCircle,
  Plus,
  ShieldCheck,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';

import { listEnabledModules, requireSession } from '@sparx/auth';
import { Badge, Button, Card, EmptyState, Table } from 'silicaui-react';
import { ActionQueue, ActionTile, AreaChart, DonutChart, PageHeader, Stat } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import type { AutomationDto } from './_lib/types';
import { formatTimestamp, summarizeTrigger } from './_lib/presentation';
import {
  CardLink,
  MetricTile,
  OverviewCard,
  OverviewRow,
  fmtNumber,
  fmtPercentRatio,
} from '../_components/overview-bits';

export const dynamic = 'force-dynamic';

const TWO_COL = 'grid grid-cols-1 gap-4 lg:grid-cols-[1.9fr_1fr]';

// Run-activity timeseries (docs/97 §5) — `GET /v1/automations/reports/runs`,
// backed by the `rollup_automation_daily_runs` rollup. The chart renders this
// live series; until the tenant has runs in the window the card shows a compact
// empty state.
interface RunsTimeseriesPoint {
  bucket: string;
  runsCount: number;
  completedCount: number;
  failedCount: number;
  skippedCount: number;
}
interface RunsTimeseries {
  range: { from: string; to: string; grain: string };
  points: RunsTimeseriesPoint[];
  totals: {
    runsCount: number;
    completedCount: number;
    failedCount: number;
    skippedCount: number;
    successRate: number;
  };
}

// Module-prefix → human label for the trigger split. Trigger types are free
// text (`crm.customer.created`, `order.placed`, `schedule.daily`), so we group
// by the leading segment and humanize it for the donut + table.
const TRIGGER_GROUP_LABEL: Record<string, string> = {
  crm: 'CRM',
  customer: 'CRM',
  deal: 'CRM',
  order: 'Commerce',
  commerce: 'Commerce',
  b2b: 'B2B',
  email: 'Email',
  cms: 'CMS',
  site: 'CMS',
  schedule: 'Scheduled',
  webhook: 'Webhook',
  platform: 'Platform',
};

function triggerGroup(triggerType: string): string {
  const head = triggerType.split('.')[0] ?? '';
  return TRIGGER_GROUP_LABEL[head] ?? 'Other';
}

// Donut palette across the fuchsia accent — the live module color plus tints,
// so the by-trigger split stays on-brand without hardcoding the hex.
const DONUT_COLORS = [
  'module',
  'var(--module-active-tint)',
  '#f0abfc',
  '#f5d0fe',
  '#fbcfe8',
  '#fae8ff',
];

const ROW_STATUS: Record<AutomationDto['status'], { color: string; label: string }> = {
  active: { color: 'success', label: 'Active' },
  paused: { color: 'neutral', label: 'Paused' },
  error: { color: 'danger', label: 'Error' },
  draft: { color: 'neutral', label: 'Draft' },
};

function successRate(runCount: number, errorCount: number): number | null {
  if (runCount <= 0) return null;
  return Math.max(0, 1 - errorCount / runCount);
}

export default async function AutomationsPage() {
  const session = await requireSession();

  // Run-activity series over the last 14 days (UTC daily buckets).
  const runsTo = new Date();
  const runsFrom = new Date(runsTo.getTime() - 13 * 86_400_000);
  const runsQs = new URLSearchParams({
    grain: 'day',
    from: runsFrom.toISOString(),
    to: runsTo.toISOString(),
  });

  const [enabledModules, automations, runsTs] = await Promise.all([
    listEnabledModules(session.user.tenantId),
    api.get<AutomationDto[]>('/v1/automations').catch(() => null),
    api.get<RunsTimeseries>(`/v1/automations/reports/runs?${runsQs.toString()}`).catch(() => null),
  ]);

  const role = session.user.role;
  const canWrite = role === 'owner' || role === 'admin' || role === 'editor';

  // ── Guard (preserved): no trigger-capable module → activation upsell, not an
  // empty rule list. This is the exact gate the old list page enforced. ──
  if (enabledModules.length === 0) {
    return (
      <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 py-10">
          <PageHeader
            icon={<Zap className="h-5 w-5" />}
            title="Automations"
            description="Cross-module “when X, if Y, do Z” rules that connect your sparx modules."
          />
          <Card>
            <EmptyState
              icon={<Zap className="h-5 w-5" />}
              title="Activate a module first"
              description="Automations connect your modules — activate at least one to start authoring rules."
              actions={
                <Button color="module" render={<Link href="/settings/modules" />}>
                  Add a module
                </Button>
              }
            />
          </Card>
        </div>
      </div>
    );
  }

  const rules = automations ?? [];

  // ── Live aggregates from the rule set ──
  const activeCount = rules.filter((a) => a.status === 'active').length;
  const pausedCount = rules.filter((a) => a.status === 'paused').length;
  const totalRuns = rules.reduce((sum, a) => sum + (a.runCount ?? 0), 0);
  const totalErrors = rules.reduce((sum, a) => sum + (a.errorCount ?? 0), 0);
  const failing = rules.filter((a) => a.status === 'error' || (a.errorCount ?? 0) > 0);
  const overallRate = successRate(totalRuns, totalErrors);

  // Needs-attention queue: failing rules (danger) first, then paused (neutral).
  const attention = [...failing, ...rules.filter((a) => a.status === 'paused')].slice(0, 6);

  // By-trigger split, live: group the rule set by trigger module.
  const triggerCounts = new Map<string, number>();
  for (const a of rules) {
    const g = triggerGroup(a.triggerType);
    triggerCounts.set(g, (triggerCounts.get(g) ?? 0) + 1);
  }
  const triggerData = [...triggerCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({
      label,
      value,
      color: DONUT_COLORS[i % DONUT_COLORS.length],
    }));

  // Run-activity chart: map the rollup series to the chart's {label, runs,
  // failed} shape, gated on real volume in the window. Empty until the tenant
  // has runs, where the card shows a compact empty state instead of a chart.
  const runsPoints =
    runsTs && runsTs.totals.runsCount > 0
      ? runsTs.points.map((p) => ({
          label: new Date(`${p.bucket}T00:00:00.000Z`).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
          }),
          runs: p.runsCount,
          failed: p.failedCount,
        }))
      : null;
  const runs14dTotal = runsTs?.totals.runsCount ?? 0;
  const runs14dSuccess = runsTs?.totals.successRate ?? 0;

  // Table: every automation, busiest first (preserves the old list — show all).
  const tableRows = [...rules].sort((a, b) => (b.runCount ?? 0) - (a.runCount ?? 0));

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-8">
        <PageHeader
          icon={<Zap className="h-5 w-5" />}
          title="Automations"
          description="Is it working & saving you time? — run health across your rules."
          actions={
            canWrite ? (
              <>
                <Button
                  variant="outline"
                  iconStart={<ListChecks className="h-4 w-4" />}
                  render={<Link href="/automations/new" />}
                >
                  Browse templates
                </Button>
                <Button
                  color="module"
                  iconStart={<Plus className="h-4 w-4" />}
                  render={<Link href="/automations/new" />}
                >
                  New automation
                </Button>
              </>
            ) : undefined
          }
        />

        {/* Headline KPIs — live from the rule set */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Stat
            icon={<PlayCircle className="h-4 w-4" />}
            label="Active automations"
            value={fmtNumber(activeCount)}
            hint={
              rules.length
                ? `${fmtNumber(rules.length)} total · ${fmtNumber(pausedCount)} paused`
                : 'No rules authored yet'
            }
          />
          <Stat
            icon={<Zap className="h-4 w-4" />}
            label="Runs · all time"
            value={fmtNumber(totalRuns)}
            hint="Across every automation"
          />
          <Stat
            icon={<XCircle className="h-4 w-4" />}
            label="Failures"
            value={fmtNumber(totalErrors)}
            hint={
              failing.length
                ? `${fmtNumber(failing.length)} automation${failing.length === 1 ? '' : 's'} affected`
                : 'No failed runs'
            }
          />
          <Stat
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Success rate"
            value={overallRate == null ? '—' : fmtPercentRatio(overallRate, 1)}
            hint={totalRuns ? 'Completed ÷ total runs' : 'Awaiting first run'}
          />
        </div>

        {/* Needs attention — failures to review (live) */}
        <OverviewCard
          title="Needs attention"
          icon={<AlertTriangle className="h-4 w-4" />}
          description="Automations that failed or are paused — clear these to keep work flowing."
          right={<CardLink href="/automations?status=error">All issues</CardLink>}
        >
          {attention.length === 0 ? (
            <div className="flex items-center gap-3 py-2 text-sm text-[var(--color-text-secondary)]">
              <ShieldCheck className="h-4 w-4 text-[var(--color-success-text)]" />
              Everything is running clean — no failed or paused automations.
            </div>
          ) : (
            attention.map((a) => {
              const failed = a.status === 'error' || (a.errorCount ?? 0) > 0;
              return (
                <OverviewRow
                  key={a.id}
                  icon={failed ? <XCircle className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  tone={failed ? 'danger' : 'neutral'}
                  title={a.name}
                  hint={
                    failed
                      ? `${fmtNumber(a.errorCount)} error${a.errorCount === 1 ? '' : 's'} · last failed ${formatTimestamp(a.lastErrorAt)}`
                      : `Paused · ${summarizeTrigger(a.triggerType, a.triggerConfig)}`
                  }
                  right={
                    <Button
                      variant="link"
                      color="module"
                      size="sm"
                      render={<Link href={`/automations/${a.id}`} />}
                    >
                      {failed ? 'Review' : 'Resume'}
                    </Button>
                  }
                />
              );
            })
          )}
        </OverviewCard>

        {/* Run activity over time + by-trigger split — both live */}
        <div className={TWO_COL}>
          <OverviewCard
            title="Run activity"
            icon={<TrendingUp className="h-4 w-4" />}
            description={runsPoints ? 'Runs per day — last 14 days' : undefined}
            plain
          >
            {runsPoints ? (
              <>
                <AreaChart
                  data={runsPoints}
                  series={[
                    { key: 'runs', label: 'Runs', color: 'module' },
                    { key: 'failed', label: 'Failed', color: 'danger' },
                  ]}
                  xKey="label"
                  height={210}
                  valueFormat="number"
                  ariaLabel="Automation runs per day, last 14 days"
                />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MetricTile value={fmtNumber(runs14dTotal)} label="Runs · 14d" />
                  <MetricTile
                    value={`${runs14dSuccess}%`}
                    label="Success rate · 14d"
                    tone="module"
                  />
                </div>
              </>
            ) : (
              <EmptyState
                icon={<TrendingUp className="h-5 w-5" />}
                title="No runs yet"
                description="Run activity appears here once your automations start firing."
              />
            )}
          </OverviewCard>

          <OverviewCard
            title="By trigger"
            icon={<Zap className="h-4 w-4" />}
            description="How your rules are triggered"
            plain
          >
            {triggerData.length === 0 ? (
              <EmptyState
                icon={<Zap className="h-5 w-5" />}
                title="Nothing to group yet"
                description="Your rules split by trigger type once you create one."
              />
            ) : (
              <DonutChart
                data={triggerData}
                valueFormat="number"
                centerValue={fmtNumber(rules.length)}
                centerLabel={rules.length === 1 ? 'automation' : 'automations'}
                ariaLabel="Automations by trigger type"
              />
            )}
          </OverviewCard>
        </div>

        {/* All automations — the live list, preserved in place */}
        <OverviewCard
          title="All automations"
          icon={<ListChecks className="h-4 w-4" />}
          right={<CardLink href="/automations/new">New automation</CardLink>}
          plain
        >
          {tableRows.length === 0 ? (
            <EmptyState
              icon={<Zap className="h-5 w-5" />}
              title="No automations yet"
              description="Create your first rule to trigger actions when events happen across your modules."
              actions={
                canWrite ? (
                  <Button
                    color="module"
                    iconStart={<Plus className="h-4 w-4" />}
                    render={<Link href="/automations/new" />}
                  >
                    New automation
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Automation</th>
                  <th>Trigger</th>
                  <th className="text-right">Runs</th>
                  <th className="text-right">Success</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((a) => {
                  const rate = successRate(a.runCount ?? 0, a.errorCount ?? 0);
                  const status = ROW_STATUS[a.status] ?? ROW_STATUS.draft;
                  return (
                    <tr key={a.id}>
                      <td>
                        <Link
                          href={`/automations/${a.id}`}
                          className="font-medium hover:text-[var(--module-active)] hover:underline"
                        >
                          {a.name}
                        </Link>
                      </td>
                      <td className="text-[var(--color-text-secondary)]">
                        {summarizeTrigger(a.triggerType, a.triggerConfig)}
                      </td>
                      <td className="text-right tabular-nums">{fmtNumber(a.runCount)}</td>
                      <td className="text-right tabular-nums">
                        {rate == null ? '—' : fmtPercentRatio(rate, 0)}
                      </td>
                      <td>
                        <Badge color={status.color} variant="soft">
                          {status.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </OverviewCard>

        {/* Daily action queue + recent activity */}
        <div className={TWO_COL}>
          <OverviewCard title="Recent activity" icon={<History className="h-4 w-4" />} plain>
            <EmptyState
              icon={<History className="h-5 w-5" />}
              title="No recent activity"
              description="Automation runs and their outcomes will show up here."
            />
          </OverviewCard>

          <ActionQueue title="Keep momentum" icon={<Clock className="h-4 w-4" />} columns={2}>
            <ActionTile
              asChild
              icon={<XCircle className="h-5 w-5" />}
              count={failing.length}
              label="Failures to review"
              tone="danger"
            >
              <Link href="/automations?status=error" />
            </ActionTile>
            <ActionTile
              asChild
              icon={<Pause className="h-5 w-5" />}
              count={pausedCount}
              label="Paused automations"
              tone="neutral"
            >
              <Link href="/automations?status=paused" />
            </ActionTile>
          </ActionQueue>
        </div>
      </div>
    </div>
  );
}
