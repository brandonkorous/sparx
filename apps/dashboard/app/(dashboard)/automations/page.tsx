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
// both consume) and fails soft to "—" / sample data per the overview archetype.

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
import {
  ActionQueue,
  ActionTile,
  AreaChart,
  Badge,
  Button,
  Card,
  Container,
  DonutChart,
  EmptyState,
  Grid,
  PageHeader,
  Stack,
  Stat,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Timeline,
  TimelineItem,
  TimelineTitle,
  TimelineTime,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import type { AutomationDto } from './_lib/types';
import { formatTimestamp, summarizeTrigger } from './_lib/presentation';
import {
  CardLink,
  MetricTile,
  OverviewCard,
  OverviewRow,
  SampleBadge,
  fmtNumber,
  fmtPercentRatio,
  liveOr,
} from '../_components/overview-bits';

export const dynamic = 'force-dynamic';

const TWO_COL = 'grid grid-cols-1 gap-4 lg:grid-cols-[1.9fr_1fr]';

// Run-activity timeseries (docs/97 §5) — `GET /v1/automations/reports/runs`,
// backed by the `rollup_automation_daily_runs` rollup. `liveOr` flips the chart
// to this sample (badged) only until the tenant has runs in the window.
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

// ── Sample data (fallback until the tenant has run history in the window) ──
const SAMPLE_RUNS_14D: { label: string; runs: number; failed: number }[] = [
  { label: 'Jun 1', runs: 184, failed: 3 },
  { label: 'Jun 2', runs: 201, failed: 2 },
  { label: 'Jun 3', runs: 176, failed: 5 },
  { label: 'Jun 4', runs: 232, failed: 4 },
  { label: 'Jun 5', runs: 248, failed: 2 },
  { label: 'Jun 6', runs: 221, failed: 6 },
  { label: 'Jun 7', runs: 168, failed: 1 },
  { label: 'Jun 8', runs: 197, failed: 3 },
  { label: 'Jun 9', runs: 263, failed: 4 },
  { label: 'Jun 10', runs: 281, failed: 2 },
  { label: 'Jun 11', runs: 254, failed: 7 },
  { label: 'Jun 12', runs: 298, failed: 3 },
  { label: 'Jun 13', runs: 312, failed: 2 },
  { label: 'Jun 14', runs: 289, failed: 4 },
];

const SAMPLE_ACTIVITY = [
  { title: 'New customer welcome — sent welcome email to Maya Chen', when: '8 minutes ago' },
  {
    title: 'Overdue invoice escalation — credit-hold applied to Foglight Café',
    when: '41 minutes ago',
  },
  { title: 'Abandoned cart nudge — failed: email template not found', when: '2 hours ago' },
  { title: 'VIP tag on $500+ order — tagged 4 customers', when: '5 hours ago' },
] as const;

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
      <Container size="full">
        <Stack gap={6} className="py-10">
          <PageHeader
            icon={<Zap className="h-5 w-5" />}
            title="Automations"
            description="Cross-module “when X, if Y, do Z” rules that connect your sparx modules."
          />
          <Card padding="none">
            <EmptyState
              icon={<Zap className="h-5 w-5" />}
              title="Activate a module first"
              description="Automations connect your modules — activate at least one to start authoring rules."
              action={
                <Button asChild color="module">
                  <Link href="/settings/modules">Add a module</Link>
                </Button>
              }
            />
          </Card>
        </Stack>
      </Container>
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
  // failed} shape, gated on real volume in the window. Falls back to the badged
  // sample until the tenant has runs.
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
  const runs14d = liveOr(runsPoints, SAMPLE_RUNS_14D);
  const runs14dTotal = runsTs?.totals.runsCount ?? 0;
  const runs14dSuccess = runsTs?.totals.successRate ?? 0;

  // Table: every automation, busiest first (preserves the old list — show all).
  const tableRows = [...rules].sort((a, b) => (b.runCount ?? 0) - (a.runCount ?? 0));

  return (
    <Container size="xl">
      <Stack gap={6} className="py-8">
        <PageHeader
          icon={<Zap className="h-5 w-5" />}
          title="Automations"
          description="Is it working & saving you time? — run health across your rules."
          actions={
            canWrite ? (
              <>
                <Button asChild variant="outline" leftIcon={<ListChecks className="h-4 w-4" />}>
                  <Link href="/automations/new">Browse templates</Link>
                </Button>
                <Button asChild color="module" leftIcon={<Plus className="h-4 w-4" />}>
                  <Link href="/automations/new">New automation</Link>
                </Button>
              </>
            ) : undefined
          }
        />

        {/* Headline KPIs — live from the rule set */}
        <Grid cols={1} mdCols={2} lgCols={4} gap={4}>
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
        </Grid>

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
                    <Button asChild variant="link" color="module" size="sm">
                      <Link href={`/automations/${a.id}`}>{failed ? 'Review' : 'Resume'}</Link>
                    </Button>
                  }
                />
              );
            })
          )}
        </OverviewCard>

        {/* Run activity over time (sample) + by-trigger split (live) */}
        <div className={TWO_COL}>
          <OverviewCard
            title="Run activity"
            icon={<TrendingUp className="h-4 w-4" />}
            description="Runs per day — last 14 days"
            right={runs14d.isSample ? <SampleBadge reason="no-data" /> : undefined}
          >
            <AreaChart
              data={runs14d.data}
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
              <MetricTile
                value={runs14d.isSample ? '~3.4k' : fmtNumber(runs14dTotal)}
                label="Runs · 14d"
              />
              {runs14d.isSample ? (
                <MetricTile value="~6h" label="Est. time saved · 14d" tone="module" />
              ) : (
                <MetricTile value={`${runs14dSuccess}%`} label="Success rate · 14d" tone="module" />
              )}
            </div>
            {runs14d.isSample ? (
              <div className="mt-3">
                <SampleBadge />
              </div>
            ) : null}
          </OverviewCard>

          <OverviewCard
            title="By trigger"
            icon={<Zap className="h-4 w-4" />}
            description="How your rules are triggered"
          >
            {triggerData.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--color-text-tertiary)]">
                No automations to group yet.
              </p>
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
        >
          {tableRows.length === 0 ? (
            <EmptyState
              icon={<Zap className="h-5 w-5" />}
              title="No automations yet"
              description="Create your first rule to trigger actions when events happen across your modules."
              action={
                canWrite ? (
                  <Button asChild color="module" leftIcon={<Plus className="h-4 w-4" />}>
                    <Link href="/automations/new">New automation</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Automation</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead className="text-right">Runs</TableHead>
                  <TableHead className="text-right">Success</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableRows.map((a) => {
                  const rate = successRate(a.runCount ?? 0, a.errorCount ?? 0);
                  const status = ROW_STATUS[a.status] ?? ROW_STATUS.draft;
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Link
                          href={`/automations/${a.id}`}
                          className="font-medium hover:text-[var(--module-active)] hover:underline"
                        >
                          {a.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-[var(--color-text-secondary)]">
                        {summarizeTrigger(a.triggerType, a.triggerConfig)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtNumber(a.runCount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {rate == null ? '—' : fmtPercentRatio(rate, 0)}
                      </TableCell>
                      <TableCell>
                        <Badge color={status.color} variant="soft">
                          {status.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </OverviewCard>

        {/* Daily action queue + recent activity */}
        <div className={TWO_COL}>
          <OverviewCard
            title="Recent activity"
            icon={<History className="h-4 w-4" />}
            right={<SampleBadge />}
          >
            <Timeline>
              {SAMPLE_ACTIVITY.map((a, i) => (
                <TimelineItem key={a.title} showConnector={i < SAMPLE_ACTIVITY.length - 1}>
                  <TimelineTitle>{a.title}</TimelineTitle>
                  <TimelineTime>{a.when}</TimelineTime>
                </TimelineItem>
              ))}
            </Timeline>
          </OverviewCard>

          <ActionQueue
            title="Keep momentum"
            icon={<Clock className="h-4 w-4" />}
            meta={<SampleBadge />}
          >
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
            <ActionTile
              asChild
              icon={<Plus className="h-5 w-5" />}
              count={3}
              label="Templates to try"
              tone="module"
            >
              <Link href="/automations/new" />
            </ActionTile>
          </ActionQueue>
        </div>
      </Stack>
    </Container>
  );
}
