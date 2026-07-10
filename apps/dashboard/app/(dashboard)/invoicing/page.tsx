import Link from 'next/link';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
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
import { ActionQueue, ActionTile, AreaChart, BarList, PageHeader } from '@sparx/ui';
import {
  Badge,
  Button,
  EmptyState,
  Stat,
  StatDesc,
  StatFigure,
  Stats,
  StatTitle,
  StatValue,
  Table,
} from '@wizeworks/silicaui-react';

import { api } from '@/lib/api-rest-client';
import { AR_STATUS_VARIANT, formatMoney } from './_components/format';
import {
  CardLink,
  MetricTile,
  OverviewCard,
  OverviewRow,
  fmtMoney,
  fmtMoneyCents,
  fmtNumber,
  fmtPercentRatio,
} from '../_components/overview-bits';

// Invoicing overview — the founder's "am I getting paid?" glance. The signature
// pair is A/R aging (how much is owed, and how old) + collected-over-time. Nearly
// everything is now LIVE off the canonical /v1/invoicing endpoints: A/R aging,
// recent documents, the Collected · 30d KPI and collected-vs-billed timeseries
// (off the rollup_invoicing_daily_collected rollup, docs/97), plus avg-days-to-
// pay, the Collections card, the open-balance-by-stage split, and the "who owes
// you" debtor list (off /v1/invoicing/reports/collections + customer-breakdown).
// Only the reminder-automation history stays sample (it needs a reminder event
// log — workload B). Warm colors stay strictly semantic — overdue balances
// escalate module → warning → danger.

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

interface CollectionsSummary {
  collectedThisMonthCents: number;
  collectedLastMonthCents: number;
  paidInFull: { count: number; totalCents: number };
  depositsCents: number;
  avgDaysToPay: number | null;
  medianDaysToPay: number | null;
  paidCount: number;
  openBalance: {
    estimatesCents: number;
    estimatesCount: number;
    invoicedOpenCents: number;
    invoicedOpenCount: number;
    overdueCents: number;
    overdueCount: number;
  };
  currency: string;
}
interface DebtorRow {
  customerId: string;
  name: string;
  openInvoices: number;
  outstandingCents: number;
  oldestOverdueDays: number | null;
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
  const [aging, recent, workflows, collectedTs, collected30, collections, debtors] =
    await Promise.all([
      api.get<AgingReport>('/v1/invoicing/aging').catch(() => null),
      api.getPaged<DocumentRow[]>('/v1/invoicing/documents?take=6').catch(() => null),
      api.get<WorkflowLite[]>('/v1/invoicing/workflows').catch(() => null),
      api
        .get<CollectedTimeseries>(
          `/v1/invoicing/reports/collected-timeseries?${range12w}&grain=week`
        )
        .catch(() => null),
      api
        .get<CollectedTimeseries>(`/v1/invoicing/reports/collected-timeseries?${range30}&grain=day`)
        .catch(() => null),
      api.get<CollectionsSummary>('/v1/invoicing/reports/collections').catch(() => null),
      api.get<DebtorRow[]>('/v1/invoicing/reports/customer-breakdown?limit=5').catch(() => null),
    ]);

  const documents = recent?.data ?? [];
  const totalDocuments = (recent?.meta?.total as number | undefined) ?? documents.length;
  const currency = documents[0]?.currency ?? collectedTs?.currency ?? 'USD';

  // Collected-vs-billed chart + footer: live the moment the tenant has any
  // payments or billed documents in the window (docs/97 §9). The endpoint returns
  // a continuous zero-filled weekly series, so we gate on the window totals
  // rather than point count; an empty window renders a compact empty state.
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
  const collectionRate =
    collectedTs && collectedTs.totals.billedCents > 0
      ? collectedTs.totals.collectedCents / collectedTs.totals.billedCents
      : null;
  const collectedFooter: [string, string][] = collectedTs
    ? [
        ['Collected · 12w', fmtMoneyCents(collectedTs.totals.collectedCents, currency)],
        ['Billed · 12w', fmtMoneyCents(collectedTs.totals.billedCents, currency)],
        ['Collection rate', fmtPercentRatio(collectionRate)],
      ]
    : [];

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

  // Draft documents still need to be sent before they can be collected; partially
  // paid documents are mid-collection. Both come straight off the recent docs page.
  const draftCount = documents.filter((d) => d.status === 'unpaid').length;
  const partialCount = documents.filter((d) => d.status === 'partial').length;
  // Estimates awaiting approval — not yet billable — from the collections rollup.
  const estimatesAwaitingCount = collections?.openBalance.estimatesCount ?? 0;

  // Collections trend: this month vs. last (month-over-month change in cash in).
  const collectedTrend =
    collections && collections.collectedLastMonthCents > 0
      ? (collections.collectedThisMonthCents - collections.collectedLastMonthCents) /
        collections.collectedLastMonthCents
      : null;

  // Debtor tone escalates by how overdue the oldest open invoice is.
  const debtorTone = (days: number | null): string =>
    days == null ? 'module' : days >= 60 ? 'danger' : days >= 30 ? 'warning' : 'module';
  const liveDebtors = debtors && debtors.length > 0 ? debtors : null;

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-8">
        <PageHeader
          icon={<ReceiptText className="h-5 w-5" />}
          title="Invoicing"
          description="Am I getting paid? — outstanding balances and collections at a glance."
          actions={
            <>
              <Button
                variant="outline"
                iconStart={<FileText className="h-4 w-4" />}
                render={<Link href="/invoicing/documents" />}
              >
                All documents
              </Button>
              <Button
                color="module"
                iconStart={<Plus className="h-4 w-4" />}
                render={<Link href="/invoicing/documents/new" />}
              >
                New document
              </Button>
            </>
          }
        />

        {/* Headline KPIs — outstanding & overdue live from the aging report */}
        <Stats className="w-full flex-wrap [&>*]:flex-1">
          <Stat>
            <StatFigure>
              <div className="bg-module bg-soft text-module rounded-md p-1.5">
                <DollarSign className="h-4 w-4" />
              </div>
            </StatFigure>
            <StatTitle>Outstanding A/R</StatTitle>
            <StatValue>{fmtMoney(outstanding, currency)}</StatValue>
            <StatDesc>
              {aging
                ? `Across ${fmtNumber(aging.totalCount)} open document${aging.totalCount === 1 ? '' : 's'}`
                : 'No open balances yet'}
            </StatDesc>
          </Stat>
          <Stat>
            <StatFigure>
              <div className="bg-module bg-soft text-module rounded-md p-1.5">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </StatFigure>
            <StatTitle>Overdue</StatTitle>
            <StatValue>{fmtMoney(overdue, currency)}</StatValue>
            <StatDesc>
              {overdueCount != null
                ? `${fmtNumber(overdueCount)} past-due document${overdueCount === 1 ? '' : 's'}`
                : 'Nothing past due'}
            </StatDesc>
          </Stat>
          <Stat>
            <StatFigure>
              <div className="bg-module bg-soft text-module rounded-md p-1.5">
                <TrendingUp className="h-4 w-4" />
              </div>
            </StatFigure>
            <StatTitle>Collected · 30d</StatTitle>
            <StatValue>{fmtMoneyCents(collected30?.totals.collectedCents, currency)}</StatValue>
            <StatDesc>
              {collected30 && collected30.totals.collectedCents > 0
                ? `${fmtNumber(collected30.totals.paymentsCount)} payment${collected30.totals.paymentsCount === 1 ? '' : 's'} · last 30 days`
                : 'No payments received yet'}
            </StatDesc>
          </Stat>
          <Stat>
            <StatFigure>
              <div className="bg-module bg-soft text-module rounded-md p-1.5">
                <CalendarClock className="h-4 w-4" />
              </div>
            </StatFigure>
            <StatTitle>Avg. days to pay</StatTitle>
            <StatValue>
              {collections?.avgDaysToPay != null ? `${collections.avgDaysToPay} days` : '—'}
            </StatValue>
            <StatDesc>
              {collections && collections.paidCount > 0
                ? `Median ${collections.medianDaysToPay ?? '—'} days · ${fmtNumber(collections.paidCount)} paid`
                : 'From finalize to payment'}
            </StatDesc>
          </Stat>
        </Stats>

        {/* Daily action queue — what's blocking the next dollar, every tile live */}
        <ActionQueue title="Needs attention" icon={<AlertTriangle className="h-4 w-4" />}>
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
            count={draftCount}
            label="Drafts to send"
            tone="warning"
          >
            <Link href="/invoicing/documents?status=unpaid" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<Clock className="h-5 w-5" />}
            count={estimatesAwaitingCount}
            label="Awaiting approval"
            tone="module"
          >
            <Link href="/invoicing/documents" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<DollarSign className="h-5 w-5" />}
            count={partialCount}
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
            <p className="text-base-content/50 mt-1.5 mb-4 text-sm">
              Outstanding across{' '}
              <span className="text-base-content/70">
                {aging ? `${fmtNumber(aging.totalCount)} open documents` : 'your open documents'}
              </span>
            </p>
            {agingItems.length > 0 ? (
              <BarList items={agingItems} />
            ) : (
              <p className="text-base-content/50 py-6 text-center text-sm">
                Nothing outstanding — every document is paid or has no balance.
              </p>
            )}
            <div className="border-base-300 mt-4 flex items-center gap-2 border-t pt-3">
              <AlertTriangle aria-hidden className="text-danger h-4 w-4" />
              <span className="text-base-content/50 text-xs">
                <span className="text-danger font-medium">
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
            plain
          >
            {collectedPoints ? (
              <>
                <AreaChart
                  data={collectedPoints}
                  series={[
                    { key: 'collected', label: 'Collected', color: 'module' },
                    {
                      key: 'billed',
                      label: 'Billed',
                      color: 'color-mix(in oklch, var(--color-module) 15%, transparent)',
                    },
                  ]}
                  xKey="label"
                  height={210}
                  valueFormat={{ kind: 'currency', currency }}
                  ariaLabel="Collected vs. billed, last 12 weeks"
                />
                <div className="border-base-300 mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t pt-3 text-sm">
                  {collectedFooter.map(([label, value]) => (
                    <div key={label}>
                      <div className="text-base-content/50 text-xs">{label}</div>
                      <div className="font-medium">{value}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                icon={<TrendingUp className="h-5 w-5" />}
                title="No payments yet"
                description="Collected vs. billed appears as invoices get paid."
              />
            )}
          </OverviewCard>
        </div>

        {/* Recent documents (live) + collections summary */}
        <div className={DOCS_ROW}>
          <OverviewCard
            title="Recent documents"
            icon={<FileText className="h-4 w-4" />}
            description={`${fmtNumber(totalDocuments)} total`}
            right={<CardLink href="/invoicing/documents">All documents</CardLink>}
            plain
          >
            {documents.length > 0 ? (
              <Table>
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Kind</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Balance</th>
                    <th>Status</th>
                    <th className="text-right">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((d) => (
                    <tr key={d.id}>
                      <td className="text-module font-mono text-xs">
                        <Link href={`/invoicing/documents/${d.id}`} className="hover:underline">
                          {d.number ?? 'Draft'}
                        </Link>
                      </td>
                      <td className="font-medium">{stageLabels[d.stageId] ?? '—'}</td>
                      <td className="text-right tabular-nums">
                        {formatMoney(d.total, d.currency)}
                      </td>
                      <td className="text-right tabular-nums">
                        {formatMoney(d.balance, d.currency)}
                      </td>
                      <td>
                        <Badge color={AR_STATUS_VARIANT[d.status] ?? 'neutral'} variant="soft">
                          {d.status}
                        </Badge>
                      </td>
                      <td className="text-base-content/50 text-right tabular-nums">
                        {new Date(d.updatedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState
                icon={<FileText className="h-5 w-5" />}
                title="No documents yet"
                description="Create an estimate or invoice to get started."
                actions={
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href="/invoicing/documents/new" />}
                  >
                    New document
                  </Button>
                }
              />
            )}
          </OverviewCard>

          <OverviewCard title="Collections" icon={<DollarSign className="h-4 w-4" />} plain>
            <p className="text-[1.65rem] leading-none font-medium">
              {collections ? fmtMoneyCents(collections.collectedThisMonthCents, currency) : '—'}
            </p>
            <p className="text-base-content/50 mt-1.5 mb-3 text-sm">
              Collected this month
              {collectedTrend != null ? (
                <>
                  {' '}
                  ·{' '}
                  <span className="text-base-content/70">
                    {collectedTrend >= 0 ? '+' : ''}
                    {fmtPercentRatio(collectedTrend)} vs. last
                  </span>
                </>
              ) : null}
            </p>
            <OverviewRow
              icon={<DollarSign className="h-4 w-4" />}
              tone="success"
              title="Paid in full · 30d"
              hint={
                collections
                  ? `${fmtNumber(collections.paidInFull.count)} document${collections.paidInFull.count === 1 ? '' : 's'} settled`
                  : '—'
              }
              right={collections ? fmtMoneyCents(collections.paidInFull.totalCents, currency) : '—'}
            />
            <OverviewRow
              icon={<Clock className="h-4 w-4" />}
              tone="warning"
              title="Deposits held"
              hint="On open documents"
              right={collections ? fmtMoneyCents(collections.depositsCents, currency) : '—'}
            />
            <OverviewRow
              icon={<CalendarClock className="h-4 w-4" />}
              tone="module"
              title="Avg. days to pay"
              hint="From finalize to settled"
              right={collections?.avgDaysToPay != null ? `${collections.avgDaysToPay} days` : '—'}
            />
            <Button
              variant="outline"
              size="sm"
              className="mt-4 w-full"
              render={<Link href="/invoicing/documents?status=paid" />}
            >
              View paid documents
            </Button>
          </OverviewCard>
        </div>

        {/* Who owes you + status mix + send queue */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <OverviewCard
            title="Who owes you"
            icon={<Users className="h-4 w-4" />}
            right={
              liveDebtors ? (
                <CardLink href="/invoicing/documents?status=overdue">All</CardLink>
              ) : undefined
            }
            plain
          >
            {liveDebtors ? (
              liveDebtors.map((c) => (
                <OverviewRow
                  key={c.customerId}
                  icon={<Users className="h-4 w-4" />}
                  tone={debtorTone(c.oldestOverdueDays)}
                  title={c.name}
                  hint={
                    c.oldestOverdueDays != null
                      ? `${fmtNumber(c.openInvoices)} open · oldest ${fmtNumber(c.oldestOverdueDays)}d past due`
                      : `${fmtNumber(c.openInvoices)} open · within terms`
                  }
                  right={fmtMoneyCents(c.outstandingCents, currency)}
                />
              ))
            ) : (
              <EmptyState
                icon={<CheckCircle2 className="h-5 w-5" />}
                title="Nothing outstanding"
                description="Customers with open balances will appear here."
              />
            )}
          </OverviewCard>

          <OverviewCard
            title="Open balance by stage"
            icon={<ReceiptText className="h-4 w-4" />}
            plain
          >
            {collections ? (
              <>
                <div className="mb-3 grid grid-cols-3 gap-3 text-center">
                  <MetricTile
                    value={fmtMoneyCents(collections.openBalance.estimatesCents, currency)}
                    label="Estimates"
                    tone="module"
                  />
                  <MetricTile
                    value={fmtMoneyCents(collections.openBalance.invoicedOpenCents, currency)}
                    label="Invoiced"
                    tone="warning"
                  />
                  <MetricTile
                    value={fmtMoneyCents(collections.openBalance.overdueCents, currency)}
                    label="Overdue"
                    tone="danger"
                  />
                </div>
                <OverviewRow
                  icon={<FileText className="h-4 w-4" />}
                  tone="module"
                  title="Estimates awaiting approval"
                  hint="Not yet billable"
                  right={
                    <Badge color="neutral" variant="soft">
                      {fmtNumber(collections.openBalance.estimatesCount)} open
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
                      {fmtNumber(collections.openBalance.invoicedOpenCount)} open
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
                      {fmtNumber(collections.openBalance.overdueCount)} open
                    </Badge>
                  }
                />
              </>
            ) : (
              <EmptyState
                icon={<ReceiptText className="h-5 w-5" />}
                title="No open balances yet"
                description="Estimates, invoices, and overdue totals split out here."
              />
            )}
          </OverviewCard>

          <OverviewCard
            title="Send & collect"
            icon={<Send className="h-4 w-4" />}
            right={<CardLink href="/invoicing/documents/new">New</CardLink>}
            plain
          >
            {draftCount > 0 || (overdueCount ?? 0) > 0 ? (
              <>
                <OverviewRow
                  icon={<Send className="h-4 w-4" />}
                  tone="module"
                  title="Drafts ready to send"
                  hint="Finalize to start the clock"
                  right={
                    <Badge color="module" variant="soft">
                      {fmtNumber(draftCount)}
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
                      {fmtNumber(overdueCount ?? 0)}
                    </Badge>
                  }
                />
              </>
            ) : (
              <EmptyState
                icon={<Send className="h-5 w-5" />}
                title="Nothing to send"
                description="Drafts to send and reminders due will surface here."
                actions={
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href="/invoicing/documents/new" />}
                  >
                    New document
                  </Button>
                }
              />
            )}
          </OverviewCard>
        </div>
      </div>
    </div>
  );
}
