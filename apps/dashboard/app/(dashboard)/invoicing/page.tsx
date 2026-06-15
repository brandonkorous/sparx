import Link from 'next/link';
import {
  AlertTriangle,
  CalendarClock,
  Clock,
  DollarSign,
  FileText,
  Plus,
  ReceiptText,
  Send,
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
import { AR_STATUS_VARIANT, formatMoney } from './_components/format';
import {
  CardLink,
  MetricTile,
  OverviewCard,
  OverviewRow,
  SampleBadge,
  fmtMoney,
  fmtMoneyCents,
  fmtNumber,
  fmtPercentRatio,
  liveOr,
} from '../_components/overview-bits';

// Invoicing overview — the founder's "am I getting paid?" glance. The signature
// pair is A/R aging (how much is owed, and how old) + collected-over-time. The
// A/R aging buckets, the recent-documents table, the Collected · 30d KPI, and the
// collected-vs-billed timeseries are wired LIVE to the canonical /v1/invoicing
// endpoints (the timeseries off the rollup_invoicing_daily_collected rollup,
// docs/97; fail-soft to "—" / sample); days-to-pay and the customer breakdown
// render representative data behind a <SampleBadge> until matching reporting
// endpoints land. Warm colors stay strictly semantic — overdue balances escalate
// module → warning → danger.

export const dynamic = 'force-dynamic';

// The A/R aging card sits on the LEFT and is narrower than the collected chart.
const AGING_ROW = 'grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.7fr]';
const DOCS_ROW = 'grid grid-cols-1 gap-4 lg:grid-cols-[1.8fr_1fr]';

interface AgingBucket {
  key: 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus';
  label: string;
  count: number;
  balance: number;
}
interface AgingReport {
  asOf: string;
  buckets: AgingBucket[];
  totalOutstanding: number;
  totalCount: number;
}

interface DocumentRow {
  id: string;
  number: string | null;
  status: string;
  currency: string;
  total: string | number;
  balance: string | number;
  stageId: string;
  workflowId: string;
  updatedAt: string;
}

interface CollectedTimeseriesPoint {
  bucket: string;
  paymentsCount: number;
  invoicesCount: number;
  collectedCents: number;
  refundedCents: number;
  billedCents: number;
}
interface CollectedTimeseries {
  range: { from: string; to: string; grain: string };
  points: CollectedTimeseriesPoint[];
  totals: {
    paymentsCount: number;
    invoicesCount: number;
    collectedCents: number;
    refundedCents: number;
    billedCents: number;
  };
  currency: string;
}

interface StageLite {
  id: string;
  customerLabel: string;
}
interface WorkflowLite {
  id: string;
  name: string;
  slug: string;
  stages: StageLite[];
}

// Aging buckets escalate in risk current → 90+, so the fill walks
// module → warning → danger (semantic warm use, reserved for past-due risk).
const AGING_TONE: Record<AgingBucket['key'], string> = {
  current: 'module',
  d1_30: 'module',
  d31_60: 'warning',
  d61_90: 'danger',
  d90_plus: 'danger',
};
// Anything beyond "current" is past due.
const OVERDUE_KEYS: AgingBucket['key'][] = ['d1_30', 'd31_60', 'd61_90', 'd90_plus'];

// ── Sample data (illustrative until the matching reporting endpoints land) ──

// Money collected per week — the second half of "am I getting paid?". The
// illustrative fallback shown (badged) until the tenant has real payments; the
// live series comes from /v1/invoicing/reports/collected-timeseries.
const SAMPLE_COLLECTED_12W: { label: string; collected: number; billed: number }[] = [
  { label: 'Mar 24', collected: 8120, billed: 9400 },
  { label: 'Mar 31', collected: 9340, billed: 10100 },
  { label: 'Apr 7', collected: 7610, billed: 8800 },
  { label: 'Apr 14', collected: 10980, billed: 11200 },
  { label: 'Apr 21', collected: 12450, billed: 12900 },
  { label: 'Apr 28', collected: 11230, billed: 11800 },
  { label: 'May 5', collected: 9870, billed: 10400 },
  { label: 'May 12', collected: 13420, billed: 13900 },
  { label: 'May 19', collected: 14110, billed: 14600 },
  { label: 'May 26', collected: 12880, billed: 13500 },
  { label: 'Jun 2', collected: 15240, billed: 15800 },
  { label: 'Jun 9', collected: 16030, billed: 16400 },
];

// Customer breakdown of what's outstanding — who owes the most.
const SAMPLE_TOP_DEBTORS = [
  { name: 'Foglight Café', meta: 'Net 30 · 4 open invoices', balance: '$8,420', tone: 'module' },
  {
    name: 'Meridian Offices',
    meta: 'Net 30 · oldest 41 days',
    balance: '$6,210',
    tone: 'warning',
  },
  {
    name: 'Harbor Grocery Co.',
    meta: 'Net 45 · oldest 12 days',
    balance: '$4,900',
    tone: 'module',
  },
  {
    name: 'Tideline Coffee Club',
    meta: 'Net 15 · oldest 74 days',
    balance: '$3,180',
    tone: 'danger',
  },
  {
    name: 'Granite City Diner',
    meta: 'Net 30 · 2 open invoices',
    balance: '$1,640',
    tone: 'module',
  },
] as const;

const DEBTOR_TONE: Record<string, string> = {
  module: 'module',
  warning: 'warning',
  danger: 'danger',
};

export default async function InvoicingPage() {
  await requireSession();

  // Date windows for the collected-vs-billed rollup reads: the chart spans the
  // last 12 weeks (weekly buckets); the headline KPI sums the last 30 days.
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
  const range12w = `from=${encodeURIComponent(daysAgo(84))}&to=${encodeURIComponent(now.toISOString())}`;
  const range30 = `from=${encodeURIComponent(daysAgo(30))}&to=${encodeURIComponent(now.toISOString())}`;

  // Live: the canonical A/R aging report, the recent documents (also gives us the
  // status counts), the workflows (stage → customer label for each row), and the
  // collected/billed timeseries off the rollup (docs/97).
  const [aging, recent, workflows, collectedTs, collected30] = await Promise.all([
    api.get<AgingReport>('/v1/invoicing/aging').catch(() => null),
    api.getPaged<DocumentRow[]>('/v1/invoicing/documents?take=6').catch(() => null),
    api.get<WorkflowLite[]>('/v1/invoicing/workflows').catch(() => null),
    api
      .get<CollectedTimeseries>(`/v1/invoicing/reports/collected-timeseries?${range12w}&grain=week`)
      .catch(() => null),
    api
      .get<CollectedTimeseries>(`/v1/invoicing/reports/collected-timeseries?${range30}&grain=day`)
      .catch(() => null),
  ]);

  const documents = recent?.data ?? [];
  const totalDocuments = (recent?.meta?.total as number | undefined) ?? documents.length;
  const currency = documents[0]?.currency ?? collectedTs?.currency ?? 'USD';

  // Collected-vs-billed chart + footer: live the moment the tenant has any
  // payments or billed documents in the window, else the illustrative sample
  // (docs/97 §9). The endpoint returns a continuous zero-filled weekly series, so
  // we gate on the window totals rather than point count.
  const collectedPoints =
    collectedTs && (collectedTs.totals.collectedCents > 0 || collectedTs.totals.billedCents > 0)
      ? collectedTs.points.map((p) => ({
          label: new Date(`${p.bucket}T00:00:00Z`).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
          }),
          collected: p.collectedCents / 100,
          billed: p.billedCents / 100,
        }))
      : null;
  const collected12w = liveOr(collectedPoints, SAMPLE_COLLECTED_12W);
  const collectionRate =
    collectedTs && collectedTs.totals.billedCents > 0
      ? collectedTs.totals.collectedCents / collectedTs.totals.billedCents
      : null;
  const collectedFooter: [string, string][] =
    !collected12w.isSample && collectedTs
      ? [
          ['Collected · 12w', fmtMoneyCents(collectedTs.totals.collectedCents, currency)],
          ['Billed · 12w', fmtMoneyCents(collectedTs.totals.billedCents, currency)],
          ['Collection rate', fmtPercentRatio(collectionRate)],
        ]
      : [
          ['Collected · 12w', '$145,290'],
          ['Billed · 12w', '$152,700'],
          ['Collection rate', '95.1%'],
        ];

  const stageLabels: Record<string, string> = {};
  for (const w of workflows ?? []) for (const s of w.stages) stageLabels[s.id] = s.customerLabel;

  // Derive the headline figures from the live aging report.
  const outstanding = aging?.totalOutstanding ?? null;
  const overdue = aging
    ? aging.buckets
        .filter((b) => OVERDUE_KEYS.includes(b.key))
        .reduce((sum, b) => sum + b.balance, 0)
    : null;
  const overdueCount = aging
    ? aging.buckets.filter((b) => OVERDUE_KEYS.includes(b.key)).reduce((sum, b) => sum + b.count, 0)
    : null;

  const agingItems = (aging?.buckets ?? []).map((b) => ({
    label: b.label,
    value: b.balance,
    display: `${fmtMoney(b.balance, currency)} · ${fmtNumber(b.count)}`,
    color: AGING_TONE[b.key],
    key: b.key,
  }));

  // Draft documents still need to be sent before they can be collected.
  const draftCount = documents.filter((d) => d.status === 'unpaid').length;

  return (
    <Container size="xl">
      <Stack gap={6} className="py-8">
        <PageHeader
          icon={<ReceiptText className="h-5 w-5" />}
          title="Invoicing"
          description="Am I getting paid? — outstanding balances and collections at a glance."
          actions={
            <>
              <Button asChild variant="outline" leftIcon={<FileText className="h-4 w-4" />}>
                <Link href="/invoicing/documents">All documents</Link>
              </Button>
              <Button asChild color="module" leftIcon={<Plus className="h-4 w-4" />}>
                <Link href="/invoicing/documents/new">New document</Link>
              </Button>
            </>
          }
        />

        {/* Headline KPIs — outstanding & overdue live from the aging report */}
        <Grid cols={1} mdCols={2} lgCols={4} gap={4}>
          <Stat
            icon={<DollarSign className="h-4 w-4" />}
            label="Outstanding A/R"
            value={fmtMoney(outstanding, currency)}
            hint={
              aging
                ? `Across ${fmtNumber(aging.totalCount)} open document${aging.totalCount === 1 ? '' : 's'}`
                : 'No open balances yet'
            }
          />
          <Stat
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Overdue"
            value={fmtMoney(overdue, currency)}
            hint={
              overdueCount != null
                ? `${fmtNumber(overdueCount)} past-due document${overdueCount === 1 ? '' : 's'}`
                : 'Nothing past due'
            }
          />
          <Stat
            icon={<TrendingUp className="h-4 w-4" />}
            label="Collected · 30d"
            value={fmtMoneyCents(collected30?.totals.collectedCents, currency)}
            hint={
              collected30 && collected30.totals.collectedCents > 0
                ? `${fmtNumber(collected30.totals.paymentsCount)} payment${collected30.totals.paymentsCount === 1 ? '' : 's'} · last 30 days`
                : 'No payments received yet'
            }
          />
          <Stat
            icon={<CalendarClock className="h-4 w-4" />}
            label="Avg. days to pay"
            value="24 days"
            hint="From invoice to payment"
          />
        </Grid>

        {/* Daily action queue — what's blocking the next dollar */}
        <ActionQueue
          title="Needs attention"
          icon={<AlertTriangle className="h-4 w-4" />}
          meta={<SampleBadge />}
        >
          <ActionTile
            asChild
            icon={<AlertTriangle className="h-5 w-5" />}
            count={overdueCount ?? 0}
            label="Invoices overdue"
            tone="danger"
          >
            <Link href="/invoicing/documents?status=overdue" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<Send className="h-5 w-5" />}
            count={5}
            label="Drafts to send"
            tone="warning"
          >
            <Link href="/invoicing/documents?status=unpaid" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<Clock className="h-5 w-5" />}
            count={3}
            label="Awaiting approval"
            tone="module"
          >
            <Link href="/invoicing/documents" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<DollarSign className="h-5 w-5" />}
            count={4}
            label="Partially paid"
            tone="module"
          >
            <Link href="/invoicing/documents?status=partial" />
          </ActionTile>
        </ActionQueue>

        {/* A/R aging (signature, live) + collected-over-time */}
        <div className={AGING_ROW}>
          <OverviewCard
            title="Accounts receivable"
            icon={<ReceiptText className="h-4 w-4" />}
            description="Outstanding by age"
            right={<CardLink href="/invoicing/documents">All documents</CardLink>}
          >
            <p className="text-[1.65rem] leading-none font-medium">
              {fmtMoney(outstanding, currency)}
            </p>
            <p className="mt-1.5 mb-4 text-sm text-[var(--color-text-tertiary)]">
              Outstanding across{' '}
              <span className="text-[var(--color-text-secondary)]">
                {aging ? `${fmtNumber(aging.totalCount)} open documents` : 'your open documents'}
              </span>
            </p>
            {agingItems.length > 0 ? (
              <BarList items={agingItems} />
            ) : (
              <p className="py-6 text-center text-sm text-[var(--color-text-tertiary)]">
                Nothing outstanding — every document is paid or has no balance.
              </p>
            )}
            <div className="mt-4 flex items-center gap-2 border-t border-[var(--color-border-default)] pt-3">
              <AlertTriangle aria-hidden className="h-4 w-4 text-[var(--color-danger-text)]" />
              <span className="text-xs text-[var(--color-text-tertiary)]">
                <span className="font-medium text-[var(--color-danger-text)]">
                  {fmtMoney(overdue, currency)} past due
                </span>{' '}
                across {fmtNumber(overdueCount)} document
                {overdueCount === 1 ? '' : 's'}
              </span>
            </div>
          </OverviewCard>

          <OverviewCard
            title="Collected over time"
            icon={<TrendingUp className="h-4 w-4" />}
            description="Payments received vs. billed · last 12 weeks"
            right={collected12w.isSample ? <SampleBadge reason="no-data" /> : undefined}
          >
            <AreaChart
              data={collected12w.data}
              series={[
                { key: 'collected', label: 'Collected', color: 'module' },
                { key: 'billed', label: 'Billed', color: 'var(--module-active-tint)' },
              ]}
              xKey="label"
              height={210}
              valueFormat={{ kind: 'currency', currency }}
              ariaLabel="Collected vs. billed, last 12 weeks"
            />
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--color-border-default)] pt-3 text-sm">
              {collectedFooter.map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs text-[var(--color-text-tertiary)]">{label}</div>
                  <div className="font-medium">{value}</div>
                </div>
              ))}
            </div>
          </OverviewCard>
        </div>

        {/* Recent documents (live) + collections summary */}
        <div className={DOCS_ROW}>
          <OverviewCard
            title="Recent documents"
            icon={<FileText className="h-4 w-4" />}
            description={`${fmtNumber(totalDocuments)} total`}
            right={<CardLink href="/invoicing/documents">All documents</CardLink>}
          >
            {documents.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs text-[var(--module-active-text)]">
                        <Link href={`/invoicing/documents/${d.id}`} className="hover:underline">
                          {d.number ?? 'Draft'}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">{stageLabels[d.stageId] ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(d.total, d.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(d.balance, d.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge color={AR_STATUS_VARIANT[d.status] ?? 'neutral'} variant="soft">
                          {d.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-[var(--color-text-tertiary)] tabular-nums">
                        {new Date(d.updatedAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="py-8 text-center text-sm text-[var(--color-text-tertiary)]">
                No documents yet — create an estimate or invoice to get started.
              </p>
            )}
          </OverviewCard>

          <OverviewCard
            title="Collections"
            icon={<DollarSign className="h-4 w-4" />}
            right={<SampleBadge />}
          >
            <p className="text-[1.65rem] leading-none font-medium">$48,210</p>
            <p className="mt-1.5 mb-3 text-sm text-[var(--color-text-tertiary)]">
              Collected this month ·{' '}
              <span className="text-[var(--color-text-secondary)]">+12% vs. last</span>
            </p>
            <OverviewRow
              icon={<DollarSign className="h-4 w-4" />}
              tone="success"
              title="Paid in full · 30d"
              hint="42 documents settled"
              right="$41,980"
            />
            <OverviewRow
              icon={<Clock className="h-4 w-4" />}
              tone="warning"
              title="Deposits collected"
              hint="On open estimates"
              right="$6,230"
            />
            <OverviewRow
              icon={<CalendarClock className="h-4 w-4" />}
              tone="module"
              title="Avg. days to pay"
              hint="From finalize to settled"
              right="24 days"
            />
            <Button asChild variant="outline" size="sm" className="mt-4 w-full">
              <Link href="/invoicing/documents?status=paid">View paid documents</Link>
            </Button>
          </OverviewCard>
        </div>

        {/* Who owes you + status mix + send queue */}
        <Grid cols={1} mdCols={2} lgCols={3} gap={4}>
          <OverviewCard
            title="Who owes you"
            icon={<Users className="h-4 w-4" />}
            right={<SampleBadge />}
          >
            {SAMPLE_TOP_DEBTORS.map((c) => (
              <OverviewRow
                key={c.name}
                icon={<Users className="h-4 w-4" />}
                tone={DEBTOR_TONE[c.tone]}
                title={c.name}
                hint={c.meta}
                right={c.balance}
              />
            ))}
          </OverviewCard>

          <OverviewCard
            title="Open balance by stage"
            icon={<ReceiptText className="h-4 w-4" />}
            right={<SampleBadge />}
          >
            <div className="mb-3 grid grid-cols-3 gap-3 text-center">
              <MetricTile value="$34.2k" label="Estimates" tone="module" />
              <MetricTile value="$11.4k" label="Invoiced" tone="warning" />
              <MetricTile value="$6.5k" label="Overdue" tone="danger" />
            </div>
            <OverviewRow
              icon={<FileText className="h-4 w-4" />}
              tone="module"
              title="Estimates awaiting approval"
              hint="Not yet billable"
              right={
                <Badge color="neutral" variant="soft">
                  12 open
                </Badge>
              }
            />
            <OverviewRow
              icon={<DollarSign className="h-4 w-4" />}
              tone="warning"
              title="Invoiced, unpaid"
              hint="Within terms"
              right={
                <Badge color="warning" variant="soft">
                  19 open
                </Badge>
              }
            />
            <OverviewRow
              icon={<AlertTriangle className="h-4 w-4" />}
              tone="danger"
              title="Past due"
              hint="Needs a follow-up"
              right={
                <Badge color="danger" variant="soft">
                  {fmtNumber(overdueCount)} open
                </Badge>
              }
            />
          </OverviewCard>

          <OverviewCard
            title="Send & collect"
            icon={<Send className="h-4 w-4" />}
            right={<CardLink href="/invoicing/documents/new">New</CardLink>}
          >
            <OverviewRow
              icon={<Send className="h-4 w-4" />}
              tone="module"
              title="Drafts ready to send"
              hint="Finalize to start the clock"
              right={
                <Badge color="module" variant="soft">
                  {fmtNumber(draftCount || 5)}
                </Badge>
              }
            />
            <OverviewRow
              icon={<DollarSign className="h-4 w-4" />}
              tone="success"
              title="Payment links live"
              hint="Hosted checkout open balances"
              right={
                <Badge color="success" variant="soft">
                  Active
                </Badge>
              }
            />
            <OverviewRow
              icon={<Clock className="h-4 w-4" />}
              tone="warning"
              title="Reminders due"
              hint="Past-due follow-ups to send"
              right={
                <Badge color="warning" variant="soft">
                  {fmtNumber(overdueCount)}
                </Badge>
              }
            />
            <div className="mt-3 flex items-center gap-2">
              <SampleBadge />
              <span className="text-xs text-[var(--color-text-tertiary)]">
                Reminder automation illustrative
              </span>
            </div>
          </OverviewCard>
        </Grid>
      </Stack>
    </Container>
  );
}
