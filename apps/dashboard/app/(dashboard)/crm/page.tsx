import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  Clock,
  Download,
  Filter,
  Plus,
  Tag,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';

import { requireSession } from '@sparx/auth';
import {
  ActionQueue,
  ActionTile,
  AreaChart,
  Badge,
  BarList,
  Button,
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
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import {
  CardLink,
  MetricTile,
  OverviewCard,
  OverviewRow,
  fmtMoney,
  fmtNumber,
} from '../_components/overview-bits';

// CRM overview — the relationship manager's morning glance: who your customers
// are, what's in the pipeline, and what needs a call today. Every section is
// wired to the live /v1/crm/* endpoints; a section with no data yet renders a
// compact empty state rather than illustrative sample data.

export const dynamic = 'force-dynamic';

const TWO_COL = 'grid grid-cols-1 gap-4 lg:grid-cols-[1.9fr_1fr]';
const TWO_COL_WIDE = 'grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]';

interface CrmSnapshot {
  customers: number;
  b2bAccounts: number;
  openDeals: number;
  pipelineValue: number;
  openTasks: number;
  overdueTasks: number;
  activeSegments: number;
}

interface AcquisitionPoint {
  month: string; // yyyy-mm
  newCustomers: number;
}

// ── Live shapes from /v1/crm/* ───────────────────────────────
interface PipelineRow {
  id: string;
  name: string;
  isDefault: boolean;
}
interface FunnelBucket {
  stageId: string;
  stageName: string;
  stageType: string; // 'open' | 'won' | 'lost'
  count: number;
  totalValue: number;
}
interface WinLossRow {
  won: number;
  lost: number;
}
interface CrmCustomer {
  type: string; // 'prospect' | 'retail' | 'b2b'
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
  totalSpent: string; // Decimal serialized as a string
  orderCount: number;
  lastOrderAt: string | null;
}
interface CrmTask {
  title: string;
  description: string | null;
  priority: string; // 'low' | 'medium' | 'high' | 'urgent'
}
interface SegmentRow {
  id: string;
  name: string;
}
interface LeadSourceRow {
  source: string;
  label: string;
  count: number;
  sharePct: number;
}
interface LeadsBySource {
  rangeLabel: string;
  totalLeads: number;
  bySource: LeadSourceRow[];
}
interface TaskMetrics {
  open: number;
  overdue: number;
  dueToday: number;
  completedLast30d: number;
  byPriority: { low: number; medium: number; high: number; urgent: number };
}

const CUSTOMER_SWATCHES = [
  'linear-gradient(135deg,#0891b2,#0e7490)',
  'linear-gradient(135deg,#7c3aed,#6d28d9)',
  'linear-gradient(135deg,#0d9488,#0f766e)',
  'linear-gradient(135deg,#db2777,#be185d)',
  'linear-gradient(135deg,#475569,#334155)',
] as const;
const OPEN_DEAL_COLORS = [
  'module',
  'module',
  'var(--module-active-tint)',
  '#67e8f9',
  '#a5f3fc',
] as const;
// Cyan donut palette (CRM module color + tints) for the lead-source split.
const SOURCE_COLORS = ['module', 'var(--module-active-tint)', '#67e8f9', '#a5f3fc', '#cffafe'];

const TYPE_LABEL: Record<string, string> = {
  b2b: 'Wholesale',
  retail: 'Retail',
  prospect: 'Prospect',
};
const TYPE_BADGE: Record<string, string> = {
  Wholesale: 'neutral',
  Retail: 'module',
  Prospect: 'warning',
};
const PRIORITY_META: Record<string, { label: string; color: string; tone: string }> = {
  urgent: { label: 'Urgent', color: 'danger', tone: 'danger' },
  high: { label: 'High', color: 'warning', tone: 'warning' },
  medium: { label: 'Today', color: 'neutral', tone: 'module' },
  low: { label: 'Today', color: 'neutral', tone: 'module' },
};

function customerName(c: CrmCustomer): string {
  const candidates = [c.company, [c.firstName, c.lastName].filter(Boolean).join(' '), c.email];
  for (const v of candidates) {
    const s = v?.trim();
    if (s) return s;
  }
  return 'Unknown';
}
function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '–';
}
// Relative "time ago" for the last-order column (request-time, so dynamic).
function relTime(iso: string | null): string {
  if (!iso) return '—';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return '1d ago';
  if (days < 7) return `${days}d ago`;
  if (days < 35) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// yyyy-mm → "Mon" for a compact x-axis label.
const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
function monthLabel(yyyymm: string): string {
  const m = Number(yyyymm.slice(5, 7));
  return MONTH_LABELS[m - 1] ?? yyyymm;
}

export default async function CrmOverviewPage() {
  await requireSession();

  const [
    snapshot,
    acquisition,
    pipelinesPage,
    topCustomersLive,
    todayTasksLive,
    segmentsPage,
    leadsSrc,
    taskStats,
  ] = await Promise.all([
    api.get<CrmSnapshot>('/v1/crm/reports/snapshot').catch(() => null),
    api.get<AcquisitionPoint[]>('/v1/crm/reports/acquisition?months=12').catch(() => null),
    api.getPaged<PipelineRow[]>('/v1/crm/pipelines?take=50').catch(() => null),
    api.get<CrmCustomer[]>('/v1/crm/customers/top?limit=5').catch(() => null),
    api.get<CrmTask[]>('/v1/crm/tasks/today').catch(() => null),
    api.getPaged<SegmentRow[]>('/v1/crm/segments?take=4').catch(() => null),
    api.get<LeadsBySource>('/v1/crm/reports/leads-by-source').catch(() => null),
    api.get<TaskMetrics>('/v1/crm/reports/tasks').catch(() => null),
  ]);

  const defaultPipeline =
    pipelinesPage?.data.find((p) => p.isDefault) ?? pipelinesPage?.data[0] ?? null;
  const segmentList = segmentsPage?.data ?? null;

  // Pipeline funnel + win/loss (both need a pipeline id) and segment member
  // counts resolve in a second parallel wave.
  const [funnel, winLoss, segmentCounts] = await Promise.all([
    defaultPipeline
      ? api
          .get<FunnelBucket[]>(`/v1/crm/reports/pipeline-funnel?pipeline_id=${defaultPipeline.id}`)
          .catch(() => null)
      : Promise.resolve(null),
    defaultPipeline
      ? api
          .get<WinLossRow[]>(`/v1/crm/reports/win-loss?pipeline_id=${defaultPipeline.id}`)
          .catch(() => null)
      : Promise.resolve(null),
    segmentList
      ? Promise.all(
          segmentList.map(async (s) => {
            const mc = await api
              .get<{ total: number }>(`/v1/crm/segments/${s.id}/member-count`)
              .catch(() => null);
            return { name: s.name, count: mc?.total ?? 0 };
          })
        )
      : Promise.resolve(null),
  ]);

  // Customer growth — new customers per month from the acquisition report.
  const growthData = (acquisition ?? []).map((p) => ({
    label: monthLabel(p.month),
    value: p.newCustomers,
  }));
  const hasGrowth = growthData.length > 0;
  const newThisMonth = hasGrowth ? fmtNumber(growthData.at(-1)?.value) : '—';

  // Win rate (won ÷ closed) from the win/loss report.
  const wl = winLoss?.reduce((a, r) => ({ won: a.won + r.won, lost: a.lost + r.lost }), {
    won: 0,
    lost: 0,
  });
  const winRate =
    wl && wl.won + wl.lost > 0 ? `${Math.round((wl.won / (wl.won + wl.lost)) * 100)}%` : '—';

  // Pipeline bars + open-deal split (share of open deals by stage).
  const pipelineRows = (funnel ?? []).map((b) => ({
    label: b.stageName,
    value: b.count,
    display: `${fmtNumber(b.count)} · ${fmtMoney(b.totalValue)}`,
  }));
  const openBuckets = funnel?.filter((b) => b.stageType === 'open') ?? [];
  const openTotal = openBuckets.reduce((s, b) => s + b.count, 0);
  const openDealsRows =
    openTotal > 0
      ? openBuckets.map((b, i) => {
          const pct = Math.round((b.count / openTotal) * 100);
          return {
            label: b.stageName,
            value: pct,
            display: `${pct}%`,
            color: OPEN_DEAL_COLORS[i % OPEN_DEAL_COLORS.length] ?? 'module',
          };
        })
      : [];

  // Top customers, tasks due today, segment sizes — live or empty.
  const topCustomers = (topCustomersLive ?? []).map((c, i) => {
    const name = customerName(c);
    return {
      name,
      type: TYPE_LABEL[c.type] ?? c.type,
      orders: c.orderCount,
      ltv: fmtMoney(Number(c.totalSpent)),
      last: relTime(c.lastOrderAt),
      swatch: CUSTOMER_SWATCHES[i % CUSTOMER_SWATCHES.length] ?? CUSTOMER_SWATCHES[0],
      initials: initialsOf(name),
    };
  });

  // Leads by source — once any leads exist in the window.
  const leadSourceData =
    leadsSrc && leadsSrc.totalLeads > 0
      ? leadsSrc.bySource.map((s, i) => ({
          label: s.label,
          value: s.count,
          color: SOURCE_COLORS[i % SOURCE_COLORS.length],
        }))
      : null;

  // Tasks due today — an empty (or failed) fetch shows the "all caught up" state.
  const taskRows = (todayTasksLive ?? []).map((t) => {
    const meta = PRIORITY_META[t.priority] ?? { label: 'Today', color: 'neutral', tone: 'module' };
    return {
      title: t.title,
      hint: t.description ?? '',
      badge: meta.label,
      badgeColor: meta.color,
      tone: meta.tone,
    };
  });

  const segmentTiles = (segmentCounts ?? []).map((s) => ({
    value: fmtNumber(s.count),
    label: s.name,
  }));

  return (
    <Container size="xl">
      <Stack gap={6} className="py-8">
        <PageHeader
          icon={<Users className="h-5 w-5" />}
          title="CRM"
          description="Customers & pipeline — last 30 days."
          actions={
            <>
              <Button asChild variant="outline" leftIcon={<Download className="h-4 w-4" />}>
                <Link href="/crm/import">Import</Link>
              </Button>
              <Button asChild variant="outline" leftIcon={<CheckSquare className="h-4 w-4" />}>
                <Link href="/crm/tasks/new">New task</Link>
              </Button>
              <Button asChild color="module" leftIcon={<Plus className="h-4 w-4" />}>
                <Link href="/crm/customers/new">Add customer</Link>
              </Button>
            </>
          }
        />

        {/* Headline KPIs — all live: customers + open pipeline from the snapshot,
            new·30d from acquisition, win rate from the win/loss report. */}
        <Grid cols={1} mdCols={2} lgCols={4} gap={4}>
          <Stat
            icon={<Users className="h-4 w-4" />}
            label="Customers"
            value={fmtNumber(snapshot?.customers)}
            hint="Across all types"
          />
          <Stat
            icon={<Plus className="h-4 w-4" />}
            label="New · 30d"
            value={newThisMonth}
            hint="Newest month of acquisition"
          />
          <Stat
            icon={<Filter className="h-4 w-4" />}
            label="Open pipeline"
            value={snapshot ? fmtMoney(snapshot.pipelineValue) : '—'}
            hint={snapshot ? `${fmtNumber(snapshot.openDeals)} active deals` : 'No open deals yet'}
          />
          <Stat
            icon={<Target className="h-4 w-4" />}
            label="Win rate"
            value={winRate}
            hint="Won ÷ closed deals"
          />
        </Grid>

        {/* Needs attention — wired to the live task metrics. */}
        {taskStats && (
          <ActionQueue
            title="Needs attention"
            icon={<AlertTriangle className="h-4 w-4" />}
            columns={2}
          >
            <ActionTile
              asChild
              icon={<CheckSquare className="h-5 w-5" />}
              count={fmtNumber(taskStats.dueToday)}
              label="Tasks due today"
              tone="module"
            >
              <Link href="/crm/tasks" />
            </ActionTile>
            <ActionTile
              asChild
              icon={<AlertTriangle className="h-5 w-5" />}
              count={fmtNumber(taskStats.overdue)}
              label="Tasks overdue"
              tone="danger"
            >
              <Link href="/crm/tasks" />
            </ActionTile>
          </ActionQueue>
        )}

        {/* Sales pipeline — the CRM overview's primary (tinted) card. */}
        <OverviewCard
          title="Sales pipeline"
          icon={<Filter className="h-4 w-4" />}
          right={
            snapshot ? (
              <span className="text-xs text-[var(--color-text-tertiary)]">
                Open value{' '}
                <span className="font-medium text-[var(--color-text-secondary)]">
                  {fmtMoney(snapshot.pipelineValue)}
                </span>
              </span>
            ) : undefined
          }
        >
          {pipelineRows.length ? (
            <BarList items={pipelineRows} />
          ) : (
            <EmptyState
              icon={<Filter className="h-5 w-5" />}
              title="No pipeline activity yet"
              description="Deals appear here as they move through your stages."
            />
          )}
        </OverviewCard>

        {/* Customer growth + Leads by source */}
        <div className={TWO_COL}>
          <OverviewCard
            title="Customer growth"
            icon={<TrendingUp className="h-4 w-4" />}
            description={hasGrowth ? 'New customers per month — last 12 months' : undefined}
            plain
          >
            {hasGrowth ? (
              <AreaChart
                data={growthData}
                series={[{ key: 'value', label: 'New customers', color: 'module' }]}
                xKey="label"
                height={210}
                valueFormat="number"
                ariaLabel="Customer growth trend"
              />
            ) : (
              <EmptyState
                icon={<TrendingUp className="h-5 w-5" />}
                title="No customer growth yet"
                description="As customers sign up, monthly growth shows here."
              />
            )}
          </OverviewCard>

          <OverviewCard
            title="Leads by source"
            icon={<Target className="h-4 w-4" />}
            description="New customers by acquisition source · last 90 days"
            plain
          >
            {leadSourceData ? (
              <DonutChart
                data={leadSourceData}
                valueFormat="number"
                centerValue={fmtNumber(leadsSrc?.totalLeads)}
                centerLabel="new leads"
                ariaLabel="Leads by source"
              />
            ) : (
              <EmptyState
                icon={<Target className="h-5 w-5" />}
                title="No leads yet"
                description="Lead sources appear as new customers arrive."
              />
            )}
            {taskStats && (
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--color-border-default)] pt-3 text-xs">
                {[
                  ['Open tasks', fmtNumber(taskStats.open)],
                  ['Overdue', fmtNumber(taskStats.overdue)],
                  ['Done · 30d', fmtNumber(taskStats.completedLast30d)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="text-[var(--color-text-tertiary)]">{label}</div>
                    <div className="font-medium text-[var(--color-text-secondary)]">{value}</div>
                  </div>
                ))}
              </div>
            )}
          </OverviewCard>
        </div>

        {/* Top customers + Tasks due today */}
        <div className={TWO_COL_WIDE}>
          <OverviewCard
            title="Top customers"
            icon={<Users className="h-4 w-4" />}
            right={<CardLink href="/crm/customers">All customers</CardLink>}
            plain
          >
            {topCustomers.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Lifetime value</TableHead>
                    <TableHead className="text-right">Last order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCustomers.map((c, i) => (
                    <TableRow key={`${c.name}-${i}`}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <span
                            aria-hidden
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-medium text-white"
                            style={{ background: c.swatch }}
                          >
                            {c.initials}
                          </span>
                          <span className="font-medium">{c.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge color={TYPE_BADGE[c.type]} variant="soft">
                          {c.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtNumber(c.orders)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c.ltv}</TableCell>
                      <TableCell className="text-right text-[var(--color-text-tertiary)] tabular-nums">
                        {c.last}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                icon={<Users className="h-5 w-5" />}
                title="No customers yet"
                description="Your highest-value customers will rank here."
                action={
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/crm/customers/new">Add customer</Link>
                  </Button>
                }
              />
            )}
          </OverviewCard>

          <OverviewCard
            title="Tasks due today"
            icon={<CheckSquare className="h-4 w-4" />}
            right={<CardLink href="/crm/tasks">All tasks</CardLink>}
            plain
          >
            {taskRows.length ? (
              taskRows.map((t, i) => (
                <OverviewRow
                  key={`${t.title}-${i}`}
                  icon={<CheckSquare className="h-4 w-4" />}
                  tone={t.tone}
                  title={t.title}
                  hint={t.hint}
                  right={
                    <Badge color={t.badgeColor} variant="soft">
                      {t.badge}
                    </Badge>
                  }
                />
              ))
            ) : (
              <EmptyState
                icon={<CheckCircle2 className="h-5 w-5" />}
                title="All caught up"
                description="No tasks due today."
              />
            )}
          </OverviewCard>
        </div>

        {/* Segments + Recent activity + Open deals by stage */}
        <Grid cols={1} mdCols={2} lgCols={3} gap={4}>
          <OverviewCard
            title="Segments"
            icon={<Tag className="h-4 w-4" />}
            right={<CardLink href="/crm/segments">Manage</CardLink>}
            plain
          >
            {segmentTiles.length ? (
              <div className="grid grid-cols-2 gap-3">
                {segmentTiles.map((s, i) => (
                  <MetricTile key={`${s.label}-${i}`} value={s.value} label={s.label} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Tag className="h-5 w-5" />}
                title="No segments yet"
                description="Group customers into segments to target them."
                action={
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/crm/segments">Create segment</Link>
                  </Button>
                }
              />
            )}
          </OverviewCard>

          <OverviewCard title="Recent activity" icon={<Clock className="h-4 w-4" />} plain>
            <EmptyState
              icon={<Clock className="h-5 w-5" />}
              title="No recent activity"
              description="Customer and deal updates will show up here."
            />
          </OverviewCard>

          <OverviewCard
            title="Open deals by stage"
            icon={<Filter className="h-4 w-4" />}
            description="Share of open deals by stage"
            plain
          >
            {openDealsRows.length ? (
              <>
                <BarList items={openDealsRows} />
                {snapshot && (
                  <div className="mt-4 border-t border-[var(--color-border-default)] pt-3 text-xs text-[var(--color-text-tertiary)]">
                    Open pipeline ·{' '}
                    <span className="font-medium text-[var(--color-text-secondary)]">
                      {fmtMoney(snapshot.pipelineValue)}
                    </span>{' '}
                    across {fmtNumber(snapshot.openDeals)} deals
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                icon={<Filter className="h-5 w-5" />}
                title="No open deals"
                description="Active deals split by stage will show here."
              />
            )}
          </OverviewCard>
        </Grid>
      </Stack>
    </Container>
  );
}
