import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  Clipboard,
  Clock,
  Download,
  Mail,
  Phone,
  Plus,
  Tag,
  Target,
  TrendingUp,
  Users,
  Filter,
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
import { SAMPLE_CRM_GROWTH_12W } from '../_components/overview-charts';
import {
  CardLink,
  MetricTile,
  OverviewCard,
  OverviewRow,
  SampleBadge,
  fmtMoney,
  fmtNumber,
  liveOr,
  type MetricTone,
} from '../_components/overview-bits';

// CRM overview — the relationship manager's morning glance: who your customers
// are, what's in the pipeline, and what needs a call today. Headline KPIs, the
// customer-growth trend, the sales pipeline + open-deal split, top customers,
// tasks due today, and segment sizes are wired to the live /v1/crm/* endpoints
// (each falls back to "—" or a badged example via liveOr); leads-by-source and
// the activity feed render representative data behind a <SampleBadge> until
// their reporting endpoints land.

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

// Display rows shared by live + sample so liveOr can fall back cleanly.
interface PipelineBar {
  label: string;
  value: number;
  display: string;
}
interface OpenDealBar {
  label: string;
  value: number;
  display: string;
  color: string;
}
interface CustomerRow {
  name: string;
  type: string;
  orders: number;
  ltv: string;
  last: string;
  swatch: string;
  initials: string;
}
interface TaskRow {
  title: string;
  hint: string;
  badge: string;
  badgeColor: string;
  tone: string;
}
interface SegmentTile {
  value: string;
  label: string;
  tone: MetricTone;
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

const TYPE_LABEL: Record<string, string> = {
  b2b: 'Wholesale',
  retail: 'Retail',
  prospect: 'Prospect',
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

// ── Sample data (illustrative until the matching endpoints land) ──
const SAMPLE_PIPELINE = [
  { label: 'Lead', value: 142, display: '142 · $96k' },
  { label: 'Qualified', value: 98, display: '98 · $71k' },
  { label: 'Proposal', value: 54, display: '54 · $48k' },
  { label: 'Negotiation', value: 31, display: '31 · $29k' },
  { label: 'Won · 30d', value: 19, display: '19 · $22k' },
] as const;

const SAMPLE_LEAD_SOURCES = [
  { label: 'Storefront', value: 44, color: 'module' },
  { label: 'Wholesale form', value: 26, color: 'var(--module-active-tint)' },
  { label: 'Referral', value: 18, color: '#67e8f9' },
  { label: 'Import', value: 12, color: '#a5f3fc' },
] as const;

const SAMPLE_TOP_CUSTOMERS = [
  {
    name: 'Foglight Café',
    type: 'Wholesale',
    orders: 28,
    ltv: '$4,210',
    last: '2d ago',
    swatch: 'linear-gradient(135deg,#0891b2,#0e7490)',
    initials: 'FC',
  },
  {
    name: 'Maya Chen',
    type: 'Retail',
    orders: 14,
    ltv: '$612',
    last: '1d ago',
    swatch: 'linear-gradient(135deg,#7c3aed,#6d28d9)',
    initials: 'MC',
  },
  {
    name: 'Meridian Offices',
    type: 'Wholesale',
    orders: 19,
    ltv: '$3,840',
    last: '5d ago',
    swatch: 'linear-gradient(135deg,#0d9488,#0f766e)',
    initials: 'MO',
  },
  {
    name: 'Priya Nair',
    type: 'Retail',
    orders: 9,
    ltv: '$498',
    last: '3d ago',
    swatch: 'linear-gradient(135deg,#db2777,#be185d)',
    initials: 'PN',
  },
  {
    name: 'Harbor Grocery Co.',
    type: 'Wholesale',
    orders: 11,
    ltv: '$2,910',
    last: '1w ago',
    swatch: 'linear-gradient(135deg,#475569,#334155)',
    initials: 'HG',
  },
] as const;

const SAMPLE_TASKS = [
  {
    icon: <Phone className="h-4 w-4" />,
    tone: 'danger',
    title: 'Call Foglight Café re: reorder',
    hint: 'Owner · Jordan Reyes',
    badge: 'Overdue',
    badgeColor: 'danger',
  },
  {
    icon: <Mail className="h-4 w-4" />,
    tone: 'module',
    title: 'Email Q3 wholesale pricing to Meridian',
    hint: 'Meridian Offices',
    badge: 'Today',
    badgeColor: 'neutral',
  },
  {
    icon: <Clipboard className="h-4 w-4" />,
    tone: 'module',
    title: 'Follow up: Harbor Grocery quote',
    hint: 'Proposal · $2,400',
    badge: 'Today',
    badgeColor: 'neutral',
  },
  {
    icon: <Phone className="h-4 w-4" />,
    tone: 'module',
    title: 'Welcome call: 3 new VIPs',
    hint: 'Onboarding',
    badge: 'Today',
    badgeColor: 'neutral',
  },
] as const;

const SAMPLE_SEGMENTS = [
  { value: '142', label: 'VIP', tone: 'default' as const },
  { value: '89', label: 'At-risk', tone: 'warning' as const },
  { value: '486', label: 'New', tone: 'default' as const },
  { value: '64', label: 'Wholesale', tone: 'default' as const },
] as const;

const SAMPLE_ACTIVITY = [
  { title: 'New lead — Granite City Diner (Wholesale form)', when: '1 hour ago' },
  { title: 'Deal moved to Negotiation — Meridian Offices', when: '3 hours ago' },
  { title: 'You logged a call with Foglight Café', when: '6 hours ago' },
  { title: 'Sam Ortiz added a note to Maya Chen', when: '1 day ago' },
] as const;

const SAMPLE_OPEN_DEALS = [
  { label: 'Lead', value: 23, display: '23%', color: 'module' },
  { label: 'Qualified', value: 24, display: '24%', color: 'module' },
  { label: 'Proposal', value: 28, display: '28%', color: 'var(--module-active-tint)' },
  { label: 'Negotiation', value: 25, display: '25%', color: '#67e8f9' },
] as const;

const TYPE_BADGE: Record<string, string> = {
  Wholesale: 'neutral',
  Retail: 'module',
  Prospect: 'warning',
};

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

  const [snapshot, acquisition, pipelinesPage, topCustomersLive, todayTasksLive, segmentsPage] =
    await Promise.all([
      api.get<CrmSnapshot>('/v1/crm/reports/snapshot').catch(() => null),
      api.get<AcquisitionPoint[]>('/v1/crm/reports/acquisition?months=12').catch(() => null),
      api.getPaged<PipelineRow[]>('/v1/crm/pipelines?take=50').catch(() => null),
      api.get<CrmCustomer[]>('/v1/crm/customers/top?limit=5').catch(() => null),
      api.get<CrmTask[]>('/v1/crm/tasks/today').catch(() => null),
      api.getPaged<SegmentRow[]>('/v1/crm/segments?take=4').catch(() => null),
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

  // Customer growth — live from acquisition when present, else sample + badge.
  const growthLive = Array.isArray(acquisition) && acquisition.length > 0;
  const growthData = growthLive
    ? acquisition.map((p) => ({ label: monthLabel(p.month), value: p.newCustomers }))
    : SAMPLE_CRM_GROWTH_12W.map((p) => ({ label: p.label, value: p.new }));
  const growthSeriesKey = 'value';

  // New customers this month (latest acquisition point) + win rate (won ÷ closed).
  const newThisMonth = growthLive ? fmtNumber(acquisition.at(-1)?.newCustomers) : '—';
  const wl = winLoss?.reduce((a, r) => ({ won: a.won + r.won, lost: a.lost + r.lost }), {
    won: 0,
    lost: 0,
  });
  const winRate =
    wl && wl.won + wl.lost > 0 ? `${Math.round((wl.won / (wl.won + wl.lost)) * 100)}%` : '—';

  // Pipeline bars + open-deal split (share of open deals by stage).
  const pipelineRows = liveOr<PipelineBar[]>(
    funnel?.map((b) => ({
      label: b.stageName,
      value: b.count,
      display: `${fmtNumber(b.count)} · ${fmtMoney(b.totalValue)}`,
    })) ?? null,
    [...SAMPLE_PIPELINE]
  );
  const openBuckets = funnel?.filter((b) => b.stageType === 'open') ?? null;
  const openTotal = openBuckets?.reduce((s, b) => s + b.count, 0) ?? 0;
  const openDealsRows = liveOr<OpenDealBar[]>(
    openBuckets && openTotal > 0
      ? openBuckets.map((b, i) => {
          const pct = Math.round((b.count / openTotal) * 100);
          return {
            label: b.stageName,
            value: pct,
            display: `${pct}%`,
            color: OPEN_DEAL_COLORS[i % OPEN_DEAL_COLORS.length] ?? 'module',
          };
        })
      : null,
    [...SAMPLE_OPEN_DEALS]
  );

  // Top customers, tasks due today, segment sizes.
  const topCustomers = liveOr<CustomerRow[]>(
    topCustomersLive?.map((c, i) => {
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
    }) ?? null,
    [...SAMPLE_TOP_CUSTOMERS]
  );
  // Tasks due today — a successful fetch is trusted even when empty (a real
  // "all caught up" state), so it does NOT fall back to sample. Only a failed
  // fetch (null) shows a badged example.
  const liveTasks =
    todayTasksLive?.map((t) => {
      const meta = PRIORITY_META[t.priority] ?? {
        label: 'Today',
        color: 'neutral',
        tone: 'module',
      };
      return {
        title: t.title,
        hint: t.description ?? '',
        badge: meta.label,
        badgeColor: meta.color,
        tone: meta.tone,
      };
    }) ?? null;
  const tasksSample = liveTasks === null;
  const tasksEmpty = liveTasks !== null && liveTasks.length === 0;
  const taskRows: TaskRow[] = liveTasks ?? [...SAMPLE_TASKS];
  const segmentTiles = liveOr<SegmentTile[]>(
    segmentCounts?.map((s) => ({
      value: fmtNumber(s.count),
      label: s.name,
      tone: 'default' as const,
    })) ?? null,
    [...SAMPLE_SEGMENTS]
  );

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

        {/* Needs attention */}
        <ActionQueue
          title="Needs attention"
          icon={<AlertTriangle className="h-4 w-4" />}
          meta={<SampleBadge />}
        >
          <ActionTile
            asChild
            icon={<Phone className="h-5 w-5" />}
            count={7}
            label="Follow-ups due today"
            tone="module"
          >
            <Link href="/crm/tasks" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<Users className="h-5 w-5" />}
            count={5}
            label="Leads unassigned"
            tone="warning"
          >
            <Link href="/crm/leads" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<Clock className="h-5 w-5" />}
            count={4}
            label="Deals stalled 14+ days"
            tone="warning"
          >
            <Link href="/crm/pipelines" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<AlertTriangle className="h-5 w-5" />}
            count={3}
            label="Tasks overdue"
            tone="danger"
          >
            <Link href="/crm/tasks" />
          </ActionTile>
        </ActionQueue>

        {/* Sales pipeline */}
        <OverviewCard
          title="Sales pipeline"
          icon={<Filter className="h-4 w-4" />}
          right={
            <div className="flex items-center gap-3">
              {snapshot && (
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  Open value{' '}
                  <span className="font-medium text-[var(--color-text-secondary)]">
                    {fmtMoney(snapshot.pipelineValue)}
                  </span>
                </span>
              )}
              {pipelineRows.isSample && <SampleBadge reason="no-data" />}
            </div>
          }
        >
          <BarList items={pipelineRows.data} />
        </OverviewCard>

        {/* Customer growth (live) + Leads by source */}
        <div className={TWO_COL}>
          <OverviewCard
            title="Customer growth"
            icon={<TrendingUp className="h-4 w-4" />}
            description={
              growthLive
                ? 'New customers per month — last 12 months'
                : 'Total customers — last 12 weeks'
            }
            right={growthLive ? undefined : <SampleBadge />}
          >
            <AreaChart
              data={growthData}
              series={[
                {
                  key: growthSeriesKey,
                  label: growthLive ? 'New customers' : 'Customers',
                  color: 'module',
                },
              ]}
              xKey="label"
              height={210}
              valueFormat="number"
              ariaLabel="Customer growth trend"
            />
          </OverviewCard>

          <OverviewCard
            title="Leads by source"
            icon={<Target className="h-4 w-4" />}
            right={<SampleBadge />}
          >
            <DonutChart
              data={SAMPLE_LEAD_SOURCES.map((s) => ({
                label: s.label,
                value: s.value,
                color: s.color,
              }))}
              valueFormat="percent"
              centerValue="486"
              centerLabel="new leads"
              ariaLabel="Leads by source"
            />
          </OverviewCard>
        </div>

        {/* Top customers + Tasks due today */}
        <div className={TWO_COL_WIDE}>
          <OverviewCard
            title="Top customers"
            icon={<Users className="h-4 w-4" />}
            right={<CardLink href="/crm/customers">All customers</CardLink>}
          >
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
                {topCustomers.data.map((c, i) => (
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
                    <TableCell className="text-right tabular-nums">{fmtNumber(c.orders)}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.ltv}</TableCell>
                    <TableCell className="text-right text-[var(--color-text-tertiary)] tabular-nums">
                      {c.last}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {topCustomers.isSample && (
              <div className="mt-3">
                <SampleBadge reason="no-data" />
              </div>
            )}
          </OverviewCard>

          <OverviewCard
            title="Tasks due today"
            icon={<CheckSquare className="h-4 w-4" />}
            right={<CardLink href="/crm/tasks">All tasks</CardLink>}
          >
            {tasksEmpty ? (
              <div className="flex flex-col items-center gap-1.5 py-6 text-center">
                <CheckCircle2 className="h-6 w-6 text-[var(--color-success-text)]" />
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  All caught up
                </p>
                <p className="text-xs text-[var(--color-text-tertiary)]">No tasks due today.</p>
              </div>
            ) : (
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
            )}
            {tasksSample && (
              <div className="mt-3">
                <SampleBadge reason="no-data" />
              </div>
            )}
          </OverviewCard>
        </div>

        {/* Segments + Recent activity + Open deals by stage */}
        <Grid cols={1} mdCols={2} lgCols={3} gap={4}>
          <OverviewCard
            title="Segments"
            icon={<Tag className="h-4 w-4" />}
            right={<CardLink href="/crm/segments">Manage</CardLink>}
          >
            <div className="grid grid-cols-2 gap-3">
              {segmentTiles.data.map((s, i) => (
                <MetricTile key={`${s.label}-${i}`} value={s.value} label={s.label} tone={s.tone} />
              ))}
            </div>
            {segmentTiles.isSample && (
              <div className="mt-3">
                <SampleBadge reason="no-data" />
              </div>
            )}
          </OverviewCard>

          <OverviewCard
            title="Recent activity"
            icon={<Clock className="h-4 w-4" />}
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

          <OverviewCard
            title="Open deals by stage"
            icon={<Filter className="h-4 w-4" />}
            description="Share of open deals by stage"
            right={openDealsRows.isSample ? <SampleBadge reason="no-data" /> : undefined}
          >
            <BarList items={openDealsRows.data} />
            {snapshot && (
              <div className="mt-4 border-t border-[var(--color-border-default)] pt-3 text-xs text-[var(--color-text-tertiary)]">
                Open pipeline ·{' '}
                <span className="font-medium text-[var(--color-text-secondary)]">
                  {fmtMoney(snapshot.pipelineValue)}
                </span>{' '}
                across {fmtNumber(snapshot.openDeals)} deals
              </div>
            )}
          </OverviewCard>
        </Grid>
      </Stack>
    </Container>
  );
}
