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
import { EntityCreateButton } from '../_components/entity-create-button';
import {
  CardLink,
  OverviewCard,
  OverviewRow,
  SampleBadge,
  fmtMoneyCents,
  fmtNumber,
  liveOr,
} from '../_components/overview-bits';

// B2B overview — the wholesale book at a glance: revenue pulse, the daily
// action queue, A/R aging (the signature cashflow-risk card), open quotes, and
// the account roster. KPIs, the action queue, A/R aging, the revenue chart, open
// quotes, top accounts and price tiers are LIVE from /v1/b2b/reports/* (summary
// + order/revenue timeseries + open-quotes + top-accounts), falling back to a
// badged example only until the tenant has B2B data. Pending applications (no
// application model) and the activity feed (no event log) stay sample. Warm
// colors (amber/red) stay strictly semantic — overdue invoices, aging risk.

export const dynamic = 'force-dynamic';

// The A/R aging card sits on the LEFT and is narrower than the revenue chart.
const AGING_ROW = 'grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.9fr]';
const QUOTES_ROW = 'grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]';

interface B2bSummary {
  accounts: { total: number; active: number; creditHold: number };
  openQuotes: number;
  invoices: {
    outstandingCount: number;
    outstandingCents: number;
    overdueCount: number;
    overdueCents: number;
    oldestOverdueDays: number;
    aging: { current: number; d1_30: number; d31_60: number; d60plus: number };
  };
  approvalQueue: number;
  credit: { limitCents: number; usedCents: number };
  byTier: { tier: string; count: number }[];
}
interface B2bTsPoint {
  bucket: string;
  ordersCount: number;
  revenueCents: number;
}
interface B2bTimeseries {
  points: B2bTsPoint[];
  totals: { ordersCount: number; revenueCents: number };
}
interface OpenQuote {
  id: string;
  quoteNumber: string;
  account: string;
  status: string;
  totalCents: number;
  sentAt: string;
  expiresAt: string | null;
}
interface TopAccount {
  accountId: string;
  name: string;
  tier: string | null;
  paymentTerms: string | null;
  invoiceCount: number;
  invoicedCents: number;
}

const QUOTE_STATUS_TONE: Record<string, { tone: string; label: string }> = {
  draft: { tone: 'neutral', label: 'Draft' },
  submitted: { tone: 'warning', label: 'Sent' },
  accepted: { tone: 'success', label: 'Accepted' },
  declined: { tone: 'danger', label: 'Declined' },
  expired: { tone: 'neutral', label: 'Expired' },
  converted: { tone: 'success', label: 'Converted' },
};

function shortDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function bucketLabel(bucket: string): string {
  return new Date(`${bucket}T00:00:00.000Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

// ── Sample data (shown badged only until the tenant has B2B data) ──

const SAMPLE_REVENUE_14D: { label: string; revenue: number }[] = [
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
];

const SAMPLE_AGING: { label: string; value: number; display: string; color: string }[] = [
  { label: 'Current', value: 34200, display: '$34,200', color: 'module' },
  { label: '1–30 days', value: 11400, display: '$11,400', color: 'module' },
  { label: '31–60 days', value: 4100, display: '$4,100', color: 'warning' },
  { label: '60+ days', value: 2400, display: '$2,400', color: 'danger' },
];

interface QuoteRow {
  key: string;
  label: string;
  account: string;
  value: string;
  sent: string;
  expires: string;
  status: string;
  tone: string;
}
const SAMPLE_QUOTES: QuoteRow[] = [
  {
    key: 'Q-318',
    label: 'Q-318',
    account: 'Foglight Café',
    value: '$2,840',
    sent: 'Jun 12',
    expires: 'Jun 19',
    status: 'Sent',
    tone: 'warning',
  },
  {
    key: 'Q-317',
    label: 'Q-317',
    account: 'Meridian Offices',
    value: '$5,210',
    sent: 'Jun 10',
    expires: 'Jun 17',
    status: 'Sent',
    tone: 'warning',
  },
  {
    key: 'Q-315',
    label: 'Q-315',
    account: 'Harbor Grocery Co.',
    value: '$8,900',
    sent: 'Jun 8',
    expires: 'Jun 15',
    status: 'Sent',
    tone: 'warning',
  },
  {
    key: 'Q-314',
    label: 'Q-314',
    account: 'Tideline Coffee Club',
    value: '$1,620',
    sent: 'Jun 6',
    expires: 'Jun 13',
    status: 'Draft',
    tone: 'neutral',
  },
  {
    key: 'Q-311',
    label: 'Q-311',
    account: 'Granite City Diner',
    value: '$3,400',
    sent: 'Jun 3',
    expires: 'Jun 10',
    status: 'Draft',
    tone: 'neutral',
  },
];

interface AccountRow {
  key: string;
  name: string;
  tier: string;
  terms: string;
  spend: string;
}
const SAMPLE_TOP_ACCOUNTS: AccountRow[] = [
  {
    key: 'a1',
    name: 'Foglight Café',
    tier: 'Gold',
    terms: 'Net 30 · 14 invoices',
    spend: '$12,400',
  },
  {
    key: 'a2',
    name: 'Meridian Offices',
    tier: 'Gold',
    terms: 'Net 30 · 11 invoices',
    spend: '$9,800',
  },
  {
    key: 'a3',
    name: 'Harbor Grocery Co.',
    tier: 'Silver',
    terms: 'Net 45 · 9 invoices',
    spend: '$7,100',
  },
  {
    key: 'a4',
    name: 'Tideline Coffee Club',
    tier: 'Silver',
    terms: 'Net 15 · 7 invoices',
    spend: '$4,900',
  },
];

interface TierRow {
  key: string;
  name: string;
  accounts: string;
}
const SAMPLE_TIERS: TierRow[] = [
  { key: 't1', name: 'Wholesale', accounts: '38 accounts' },
  { key: 't2', name: 'Distributor', accounts: '9 accounts' },
  { key: 't3', name: 'Office / Corporate', accounts: '17 accounts' },
];

const SAMPLE_APPLICATIONS = [
  { name: 'Granite City Diner', meta: 'Applied Jun 12 · Net 30 requested', action: 'Approve' },
  { name: 'Eastside Bakehouse', meta: 'Applied Jun 11 · Wholesale tier', action: 'Review' },
  { name: 'Cloudpeak Catering', meta: 'Applied Jun 9 · Distributor tier', action: 'Review' },
] as const;

const SAMPLE_ACTIVITY = [
  { title: 'New PO — Foglight Café ($2,840)', when: '2 hours ago', muted: false },
  { title: 'Invoice paid — Meridian Offices ($5,210)', when: '5 hours ago', muted: false },
  { title: 'Quote viewed — Harbor Grocery Co.', when: '1 day ago', muted: true },
  { title: 'You approved Tideline Coffee Club', when: '2 days ago', muted: false },
] as const;

export default async function B2bPage() {
  await requireSession();

  const tsTo = new Date();
  const tsFrom = new Date(tsTo.getTime() - 29 * 86_400_000);
  const tsQs = new URLSearchParams({
    grain: 'day',
    from: tsFrom.toISOString(),
    to: tsTo.toISOString(),
  });

  const [summary, ts, openQuotes, topAccounts] = await Promise.all([
    api.get<B2bSummary>('/v1/b2b/reports/summary').catch(() => null),
    api.get<B2bTimeseries>(`/v1/b2b/reports/timeseries?${tsQs.toString()}`).catch(() => null),
    api.get<OpenQuote[]>('/v1/b2b/reports/open-quotes').catch(() => null),
    api.get<TopAccount[]>('/v1/b2b/reports/top-accounts').catch(() => null),
  ]);

  // Revenue chart — last 14 days of the 30-day series, gated on real orders.
  const revPoints =
    ts && ts.totals.ordersCount > 0
      ? ts.points
          .slice(-14)
          .map((p) => ({ label: bucketLabel(p.bucket), revenue: p.revenueCents / 100 }))
      : null;
  const rev14 = liveOr(revPoints, SAMPLE_REVENUE_14D);
  const aov30 =
    ts && ts.totals.ordersCount > 0
      ? Math.round(ts.totals.revenueCents / ts.totals.ordersCount)
      : 0;

  // A/R aging from the summary's unpaid-invoice buckets.
  const agingItems =
    summary && summary.invoices.outstandingCount > 0
      ? [
          {
            label: 'Current',
            value: summary.invoices.aging.current,
            display: fmtMoneyCents(summary.invoices.aging.current),
            color: 'module',
          },
          {
            label: '1–30 days',
            value: summary.invoices.aging.d1_30,
            display: fmtMoneyCents(summary.invoices.aging.d1_30),
            color: 'module',
          },
          {
            label: '31–60 days',
            value: summary.invoices.aging.d31_60,
            display: fmtMoneyCents(summary.invoices.aging.d31_60),
            color: 'warning',
          },
          {
            label: '60+ days',
            value: summary.invoices.aging.d60plus,
            display: fmtMoneyCents(summary.invoices.aging.d60plus),
            color: 'danger',
          },
        ]
      : null;
  const aging = liveOr(agingItems, SAMPLE_AGING);

  // Open quotes table.
  const quoteRows: QuoteRow[] | null =
    openQuotes && openQuotes.length > 0
      ? openQuotes.map((q) => {
          const meta = QUOTE_STATUS_TONE[q.status] ?? { tone: 'neutral', label: q.status };
          return {
            key: q.id,
            label: q.quoteNumber,
            account: q.account,
            value: fmtMoneyCents(q.totalCents),
            sent: shortDate(q.sentAt),
            expires: shortDate(q.expiresAt),
            status: meta.label,
            tone: meta.tone,
          };
        })
      : null;
  const quotes = liveOr(quoteRows, SAMPLE_QUOTES);

  // Top accounts by invoiced amount.
  const accountRows: AccountRow[] | null =
    topAccounts && topAccounts.length > 0
      ? topAccounts.map((a) => ({
          key: a.accountId,
          name: a.name,
          tier: a.tier ?? '—',
          terms: `${a.paymentTerms ?? 'No terms'} · ${fmtNumber(a.invoiceCount)} invoice${a.invoiceCount === 1 ? '' : 's'}`,
          spend: fmtMoneyCents(a.invoicedCents),
        }))
      : null;
  const accounts = liveOr(accountRows, SAMPLE_TOP_ACCOUNTS);

  // Price tiers by account count.
  const tierRows: TierRow[] | null =
    summary && summary.byTier.length > 0
      ? summary.byTier.map((t) => ({
          key: t.tier,
          name: t.tier,
          accounts: `${fmtNumber(t.count)} account${t.count === 1 ? '' : 's'}`,
        }))
      : null;
  const tiers = liveOr(tierRows, SAMPLE_TIERS);

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
              <EntityCreateButton
                entityType="b2b-account"
                newHref="/b2b/accounts/new"
                color="module"
                leftIcon={<Plus className="h-4 w-4" />}
              >
                New account
              </EntityCreateButton>
            </>
          }
        />

        {/* Headline KPIs — live from the B2B reporting summary + timeseries */}
        <Grid cols={1} mdCols={2} lgCols={4} gap={4}>
          <Stat
            icon={<DollarSign className="h-4 w-4" />}
            label="Wholesale revenue · 30d"
            value={ts ? fmtMoneyCents(ts.totals.revenueCents) : '—'}
            hint="Net B2B-portal sales"
          />
          <Stat
            icon={<Building2 className="h-4 w-4" />}
            label="Active accounts"
            value={summary ? fmtNumber(summary.accounts.active) : '—'}
            hint={summary ? `${fmtNumber(summary.accounts.total)} total` : 'Wholesale accounts'}
          />
          <Stat
            icon={<FileText className="h-4 w-4" />}
            label="Open quotes"
            value={summary ? fmtNumber(summary.openQuotes) : '—'}
            hint="Awaiting buyer response"
          />
          <Stat
            icon={<Package className="h-4 w-4" />}
            label="Avg. order value · 30d"
            value={aov30 > 0 ? fmtMoneyCents(aov30) : '—'}
            hint="Across wholesale orders"
          />
        </Grid>

        {/* Daily action queue — live counts */}
        <ActionQueue title="Needs attention" icon={<AlertTriangle className="h-4 w-4" />}>
          <ActionTile
            asChild
            icon={<FileText className="h-5 w-5" />}
            count={summary?.openQuotes ?? 0}
            label="Quotes awaiting response"
            tone="module"
          >
            <Link href="/b2b/quotes" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<Receipt className="h-5 w-5" />}
            count={summary?.invoices.overdueCount ?? 0}
            label="Invoices overdue"
            tone="danger"
          >
            <Link href="/b2b/invoices" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<CheckCircle2 className="h-5 w-5" />}
            count={summary?.approvalQueue ?? 0}
            label="Orders to approve"
            tone="warning"
          >
            <Link href="/b2b/approval-queue" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<AlertTriangle className="h-5 w-5" />}
            count={summary?.accounts.creditHold ?? 0}
            label="Accounts on credit hold"
            tone="danger"
          >
            <Link href="/b2b/accounts?status=credit_hold" />
          </ActionTile>
        </ActionQueue>

        {/* Accounts receivable / aging (signature) + wholesale revenue chart */}
        <div className={AGING_ROW}>
          <OverviewCard
            title="Accounts receivable"
            icon={<Receipt className="h-4 w-4" />}
            description="Outstanding by age"
            right={aging.isSample ? <SampleBadge reason="no-data" /> : undefined}
          >
            <p className="text-[1.65rem] leading-none font-medium">
              {summary ? fmtMoneyCents(summary.invoices.outstandingCents) : '—'}
            </p>
            <p className="mt-1.5 mb-4 text-sm text-[var(--color-text-tertiary)]">
              Outstanding across{' '}
              <span className="text-[var(--color-text-secondary)]">
                {summary ? fmtNumber(summary.invoices.outstandingCount) : '—'} invoices
              </span>
            </p>
            <BarList items={aging.data} />
            {summary && summary.invoices.overdueCount > 0 ? (
              <div className="mt-4 flex items-center gap-2 border-t border-[var(--color-border-default)] pt-3">
                <AlertTriangle aria-hidden className="h-4 w-4 text-[var(--color-danger-text)]" />
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  <span className="font-medium text-[var(--color-danger-text)]">
                    {fmtNumber(summary.invoices.overdueCount)} past due
                  </span>{' '}
                  · oldest {fmtNumber(summary.invoices.oldestOverdueDays)} days
                </span>
              </div>
            ) : null}
          </OverviewCard>

          <OverviewCard
            title="Wholesale revenue"
            icon={<TrendingUp className="h-4 w-4" />}
            description="Net B2B-portal sales · last 14 days"
            right={rev14.isSample ? <SampleBadge reason="no-data" /> : undefined}
          >
            <AreaChart
              data={rev14.data}
              series={[{ key: 'revenue', label: 'Revenue', color: 'module' }]}
              xKey="label"
              height={210}
              valueFormat="currency"
              ariaLabel="Wholesale revenue, last 14 days"
            />
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--color-border-default)] pt-3 text-sm">
              {[
                ['Orders · 30d', ts ? fmtNumber(ts.totals.ordersCount) : '—'],
                ['AOV', aov30 > 0 ? fmtMoneyCents(aov30) : '—'],
                [
                  'Outstanding A/R',
                  summary ? fmtMoneyCents(summary.invoices.outstandingCents) : '—',
                ],
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
            right={
              quotes.isSample ? (
                <SampleBadge reason="no-data" />
              ) : (
                <CardLink href="/b2b/quotes">All quotes</CardLink>
              )
            }
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
                {quotes.data.map((q) => (
                  <TableRow key={q.key}>
                    <TableCell className="font-mono text-xs text-[var(--module-active-text)]">
                      {q.label}
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
                      <Badge color={q.tone} variant="soft">
                        {q.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </OverviewCard>

          <OverviewCard
            title="Top accounts"
            icon={<Building2 className="h-4 w-4" />}
            right={
              accounts.isSample ? (
                <SampleBadge reason="no-data" />
              ) : (
                <CardLink href="/b2b/accounts">All accounts</CardLink>
              )
            }
          >
            {accounts.data.map((a) => (
              <OverviewRow
                key={a.key}
                icon={<Building2 className="h-4 w-4" />}
                tone="module"
                title={
                  <span className="flex items-center gap-2">
                    {a.name}
                    {a.tier !== '—' ? (
                      <Badge color="neutral" variant="soft">
                        {a.tier}
                      </Badge>
                    ) : null}
                  </span>
                }
                hint={a.terms}
                right={a.spend}
              />
            ))}
          </OverviewCard>
        </div>

        {/* Pending applications (sample) + price tiers (live) + recent activity (sample) */}
        <Grid cols={1} mdCols={2} lgCols={3} gap={4}>
          <OverviewCard
            title="Pending applications"
            icon={<CheckCircle2 className="h-4 w-4" />}
            right={<SampleBadge />}
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
                      <Link href="/b2b/accounts">Approve</Link>
                    </Button>
                  ) : (
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/b2b/accounts">Review</Link>
                    </Button>
                  )
                }
              />
            ))}
          </OverviewCard>

          <OverviewCard
            title="Price tiers"
            icon={<Tag className="h-4 w-4" />}
            right={
              tiers.isSample ? (
                <SampleBadge reason="no-data" />
              ) : (
                <CardLink href="/b2b/price-lists">Manage</CardLink>
              )
            }
          >
            {tiers.data.map((t) => (
              <OverviewRow
                key={t.key}
                icon={<Percent className="h-4 w-4" />}
                tone="module"
                title={t.name}
                right={t.accounts}
              />
            ))}
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
