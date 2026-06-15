import Link from 'next/link';
import {
  AlertTriangle,
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
} from '../_components/overview-bits';

// CRM overview — the relationship manager's morning glance: who your customers
// are, what's in the pipeline, and what needs a call today. Headline KPIs and
// the customer-growth trend are wired to the live /v1/crm/reports/* endpoints
// (fail-soft to "—" / sample); the pipeline, leads-by-source, top customers,
// tasks, segments, and activity render representative data behind a
// <SampleBadge> until their reporting endpoints land (see overview-charts.tsx).

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

  const [snapshot, acquisition] = await Promise.all([
    api.get<CrmSnapshot>('/v1/crm/reports/snapshot').catch(() => null),
    api.get<AcquisitionPoint[]>('/v1/crm/reports/acquisition?months=12').catch(() => null),
  ]);

  // Customer growth — live from acquisition when present, else sample + badge.
  const growthLive = Array.isArray(acquisition) && acquisition.length > 0;
  const growthData = growthLive
    ? acquisition.map((p) => ({ label: monthLabel(p.month), value: p.newCustomers }))
    : SAMPLE_CRM_GROWTH_12W.map((p) => ({ label: p.label, value: p.new }));
  const growthSeriesKey = 'value';

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

        {/* Headline KPIs — Customers + open pipeline are live; new·30d + win
            rate await their report fields, so they show sample with a truthful hint. */}
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
            value="486"
            hint="Acquisition trend below is live"
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
            value="28%"
            hint="Won ÷ closed, last quarter"
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
              <span className="text-xs text-[var(--color-text-tertiary)]">
                Weighted value{' '}
                <span className="font-medium text-[var(--color-text-secondary)]">$42,400</span>
              </span>
              <SampleBadge />
            </div>
          }
        >
          <BarList
            items={SAMPLE_PIPELINE.map((s) => ({
              label: s.label,
              value: s.value,
              display: s.display,
            }))}
          />
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
              valueFormatter={(v) => fmtNumber(v)}
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
              valueFormatter={(v) => `${v}%`}
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
                {SAMPLE_TOP_CUSTOMERS.map((c) => (
                  <TableRow key={c.name}>
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
                    <TableCell className="text-right tabular-nums">{c.orders}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.ltv}</TableCell>
                    <TableCell className="text-right text-[var(--color-text-tertiary)] tabular-nums">
                      {c.last}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-3">
              <SampleBadge />
            </div>
          </OverviewCard>

          <OverviewCard
            title="Tasks due today"
            icon={<CheckSquare className="h-4 w-4" />}
            right={<CardLink href="/crm/tasks">All tasks</CardLink>}
          >
            {SAMPLE_TASKS.map((t) => (
              <OverviewRow
                key={t.title}
                icon={t.icon}
                tone={t.tone}
                title={t.title}
                hint={t.hint}
                right={
                  <Badge color={t.badgeColor} variant="soft">
                    {t.badge}
                  </Badge>
                }
              />
            ))}
            <div className="mt-3">
              <SampleBadge />
            </div>
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
              {SAMPLE_SEGMENTS.map((s) => (
                <MetricTile key={s.label} value={s.value} label={s.label} tone={s.tone} />
              ))}
            </div>
            <div className="mt-3">
              <SampleBadge />
            </div>
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
            description="Share of open pipeline value"
            right={<SampleBadge />}
          >
            <BarList
              items={SAMPLE_OPEN_DEALS.map((d) => ({
                label: d.label,
                value: d.value,
                display: d.display,
                color: d.color,
              }))}
            />
            <div className="mt-4 border-t border-[var(--color-border-default)] pt-3 text-xs text-[var(--color-text-tertiary)]">
              Open pipeline ·{' '}
              <span className="font-medium text-[var(--color-text-secondary)]">$42,400</span> across
              31 deals
            </div>
          </OverviewCard>
        </Grid>
      </Stack>
    </Container>
  );
}
