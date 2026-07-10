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
import { EntityCreateButton } from '../_components/entity-create-button';
import {
  CardLink,
  OverviewCard,
  OverviewRow,
  fmtMoneyCents,
  fmtNumber,
} from '../_components/overview-bits';

// B2B overview — the wholesale book at a glance: revenue pulse, the daily
// action queue, A/R aging (the signature cashflow-risk card), open quotes, and
// the account roster. Every section is wired to the live /v1/b2b/reports/*
// endpoints; a section with no data yet renders a compact empty state rather
// than illustrative sample data. Warm colors (amber/red) stay strictly semantic
// — overdue invoices, aging risk.

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

// `status` here is actually the quote's workflow-stage name (Draft / Submitted
// / Under Review / Quoted / Accepted / Declined / Expired) — a quote IS a
// BillingDocument on the system `b2b-quotes` workflow (docs/87 convergence).
const QUOTE_STATUS_TONE: Record<string, { tone: string; label: string }> = {
  Draft: { tone: 'neutral', label: 'Draft' },
  Submitted: { tone: 'warning', label: 'Sent' },
  'Under Review': { tone: 'warning', label: 'Under review' },
  Quoted: { tone: 'module', label: 'Quoted' },
  Accepted: { tone: 'success', label: 'Accepted' },
  Declined: { tone: 'danger', label: 'Declined' },
  Expired: { tone: 'neutral', label: 'Expired' },
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

interface AccountRow {
  key: string;
  name: string;
  tier: string;
  terms: string;
  spend: string;
}

interface TierRow {
  key: string;
  name: string;
  accounts: string;
}

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
      : [];
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
      : [];

  // Open quotes table.
  const quoteRows: QuoteRow[] = (openQuotes ?? []).map((q) => {
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
  });

  // Top accounts by invoiced amount.
  const accountRows: AccountRow[] = (topAccounts ?? []).map((a) => ({
    key: a.accountId,
    name: a.name,
    tier: a.tier ?? '—',
    terms: `${a.paymentTerms ?? 'No terms'} · ${fmtNumber(a.invoiceCount)} invoice${a.invoiceCount === 1 ? '' : 's'}`,
    spend: fmtMoneyCents(a.invoicedCents),
  }));

  // Price tiers by account count.
  const tierRows: TierRow[] = (summary?.byTier ?? []).map((t) => ({
    key: t.tier,
    name: t.tier,
    accounts: `${fmtNumber(t.count)} account${t.count === 1 ? '' : 's'}`,
  }));

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-8">
        <PageHeader
          icon={<Building2 className="h-5 w-5" />}
          title="B2B"
          description="Wholesale & accounts — last 30 days."
          actions={
            <>
              <Button
                variant="outline"
                iconStart={<Tag className="h-4 w-4" />}
                render={<Link href="/b2b/price-lists" />}
              >
                Price lists
              </Button>
              <EntityCreateButton
                entityType="billing-document"
                newHref="/invoicing/documents/new?workflow=b2b-quotes"
                variant="outline"
                leftIcon={<FileText className="h-4 w-4" />}
              >
                New quote
              </EntityCreateButton>
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
        <Stats className="w-full flex-wrap [&>*]:flex-1">
          <Stat>
            <StatFigure>
              <div className="bg-module bg-soft text-module rounded-md p-1.5">
                <DollarSign className="h-4 w-4" />
              </div>
            </StatFigure>
            <StatTitle>Wholesale revenue · 30d</StatTitle>
            <StatValue>{ts ? fmtMoneyCents(ts.totals.revenueCents) : '—'}</StatValue>
            <StatDesc>Net B2B-portal sales</StatDesc>
          </Stat>
          <Stat>
            <StatFigure>
              <div className="bg-module bg-soft text-module rounded-md p-1.5">
                <Building2 className="h-4 w-4" />
              </div>
            </StatFigure>
            <StatTitle>Active accounts</StatTitle>
            <StatValue>{summary ? fmtNumber(summary.accounts.active) : '—'}</StatValue>
            <StatDesc>
              {summary ? `${fmtNumber(summary.accounts.total)} total` : 'Wholesale accounts'}
            </StatDesc>
          </Stat>
          <Stat>
            <StatFigure>
              <div className="bg-module bg-soft text-module rounded-md p-1.5">
                <FileText className="h-4 w-4" />
              </div>
            </StatFigure>
            <StatTitle>Open quotes</StatTitle>
            <StatValue>{summary ? fmtNumber(summary.openQuotes) : '—'}</StatValue>
            <StatDesc>Awaiting buyer response</StatDesc>
          </Stat>
          <Stat>
            <StatFigure>
              <div className="bg-module bg-soft text-module rounded-md p-1.5">
                <Package className="h-4 w-4" />
              </div>
            </StatFigure>
            <StatTitle>Avg. order value · 30d</StatTitle>
            <StatValue>{aov30 > 0 ? fmtMoneyCents(aov30) : '—'}</StatValue>
            <StatDesc>Across wholesale orders</StatDesc>
          </Stat>
        </Stats>

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

        {/* Accounts receivable / aging (signature, tinted) + wholesale revenue chart */}
        <div className={AGING_ROW}>
          <OverviewCard
            title="Accounts receivable"
            icon={<Receipt className="h-4 w-4" />}
            description="Outstanding by age"
          >
            {summary && summary.invoices.outstandingCount > 0 ? (
              <>
                <p className="text-[1.65rem] leading-none font-medium">
                  {fmtMoneyCents(summary.invoices.outstandingCents)}
                </p>
                <p className="text-base-content/50 mt-1.5 mb-4 text-sm">
                  Outstanding across{' '}
                  <span className="text-base-content/70">
                    {fmtNumber(summary.invoices.outstandingCount)} invoices
                  </span>
                </p>
                <BarList items={agingItems} />
                {summary.invoices.overdueCount > 0 ? (
                  <div className="border-base-300 mt-4 flex items-center gap-2 border-t pt-3">
                    <AlertTriangle aria-hidden className="text-danger h-4 w-4" />
                    <span className="text-base-content/50 text-xs">
                      <span className="text-danger font-medium">
                        {fmtNumber(summary.invoices.overdueCount)} past due
                      </span>{' '}
                      · oldest {fmtNumber(summary.invoices.oldestOverdueDays)} days
                    </span>
                  </div>
                ) : null}
              </>
            ) : (
              <EmptyState
                icon={<Receipt className="h-5 w-5" />}
                title="Nothing outstanding"
                description="Unpaid invoices and their aging will show here."
              />
            )}
          </OverviewCard>

          <OverviewCard
            title="Wholesale revenue"
            icon={<TrendingUp className="h-4 w-4" />}
            description="Net B2B-portal sales · last 14 days"
            plain
          >
            {revPoints.length ? (
              <>
                <AreaChart
                  data={revPoints}
                  series={[{ key: 'revenue', label: 'Revenue', color: 'module' }]}
                  xKey="label"
                  height={210}
                  valueFormat="currency"
                  ariaLabel="Wholesale revenue, last 14 days"
                />
                <div className="border-base-300 mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t pt-3 text-sm">
                  {[
                    ['Orders · 30d', ts ? fmtNumber(ts.totals.ordersCount) : '—'],
                    ['AOV', aov30 > 0 ? fmtMoneyCents(aov30) : '—'],
                    [
                      'Outstanding A/R',
                      summary ? fmtMoneyCents(summary.invoices.outstandingCents) : '—',
                    ],
                  ].map(([label, value]) => (
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
                title="No wholesale revenue yet"
                description="Daily B2B-portal sales appear here once orders land."
              />
            )}
          </OverviewCard>
        </div>

        {/* Open quotes + top accounts */}
        <div className={QUOTES_ROW}>
          <OverviewCard
            title="Open quotes"
            icon={<FileText className="h-4 w-4" />}
            right={<CardLink href="/b2b/quotes">All quotes</CardLink>}
            plain
          >
            {quoteRows.length ? (
              <Table>
                <thead>
                  <tr>
                    <th>Quote</th>
                    <th>Account</th>
                    <th className="text-right">Value</th>
                    <th className="text-right">Sent</th>
                    <th className="text-right">Expires</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {quoteRows.map((q) => (
                    <tr key={q.key}>
                      <td className="text-module font-mono text-xs">{q.label}</td>
                      <td className="font-medium">{q.account}</td>
                      <td className="text-right tabular-nums">{q.value}</td>
                      <td className="text-base-content/50 text-right tabular-nums">{q.sent}</td>
                      <td className="text-base-content/50 text-right tabular-nums">{q.expires}</td>
                      <td>
                        <Badge color={q.tone} variant="soft">
                          {q.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState
                icon={<FileText className="h-5 w-5" />}
                title="No open quotes"
                description="Quotes awaiting a buyer response will show here."
                actions={
                  <EntityCreateButton
                    entityType="billing-document"
                    newHref="/invoicing/documents/new?workflow=b2b-quotes"
                    variant="outline"
                    size="sm"
                  >
                    New quote
                  </EntityCreateButton>
                }
              />
            )}
          </OverviewCard>

          <OverviewCard
            title="Top accounts"
            icon={<Building2 className="h-4 w-4" />}
            right={<CardLink href="/b2b/accounts">All accounts</CardLink>}
            plain
          >
            {accountRows.length ? (
              accountRows.map((a) => (
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
              ))
            ) : (
              <EmptyState
                icon={<Building2 className="h-5 w-5" />}
                title="No accounts yet"
                description="Your highest-value wholesale accounts will rank here."
                actions={
                  <Button variant="outline" size="sm" render={<Link href="/b2b/accounts/new" />}>
                    New account
                  </Button>
                }
              />
            )}
          </OverviewCard>
        </div>

        {/* Pending applications + price tiers + recent activity */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <OverviewCard
            title="Pending applications"
            icon={<CheckCircle2 className="h-4 w-4" />}
            plain
          >
            <EmptyState
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="No pending applications"
              description="New wholesale account requests will queue here for review."
            />
          </OverviewCard>

          <OverviewCard
            title="Price tiers"
            icon={<Tag className="h-4 w-4" />}
            right={<CardLink href="/b2b/price-lists">Manage</CardLink>}
            plain
          >
            {tierRows.length ? (
              tierRows.map((t) => (
                <OverviewRow
                  key={t.key}
                  icon={<Percent className="h-4 w-4" />}
                  tone="module"
                  title={t.name}
                  right={t.accounts}
                />
              ))
            ) : (
              <EmptyState
                icon={<Tag className="h-5 w-5" />}
                title="No price tiers yet"
                description="Group accounts into tiers to apply wholesale pricing."
                actions={
                  <Button variant="outline" size="sm" render={<Link href="/b2b/price-lists" />}>
                    Create tier
                  </Button>
                }
              />
            )}
          </OverviewCard>

          <OverviewCard title="Recent activity" icon={<Clock className="h-4 w-4" />} plain>
            <EmptyState
              icon={<Clock className="h-5 w-5" />}
              title="No recent activity"
              description="Account, quote, and invoice updates will show up here."
            />
          </OverviewCard>
        </div>
      </div>
    </div>
  );
}
