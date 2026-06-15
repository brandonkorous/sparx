import Link from 'next/link';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Package,
  Percent,
  Plus,
  Receipt,
  Tag,
  TrendingUp,
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
  TimelineTime,
  TimelineTitle,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import {
  CardLink,
  OverviewCard,
  OverviewRow,
  SampleBadge,
  fmtNumber,
} from '../_components/overview-bits';

// B2B overview — the wholesale book at a glance: revenue pulse, the daily
// action queue, A/R aging (the signature cashflow-risk card), open quotes, and
// the account roster. The active-accounts count is wired live to
// /v1/b2b/accounts (meta.total, fail-soft to "—"); everything else renders
// representative data behind a <SampleBadge> until the matching B2B reporting
// endpoints land. Warm colors (amber/red) stay strictly semantic here —
// reserved for overdue invoices, expiring quotes, and aging risk.

export const dynamic = 'force-dynamic';

// The A/R aging card sits on the LEFT and is narrower than the revenue chart.
const AGING_ROW = 'grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.9fr]';
const QUOTES_ROW = 'grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]';

interface AccountsMeta {
  total?: number;
}

// ── Sample data (illustrative until the matching B2B endpoints land) ──

const SAMPLE_WHOLESALE_REVENUE_14D = [
  { label: 'May 31', revenue: 5120 },
  { label: 'Jun 1', revenue: 4980 },
  { label: 'Jun 2', revenue: 6240 },
  { label: 'Jun 3', revenue: 5860 },
  { label: 'Jun 4', revenue: 6580 },
  { label: 'Jun 5', revenue: 6010 },
  { label: 'Jun 6', revenue: 7340 },
  { label: 'Jun 7', revenue: 6720 },
  { label: 'Jun 8', revenue: 8210 },
  { label: 'Jun 9', revenue: 7480 },
  { label: 'Jun 10', revenue: 9120 },
  { label: 'Jun 11', revenue: 8460 },
  { label: 'Jun 12', revenue: 10240 },
  { label: 'Jun 14', revenue: 9680 },
] as const;

// A/R aging buckets — risk escalates current → 60+, so the fill goes
// module → warning → danger (semantic warm use).
const SAMPLE_AGING = [
  { label: 'Current', value: 34200, display: '$34,200', color: 'module' },
  { label: '1–30 days', value: 11400, display: '$11,400', color: 'module' },
  { label: '31–60 days', value: 4100, display: '$4,100', color: 'warning' },
  { label: '60+ days', value: 2400, display: '$2,400', color: 'danger' },
] as const;

const SAMPLE_QUOTES = [
  {
    id: 'Q-318',
    account: 'Foglight Café',
    value: '$2,840',
    sent: 'Jun 12',
    expires: 'Jun 19',
    status: 'Sent',
    tone: 'warning',
  },
  {
    id: 'Q-317',
    account: 'Meridian Offices',
    value: '$5,210',
    sent: 'Jun 10',
    expires: 'Jun 17',
    status: 'Viewed',
    tone: 'success',
  },
  {
    id: 'Q-315',
    account: 'Harbor Grocery Co.',
    value: '$8,900',
    sent: 'Jun 8',
    expires: 'Jun 15',
    status: 'Sent',
    tone: 'warning',
  },
  {
    id: 'Q-314',
    account: 'Tideline Coffee Club',
    value: '$1,620',
    sent: 'Jun 6',
    expires: 'Jun 13',
    status: 'Expiring',
    tone: 'danger',
  },
  {
    id: 'Q-311',
    account: 'Granite City Diner',
    value: '$3,400',
    sent: 'Jun 3',
    expires: 'Jun 10',
    status: 'Draft',
    tone: 'neutral',
  },
] as const;

const SAMPLE_TOP_ACCOUNTS = [
  { name: 'Foglight Café', tier: 'Gold', terms: 'Net 30 · 14 orders', spend: '$12,400' },
  { name: 'Meridian Offices', tier: 'Gold', terms: 'Net 30 · 11 orders', spend: '$9,800' },
  { name: 'Harbor Grocery Co.', tier: 'Silver', terms: 'Net 45 · 9 orders', spend: '$7,100' },
  { name: 'Tideline Coffee Club', tier: 'Silver', terms: 'Net 15 · 7 orders', spend: '$4,900' },
] as const;

const SAMPLE_APPLICATIONS = [
  { name: 'Granite City Diner', meta: 'Applied Jun 12 · Net 30 requested', action: 'Approve' },
  { name: 'Eastside Bakehouse', meta: 'Applied Jun 11 · Wholesale tier', action: 'Review' },
  { name: 'Cloudpeak Catering', meta: 'Applied Jun 9 · Distributor tier', action: 'Review' },
] as const;

const SAMPLE_TIERS = [
  { name: 'Wholesale', accounts: '38 accounts', discount: '−30%' },
  { name: 'Distributor', accounts: '9 accounts', discount: '−40%' },
  { name: 'Office / Corporate', accounts: '17 accounts', discount: '−20%' },
] as const;

const SAMPLE_ACTIVITY = [
  { title: 'New PO — Foglight Café ($2,840)', when: '2 hours ago', muted: false },
  { title: 'Invoice paid — Meridian Offices ($5,210)', when: '5 hours ago', muted: false },
  { title: 'Quote viewed — Harbor Grocery Co.', when: '1 day ago', muted: true },
  { title: 'You approved Tideline Coffee Club', when: '2 days ago', muted: false },
] as const;

const QUOTE_TONE: Record<string, string> = {
  warning: 'warning',
  success: 'success',
  danger: 'danger',
  neutral: 'neutral',
};

export default async function B2bPage() {
  await requireSession();

  // Live: total active wholesale accounts. We only need the count, so ask for a
  // single row and read meta.total (paged() puts total directly on meta).
  const accounts = await api
    .getPaged<unknown[]>('/v1/b2b/accounts?take=1')
    .then((r) => r.meta as AccountsMeta)
    .catch(() => null);
  const activeAccounts = accounts?.total;

  return (
    <Container size="xl">
      <Stack gap={6} className="py-8">
        <PageHeader
          icon={<Building2 className="h-5 w-5" />}
          title="B2B"
          description="Wholesale & accounts — last 30 days."
          actions={
            <>
              <Button asChild variant="outline" leftIcon={<Tag className="h-4 w-4" />}>
                <Link href="/b2b/price-lists">Price lists</Link>
              </Button>
              <Button asChild variant="outline" leftIcon={<FileText className="h-4 w-4" />}>
                <Link href="/b2b/quotes/new">New quote</Link>
              </Button>
              <Button asChild color="module" leftIcon={<Plus className="h-4 w-4" />}>
                <Link href="/b2b/accounts/new">New account</Link>
              </Button>
            </>
          }
        />

        {/* Headline KPIs — active accounts live, the rest sampled */}
        <Grid cols={1} mdCols={2} lgCols={4} gap={4}>
          <Stat
            icon={<DollarSign className="h-4 w-4" />}
            label="Wholesale revenue · 30d"
            value="$86,400"
            hint="Net wholesale sales"
          />
          <Stat
            icon={<Building2 className="h-4 w-4" />}
            label="Active accounts"
            value={activeAccounts != null ? fmtNumber(activeAccounts) : '64'}
            hint="+4 this month"
          />
          <Stat
            icon={<FileText className="h-4 w-4" />}
            label="Open quotes"
            value="$38,200"
            hint="12 quotes outstanding"
          />
          <Stat
            icon={<Package className="h-4 w-4" />}
            label="Avg. order value"
            value="$1,340"
            hint="Across wholesale orders"
          />
        </Grid>

        {/* Daily action queue */}
        <ActionQueue
          title="Needs attention"
          icon={<AlertTriangle className="h-4 w-4" />}
          meta={<SampleBadge />}
        >
          <ActionTile
            asChild
            icon={<FileText className="h-5 w-5" />}
            count={6}
            label="Quotes awaiting response"
            tone="module"
          >
            <Link href="/b2b/quotes" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<Receipt className="h-5 w-5" />}
            count={5}
            label="Invoices overdue"
            tone="danger"
          >
            <Link href="/b2b/invoices" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<Building2 className="h-5 w-5" />}
            count={3}
            label="Applications to approve"
            tone="warning"
          >
            <Link href="/b2b/applications" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<Package className="h-5 w-5" />}
            count={4}
            label="Reorders due"
            tone="module"
          >
            <Link href="/b2b/orders" />
          </ActionTile>
        </ActionQueue>

        {/* Accounts receivable / aging (signature) + wholesale revenue chart */}
        <div className={AGING_ROW}>
          <OverviewCard
            title="Accounts receivable"
            icon={<Receipt className="h-4 w-4" />}
            description="Outstanding by age"
            right={<SampleBadge />}
          >
            <p className="text-[1.65rem] leading-none font-medium">$52,100</p>
            <p className="mt-1.5 mb-4 text-sm text-[var(--color-text-tertiary)]">
              Outstanding across{' '}
              <span className="text-[var(--color-text-secondary)]">31 invoices</span>
            </p>
            <BarList
              items={SAMPLE_AGING.map((b) => ({
                label: b.label,
                value: b.value,
                display: b.display,
                color: b.color,
              }))}
            />
            <div className="mt-4 flex items-center gap-2 border-t border-[var(--color-border-default)] pt-3">
              <AlertTriangle aria-hidden className="h-4 w-4 text-[var(--color-danger-text)]" />
              <span className="text-xs text-[var(--color-text-tertiary)]">
                <span className="font-medium text-[var(--color-danger-text)]">5 past due</span> ·
                oldest 74 days
              </span>
            </div>
          </OverviewCard>

          <OverviewCard
            title="Wholesale revenue"
            icon={<TrendingUp className="h-4 w-4" />}
            description="Net wholesale sales · last 14 days"
            right={<SampleBadge />}
          >
            <AreaChart
              data={[...SAMPLE_WHOLESALE_REVENUE_14D]}
              series={[{ key: 'revenue', label: 'Revenue', color: 'module' }]}
              xKey="label"
              height={210}
              valueFormat="currency"
              ariaLabel="Wholesale revenue, last 14 days"
            />
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--color-border-default)] pt-3 text-sm">
              {[
                ['Orders', '64'],
                ['AOV', '$1,340'],
                ['Net terms', '71%'],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs text-[var(--color-text-tertiary)]">{label}</div>
                  <div className="font-medium">{value}</div>
                </div>
              ))}
            </div>
          </OverviewCard>
        </div>

        {/* Open quotes + top accounts */}
        <div className={QUOTES_ROW}>
          <OverviewCard
            title="Open quotes"
            icon={<FileText className="h-4 w-4" />}
            right={<CardLink href="/b2b/quotes">All quotes</CardLink>}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Expires</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAMPLE_QUOTES.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-xs text-[var(--module-active-text)]">
                      #{q.id}
                    </TableCell>
                    <TableCell className="font-medium">{q.account}</TableCell>
                    <TableCell className="text-right tabular-nums">{q.value}</TableCell>
                    <TableCell className="text-right text-[var(--color-text-tertiary)] tabular-nums">
                      {q.sent}
                    </TableCell>
                    <TableCell className="text-right text-[var(--color-text-tertiary)] tabular-nums">
                      {q.expires}
                    </TableCell>
                    <TableCell>
                      <Badge color={QUOTE_TONE[q.tone]} variant="soft">
                        {q.status}
                      </Badge>
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
            title="Top accounts"
            icon={<Building2 className="h-4 w-4" />}
            right={<CardLink href="/b2b/accounts">All accounts</CardLink>}
          >
            {SAMPLE_TOP_ACCOUNTS.map((a) => (
              <OverviewRow
                key={a.name}
                icon={<Building2 className="h-4 w-4" />}
                tone="module"
                title={
                  <span className="flex items-center gap-2">
                    {a.name}
                    <Badge color="neutral" variant="soft">
                      {a.tier}
                    </Badge>
                  </span>
                }
                hint={a.terms}
                right={a.spend}
              />
            ))}
            <div className="mt-3">
              <SampleBadge />
            </div>
          </OverviewCard>
        </div>

        {/* Pending applications + price tiers + recent activity */}
        <Grid cols={1} mdCols={2} lgCols={3} gap={4}>
          <OverviewCard
            title="Pending applications"
            icon={<CheckCircle2 className="h-4 w-4" />}
            right={
              <Badge color="warning" variant="soft">
                3 new
              </Badge>
            }
          >
            {SAMPLE_APPLICATIONS.map((app) => (
              <OverviewRow
                key={app.name}
                icon={<Building2 className="h-4 w-4" />}
                tone="warning"
                title={app.name}
                hint={app.meta}
                right={
                  app.action === 'Approve' ? (
                    <Button asChild color="module" size="sm">
                      <Link href="/b2b/applications">Approve</Link>
                    </Button>
                  ) : (
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/b2b/applications">Review</Link>
                    </Button>
                  )
                }
              />
            ))}
            <div className="mt-3">
              <SampleBadge />
            </div>
          </OverviewCard>

          <OverviewCard
            title="Price tiers"
            icon={<Tag className="h-4 w-4" />}
            right={<CardLink href="/b2b/price-lists">Manage</CardLink>}
          >
            {SAMPLE_TIERS.map((t) => (
              <OverviewRow
                key={t.name}
                icon={<Percent className="h-4 w-4" />}
                tone="module"
                title={t.name}
                hint={t.accounts}
                right={t.discount}
              />
            ))}
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
              {SAMPLE_ACTIVITY.map((ev, i) => (
                <TimelineItem
                  key={ev.title}
                  showConnector={i < SAMPLE_ACTIVITY.length - 1}
                  marker={
                    ev.muted ? (
                      <span
                        aria-hidden
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-text-tertiary)]"
                      />
                    ) : undefined
                  }
                >
                  <TimelineTitle>{ev.title}</TimelineTitle>
                  <TimelineTime>{ev.when}</TimelineTime>
                </TimelineItem>
              ))}
            </Timeline>
          </OverviewCard>
        </Grid>
      </Stack>
    </Container>
  );
}
