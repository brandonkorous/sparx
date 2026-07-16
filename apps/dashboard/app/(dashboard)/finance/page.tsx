import * as React from 'react';
import {
  Banknote,
  Clock,
  CreditCard,
  DollarSign,
  Landmark,
  ReceiptText,
  Store,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { isModuleEnabled, requireSession } from '@sparx/auth';
import {
  Badge,
  Stat,
  StatDesc,
  StatFigure,
  Stats,
  StatTitle,
  StatValue,
} from '@wizeworks/silicaui-react';
import { AreaChart, ModuleProvider, PageHeader, statusLabel, statusTone } from '@sparx/ui';

import {
  CardLink,
  MetricTile,
  OverviewCard,
  OverviewRow,
  SampleBadge,
  fmtMoneyCents,
  fmtNumber,
  liveOr,
} from '../_components/overview-bits';
import { fmtDate, fmtDollars } from './_lib/format';
import { loadFinanceOverview, type FinanceOverview } from './_data/overview';
import { FinanceUpsellCard, MONEY_IN_UPSELLS } from './_components/finance-upsell-card';

// The Finance Overview (docs/109 §4, docs/110 Slice 2) — the platform's money
// dashboard. Not five summary tiles: the whole financial picture on one screen, real
// data, grouped by the money-flow split (docs/109 §4.1) — "You get paid" vs "You pay
// sparx." A headline KPI strip, a cash-in trend, payout balance + recent payouts, AR
// aging + collections health, channel mix, payment status, and the sparx plan.
//
// Adaptive by tenant: a commerce shop sees the full dashboard; a service/invoicing
// tenant sees cash-collected + AR; a content-only publisher sees the "Grow how you get
// paid" upsell menu instead of empty cards. Every card is a live read with a calm
// empty/zero state; the only illustrative data is the trend chart's badged fallback
// (liveOr/SampleBadge) when a tenant has no activity yet. The one tinted (finance-
// green) card is the "Money in" hero — every other finance card stays plain so the hue
// is wayfinding, not a wall of green (root CLAUDE.md). Upsell cards wear their TARGET
// module's hue (one card per hue), so they pop as opportunities, not finance signals.

export const dynamic = 'force-dynamic';

// Human plan-line labels for the "What you pay for" breakdown.
const PLAN_LABELS: Record<string, string> = {
  builder: 'Builder',
  commerce: 'Commerce',
  cms: 'CMS',
  crm: 'CRM',
  email: 'Email',
  b2b: 'B2B · Fleet',
  ai: 'AI · MCP',
  dropship: 'Dropship',
  invoicing: 'Invoicing',
  inventory: 'Inventory',
  chat: 'Live Chat',
  scheduling: 'Scheduling',
};

// Illustrative cash-in trend — shown ONLY behind a SampleBadge when an active selling
// tenant has no orders in the window yet (liveOr flips it to real on the first sale).
const SAMPLE_CASH_IN = [
  { label: 'May 17', amount: 812 },
  { label: 'May 19', amount: 1340 },
  { label: 'May 21', amount: 1098 },
  { label: 'May 23', amount: 1620 },
  { label: 'May 25', amount: 1423 },
  { label: 'May 27', amount: 1888 },
  { label: 'May 29', amount: 2103 },
  { label: 'May 31', amount: 1976 },
];

function financeCurrency(o: FinanceOverview): string {
  return o.cashIn?.currency ?? o.revenue?.currency ?? o.channels?.currency ?? 'USD';
}

export default async function FinanceOverviewPage() {
  const [session, o] = await Promise.all([requireSession(), loadFinanceOverview()]);
  const canActivate = session.user.role === 'owner' || session.user.role === 'admin';
  const currency = financeCurrency(o);

  // A money-in capability decides whether the signal cards belong here at all. A
  // content-only publisher has none — their "You get paid" group becomes the upsell
  // menu instead of a row of empty cards.
  const hasMoneyIn = o.payments !== null || o.receivables !== null;

  // Upsell the money-in modules that are genuinely OFF (isModuleEnabled honors the
  // BUNDLED_FREE graph, so Invoicing is never pitched to a Commerce/B2B tenant).
  const enabled = await Promise.all(
    MONEY_IN_UPSELLS.map((u) => isModuleEnabled(session.user.tenantId, u.module))
  );
  const upsells = MONEY_IN_UPSELLS.filter((_, i) => !enabled[i]);

  return (
    <ModuleProvider module="finance">
      <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 py-10">
          <PageHeader
            icon={<Landmark className="h-5 w-5" />}
            title="Finance"
            description="Your money at a glance — how you get paid, where it lands, what you're owed, and what you pay sparx."
          />

          <FinanceKpis o={o} currency={currency} />

          <div className="flex flex-col gap-4">
            <FlowHeader
              title="You get paid"
              description="Money coming to you — from customers, marketplaces, and accounts."
            />
            {hasMoneyIn ? <GetPaidCards o={o} currency={currency} /> : null}
            {upsells.length > 0 ? (
              <GrowGetPaid upsells={upsells} canActivate={canActivate} lead={!hasMoneyIn} />
            ) : null}
          </div>

          <div className="flex flex-col gap-4">
            <FlowHeader
              title="You pay sparx"
              description="One bill for every module you activate — separate from the money coming in."
            />
            <PaySparxCards o={o} />
          </div>
        </div>
      </div>
    </ModuleProvider>
  );
}

function FlowHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="text-base-content text-sm">{description}</p>
    </div>
  );
}

// ── Headline KPIs ────────────────────────────────────────────
// The four-quadrant money snapshot: in, landing, owed-to-you, out. Each is a live
// figure with an actionable hint; an absent capability shows "—" + a nudge.
function FinanceKpis({ o, currency }: { o: FinanceOverview; currency: string }) {
  const moneyInCents = o.cashIn?.netCents ?? o.revenue?.netRevenueCents ?? null;
  const revenueHint = o.revenue
    ? `${fmtNumber(o.revenue.ordersCount)} orders · AOV ${fmtMoneyCents(o.revenue.averageOrderValueCents, currency)}`
    : o.cashIn?.source === 'invoicing'
      ? 'Cash collected · last 30 days'
      : 'Start selling to see revenue';

  const availableCents = o.payoutBalance?.availableCents ?? o.settlement?.pendingCents ?? null;
  const availableHint = o.payoutBalance
    ? `${fmtMoneyCents(o.payoutBalance.pendingCents, currency)} settling`
    : o.settlement && o.settlement.orderCount > 0
      ? 'Pending marketplace settlement'
      : 'Set up payouts to get paid';

  const arDollars = o.receivables?.totalOutstanding ?? null;
  const arHint = o.receivables
    ? o.receivables.overdue > 0
      ? `${fmtDollars(o.receivables.overdue)} overdue`
      : `${fmtNumber(o.receivables.totalCount)} open invoice${o.receivables.totalCount === 1 ? '' : 's'}`
    : 'Send invoices to track receivables';

  const sub = o.subscription;
  const interval = sub?.billingInterval === 'annual' ? '/yr' : '/mo';
  const nextBilling = fmtDate(sub?.currentPeriodEnd ?? null);

  return (
    <Stats className="w-full flex-wrap [&>*]:flex-1">
      <Stat>
        <StatFigure>
          <div className="bg-module bg-soft text-module rounded-md p-1.5">
            <TrendingUp className="h-4 w-4" />
          </div>
        </StatFigure>
        <StatTitle>Revenue · 30d</StatTitle>
        <StatValue>{moneyInCents != null ? fmtMoneyCents(moneyInCents, currency) : '—'}</StatValue>
        <StatDesc>{revenueHint}</StatDesc>
      </Stat>
      <Stat>
        <StatFigure>
          <div className="bg-module bg-soft text-module rounded-md p-1.5">
            <Banknote className="h-4 w-4" />
          </div>
        </StatFigure>
        <StatTitle>Available to pay out</StatTitle>
        <StatValue>
          {availableCents != null ? fmtMoneyCents(availableCents, currency) : '—'}
        </StatValue>
        <StatDesc>{availableHint}</StatDesc>
      </Stat>
      <Stat>
        <StatFigure>
          <div className="bg-module bg-soft text-module rounded-md p-1.5">
            <ReceiptText className="h-4 w-4" />
          </div>
        </StatFigure>
        <StatTitle>Outstanding AR</StatTitle>
        <StatValue>
          {arDollars != null ? fmtMoneyCents(Math.round(arDollars * 100), currency) : '—'}
        </StatValue>
        <StatDesc>{arHint}</StatDesc>
      </Stat>
      <Stat>
        <StatFigure>
          <div className="bg-module bg-soft text-module rounded-md p-1.5">
            <CreditCard className="h-4 w-4" />
          </div>
        </StatFigure>
        <StatTitle>You pay sparx</StatTitle>
        <StatValue>
          {sub ? `${fmtMoneyCents(sub.planTotalCents, currency)}${interval}` : '—'}
        </StatValue>
        <StatDesc>
          {sub
            ? nextBilling
              ? `Next billing ${nextBilling}`
              : 'Modules you have on today'
            : 'Activate a module to see your plan'}
        </StatDesc>
      </Stat>
    </Stats>
  );
}

// ── "You get paid" signal cards ──────────────────────────────
// Bento, not a hard grid: the cash-in chart and Receivables (whose metric tiles want
// width) anchor a WIDE feature column; the simple list/status cards stack in a NARROW
// sidebar. Each column is an independent natural-height stack (lg:items-start) so they
// pack tight — no card balloons to match a tall neighbor, the empty-grid-cell void the
// hard grid produced. A store-less invoicing tenant has no sidebar cards, so the two
// feature cards share a simple two-up row instead of leaving a blank sidebar.
function GetPaidCards({ o, currency }: { o: FinanceOverview; currency: string }) {
  const hasSidebar = o.payments != null || o.channels != null;

  const feature = (
    <>
      <MoneyInCard o={o} currency={currency} />
      {o.receivables ? <ReceivablesCard o={o} currency={currency} /> : null}
    </>
  );

  if (!hasSidebar) {
    return <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">{feature}</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr] lg:items-start">
      <div className="flex flex-col gap-4">{feature}</div>
      <div className="flex flex-col gap-4">
        {o.payments ? <PayoutsCard o={o} currency={currency} /> : null}
        {o.channels ? <ChannelMixCard o={o} currency={currency} /> : null}
        {o.payments ? <PaymentsStatusCard o={o} /> : null}
      </div>
    </div>
  );
}

function neg(cents: number, currency: string, negative?: boolean): string {
  const f = fmtMoneyCents(cents, currency);
  return negative && cents > 0 ? `−${f}` : f;
}

// The cash-in hero — the one finance-tinted (primary) card. Net revenue for a commerce
// tenant; cash collected for a store-less invoicing tenant. Sample only until activity.
function MoneyInCard({ o, currency }: { o: FinanceOverview; currency: string }) {
  const series = liveOr(o.cashIn?.points ?? null, SAMPLE_CASH_IN, { min: 2 });
  const isInvoicing = o.cashIn?.source === 'invoicing';
  const footer = !series.isSample && o.cashIn ? o.cashIn.footer : null;
  return (
    <OverviewCard
      title="Money in"
      icon={<TrendingUp className="h-4 w-4" />}
      description={isInvoicing ? 'Cash collected, last 30 days' : 'Net revenue, last 30 days'}
      right={series.isSample ? <SampleBadge reason="no-data" /> : undefined}
    >
      <AreaChart
        data={series.data}
        series={[{ key: 'amount', label: isInvoicing ? 'Collected' : 'Revenue', color: 'module' }]}
        xKey="label"
        height={210}
        valueFormat={{ kind: 'currency', currency }}
        ariaLabel="Money in, last 30 days"
      />
      {footer ? (
        <div className="border-base-300 mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t pt-3 text-sm">
          {footer.map((f) => (
            <div key={f.label}>
              <div className="text-base-content text-xs">{f.label}</div>
              <div className="font-medium tabular-nums">{neg(f.cents, currency, f.negative)}</div>
            </div>
          ))}
        </div>
      ) : null}
    </OverviewCard>
  );
}

function PayoutsCard({ o, currency }: { o: FinanceOverview; currency: string }) {
  const b = o.payoutBalance;
  const cadence =
    b?.payoutInterval && b.payoutInterval !== 'manual'
      ? `${statusLabel(b.payoutInterval)} payouts`
      : null;
  return (
    <OverviewCard
      title="Payouts"
      icon={<Banknote className="h-4 w-4" />}
      right={<CardLink href="/finance/payouts">Manage</CardLink>}
      plain
    >
      {b ? (
        <>
          <p className="text-[1.65rem] leading-none font-medium tabular-nums">
            {fmtMoneyCents(b.availableCents, currency)}
          </p>
          <p className="text-base-content mt-1.5 mb-3 text-sm">
            Available to pay out{cadence ? ` · ${cadence}` : ''}
          </p>
          <OverviewRow
            icon={<Clock className="h-4 w-4" />}
            tone="warning"
            title="Settling"
            hint="From recent sales"
            right={fmtMoneyCents(b.pendingCents, currency)}
          />
          {o.settlementRuns.slice(0, 2).map((r) => (
            <OverviewRow
              key={r.id}
              icon={<DollarSign className="h-4 w-4" />}
              tone="success"
              title={fmtDate(r.periodEnd) ?? 'Payout'}
              hint={`${fmtNumber(r.orderCount)} order${r.orderCount === 1 ? '' : 's'}`}
              right={fmtMoneyCents(r.netCents, currency)}
            />
          ))}
        </>
      ) : o.settlement && o.settlement.orderCount > 0 ? (
        <>
          <p className="text-[1.65rem] leading-none font-medium tabular-nums">
            {fmtMoneyCents(o.settlement.pendingCents, currency)}
          </p>
          <p className="text-base-content mt-1.5 mb-3 text-sm">Pending marketplace settlement</p>
          <OverviewRow
            icon={<DollarSign className="h-4 w-4" />}
            tone="success"
            title="Paid out"
            hint={`${fmtNumber(o.settlement.orderCount)} orders settled`}
            right={fmtMoneyCents(o.settlement.paidCents, currency)}
          />
        </>
      ) : (
        <p className="text-base-content py-1 text-sm">
          No payouts yet — finish sparx Pay setup to start receiving money.
        </p>
      )}
    </OverviewCard>
  );
}

function ReceivablesCard({ o, currency }: { o: FinanceOverview; currency: string }) {
  const ar = o.receivables;
  if (!ar || ar.totalCount === 0) {
    return (
      <OverviewCard
        title="Receivables"
        icon={<ReceiptText className="h-4 w-4" />}
        right={<CardLink href="/finance/receivables">All</CardLink>}
        plain
      >
        <p className="text-base-content py-1 text-sm">
          Nothing outstanding — every invoice is paid.
        </p>
      </OverviewCard>
    );
  }
  const top = o.topDebtors[0];
  return (
    <OverviewCard
      title="Receivables"
      icon={<ReceiptText className="h-4 w-4" />}
      right={<CardLink href="/finance/receivables">All</CardLink>}
      plain
    >
      <div className="mb-3 grid grid-cols-2 gap-3 text-center">
        <MetricTile value={fmtDollars(ar.totalOutstanding, currency)} label="Outstanding" />
        <MetricTile
          value={ar.overdue > 0 ? fmtDollars(ar.overdue, currency) : '—'}
          label="Overdue"
          tone={ar.overdue > 0 ? 'danger' : 'default'}
        />
      </div>
      {ar.buckets
        .filter((bucket) => bucket.balance > 0)
        .map((bucket) => (
          <OverviewRow
            key={bucket.key}
            icon={<ReceiptText className="h-4 w-4" />}
            tone={
              bucket.key === 'd60plus' ? 'danger' : bucket.key === 'd31_60' ? 'warning' : 'module'
            }
            title={bucket.label}
            right={fmtDollars(bucket.balance, currency)}
          />
        ))}
      {top ? (
        <p className="text-base-content mt-3 text-xs">
          {top.customerName} owes the most · {fmtMoneyCents(top.outstandingCents, currency)}
          {o.collections?.avgDaysToPay != null
            ? ` · ${o.collections.avgDaysToPay}d avg to pay`
            : ''}
        </p>
      ) : null}
    </OverviewCard>
  );
}

function ChannelMixCard({ o, currency }: { o: FinanceOverview; currency: string }) {
  const ch = o.channels;
  return (
    <OverviewCard
      title="Sales by channel"
      icon={<Store className="h-4 w-4" />}
      description="Where your orders come from · 30 days"
      right={<CardLink href="/finance/channels">Detail</CardLink>}
      plain
    >
      {ch && ch.rows.length > 0 ? (
        ch.rows.map((row) => (
          <OverviewRow
            key={row.channel}
            icon={<Store className="h-4 w-4" />}
            tone="module"
            title={row.label}
            hint={`${fmtNumber(row.orders)} order${row.orders === 1 ? '' : 's'} · ${row.sharePct}%`}
            right={fmtMoneyCents(row.grossRevenueCents, currency)}
          />
        ))
      ) : (
        <p className="text-base-content py-1 text-sm">No channel sales in the last 30 days yet.</p>
      )}
    </OverviewCard>
  );
}

function PaymentsStatusCard({ o }: { o: FinanceOverview }) {
  const live = o.payments?.isActive ?? false;
  return (
    <OverviewCard
      title="Payments"
      icon={<Wallet className="h-4 w-4" />}
      right={<CardLink href="/finance/payments">Manage</CardLink>}
      plain
    >
      <div className="mb-1 flex items-center gap-2">
        <Badge color={live ? 'success' : 'warning'} variant="soft">
          {live ? 'Accepting payments' : 'Setup needed'}
        </Badge>
      </div>
      <p className="text-base-content text-sm">
        {live
          ? 'Checkout is live — cards are being accepted.'
          : 'Finish payment setup so customers can check out.'}
      </p>
    </OverviewCard>
  );
}

// ── "Grow how you get paid" — the upsell subsection ──────────
// Finance is the highest-intent adoption surface, so off money-in capabilities are
// framed as adjacent opportunities, set apart from real signals (never interleaved).
// For a content-only tenant this IS the "You get paid" content; `lead` drops the
// sub-label so it doesn't read as secondary.
function GrowGetPaid({
  upsells,
  canActivate,
  lead,
}: {
  upsells: typeof MONEY_IN_UPSELLS;
  canActivate: boolean;
  lead: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {!lead ? (
        <p className="text-base-content text-sm font-medium">Grow how you get paid</p>
      ) : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {upsells.map((u) => (
          <FinanceUpsellCard
            key={u.module}
            module={u.module}
            pitch={u.pitch}
            canActivate={canActivate}
          />
        ))}
      </div>
    </div>
  );
}

// ── "You pay sparx" ──────────────────────────────────────────
// ONE card, not two — the bill is a single thing. A summary header (price · status ·
// trial) over the itemized plan in a two-column inner grid + total. Splitting it into a
// sparse summary card beside a tall list ballooned the summary into an empty void; this
// keeps the section dense and balanced.
function PaySparxCards({ o }: { o: FinanceOverview }) {
  const sub = o.subscription;
  const interval = sub?.billingInterval === 'annual' ? '/yr' : '/mo';
  const status = sub?.subscriptionStatus ?? null;
  const nextBilling = fmtDate(sub?.currentPeriodEnd ?? null);
  const trialEnds = fmtDate(sub?.trialEndsAt ?? null);
  const enterprise = sub?.planType === 'enterprise';
  const note = enterprise
    ? 'Your account team handles billing.'
    : status === 'trialing' && trialEnds
      ? `Free trial ends ${trialEnds}.`
      : nextBilling
        ? `Next billing date ${nextBilling}.`
        : sub?.billingActive
          ? 'Billed monthly for the modules you have on.'
          : 'Billing isn’t live yet — this is what you’ll pay when it switches on.';
  const itemized = !enterprise && sub && sub.planModules.length > 0;

  return (
    <OverviewCard
      title="sparx subscription"
      icon={<CreditCard className="h-4 w-4" />}
      right={<CardLink href="/finance/subscription">Manage billing</CardLink>}
      plain
    >
      <div className="border-base-300 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b pb-4">
        <div className="flex items-center gap-3">
          {enterprise ? (
            <p className="text-[1.65rem] leading-none font-medium">Managed</p>
          ) : (
            <p className="text-[1.65rem] leading-none font-medium tabular-nums">
              {sub ? fmtMoneyCents(sub.planTotalCents) : '—'}
              <span className="text-base-content text-base font-normal">{sub ? interval : ''}</span>
            </p>
          )}
          {status ? (
            <Badge color={statusTone(status)} variant="soft">
              {statusLabel(status)}
              {sub?.cancelAtPeriodEnd ? ' · cancels' : ''}
            </Badge>
          ) : enterprise ? (
            <Badge color="info" variant="soft">
              Enterprise
            </Badge>
          ) : null}
        </div>
        <p className="text-base-content text-sm">{note}</p>
      </div>

      {itemized ? (
        <>
          <p className="text-base-content mt-4 mb-1 text-xs">What you pay for</p>
          <div className="grid gap-x-10 sm:grid-cols-2">
            {sub.planModules.map((m) => (
              <div key={m.moduleKey} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-base-content">{PLAN_LABELS[m.moduleKey] ?? m.moduleKey}</span>
                <span className="font-medium tabular-nums">
                  {fmtMoneyCents(m.monthlyCents)}
                  {interval}
                </span>
              </div>
            ))}
          </div>
          <div className="border-base-300 mt-2 flex items-center justify-between border-t pt-3 text-sm font-medium">
            <span>Total</span>
            <span className="tabular-nums">
              {fmtMoneyCents(sub.planTotalCents)}
              {interval}
            </span>
          </div>
        </>
      ) : !enterprise ? (
        <p className="text-base-content pt-4 text-sm">
          No billable modules active yet. Turn one on from Settings → Modules.
        </p>
      ) : null}
    </OverviewCard>
  );
}
