import 'server-only';
import { api } from '@/lib/api-rest-client';
import type { PaymentConfigState, SparxPayBalance } from '../payments/actions';

// The Finance Overview's one composed read (docs/109 §4, docs/110 Slice 2). The hub
// landing is the platform's money dashboard, so this gathers EVERY financial signal a
// tenant has — a revenue/cash-in trend, payout balance + recent payouts, AR aging +
// collections health, channel mix, and the sparx subscription + plan breakdown — in
// one parallel load. Every read is guarded: a disabled module / unreachable report
// degrades to null and its card renders a calm empty (or badged sample) state rather
// than breaking the page. Real-data-or-it-doesn't-ship (D5) — the only illustrative
// data is the trend chart's clearly-badged fallback (the platform liveOr/SampleBadge
// convention) when a tenant has no activity yet.
//
// Money units: commerce / market / billing speak CENTS; the invoicing AR aging +
// collections speak DOLLARS (Decimal money columns). Both are kept explicit so a /100
// never slips into the wrong source.
//
// Types are declared locally (not imported from the section surfaces) so the Overview
// stays decoupled from where those surfaces live — several relocate across docs/110's
// slices, and the Overview should not churn with them. Payments types are the
// exception: payments/actions.ts is itself in finance/ and stable.

export interface RevenueSummary {
  ordersCount: number;
  grossRevenueCents: number;
  refundedCents: number;
  netRevenueCents: number;
  averageOrderValueCents: number;
  currency: string;
}

export interface SettlementSummary {
  grossCents: number;
  commissionCents: number;
  netCents: number;
  paidCents: number;
  pendingCents: number;
  orderCount: number;
}

/** One settled/pending marketplace payout run (newest first) — the payout history. */
export interface SettlementRunRow {
  id: string;
  periodStart: string;
  periodEnd: string;
  netCents: number;
  orderCount: number;
  status: string;
}

export interface ChannelMixRow {
  channel: string;
  label: string;
  orders: number;
  grossRevenueCents: number;
  sharePct: number;
}

export interface ChannelTotals {
  rangeLabel: string;
  totalOrders: number;
  totalGrossRevenueCents: number;
  totalNetAfterFeesCents: number;
  currency: string;
  channelCount: number;
  rows: ChannelMixRow[];
}

export interface ArSummary {
  asOf: string;
  /** Dollars — the aging report mirrors Decimal money columns, not cents. */
  totalOutstanding: number;
  totalCount: number;
  /** Dollars in every bucket past `current` (i.e. actually overdue). */
  overdue: number;
  /** Aging buckets in display order, dollars. */
  buckets: { key: string; label: string; balance: number }[];
}

/** Collections health (invoicing) — the "how fast money comes in" KPIs. Cents. */
export interface CollectionsSummary {
  collectedThisMonthCents: number;
  collectedLastMonthCents: number;
  depositsCents: number;
  avgDaysToPay: number | null;
}

/** Who owes you the most — top debtors by outstanding balance. Cents. */
export interface DebtorRow {
  customerId: string;
  customerName: string;
  openInvoices: number;
  outstandingCents: number;
  oldestOverdueDays: number | null;
}

export interface SubscriptionSummary {
  configured: boolean;
  billingActive: boolean;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  billingInterval: 'monthly' | 'annual';
  planTotalCents: number;
  planModules: { moduleKey: string; monthlyCents: number }[];
  planType: 'standard' | 'enterprise';
}

/** One point on the cash-in trend chart — `amount` in DOLLARS (chart-ready). */
export interface CashInPoint {
  label: string;
  amount: number;
}

/** A normalized money-in trend, sourced from whichever selling motion the tenant
 *  runs: commerce net revenue, or — for a service/invoicing tenant with no store —
 *  cash collected on invoices. `footer` is the gross→net waterfall (cents). */
export interface CashInSeries {
  source: 'commerce' | 'invoicing';
  points: CashInPoint[];
  footer: { label: string; cents: number; negative?: boolean }[];
  netCents: number;
  currency: string;
}

export interface FinanceOverview {
  /** Non-null ⇒ commerce is active (the read is commerce-gated). */
  payments: PaymentConfigState | null;
  revenue: RevenueSummary | null;
  cashIn: CashInSeries | null;
  payoutBalance: SparxPayBalance | null;
  settlement: SettlementSummary | null;
  settlementRuns: SettlementRunRow[];
  channels: ChannelTotals | null;
  receivables: ArSummary | null;
  collections: CollectionsSummary | null;
  topDebtors: DebtorRow[];
  subscription: SubscriptionSummary | null;
}

// ── Raw endpoint shapes (only the fields the Overview consumes) ──────────────────

interface RawTimeseriesPoint {
  bucket: string;
  ordersCount?: number;
  grossCents?: number;
  discountCents?: number;
  refundedCents?: number;
  netCents?: number;
  paymentsCount?: number;
  collectedCents?: number;
  billedCents?: number;
}
interface RawRevenueTimeseries {
  points: RawTimeseriesPoint[];
  totals: {
    ordersCount: number;
    grossCents: number;
    discountCents: number;
    refundedCents: number;
    netCents: number;
  };
  currency: string;
}
interface RawCollectedTimeseries {
  points: RawTimeseriesPoint[];
  totals: {
    paymentsCount: number;
    invoicesCount: number;
    collectedCents: number;
    refundedCents: number;
    billedCents: number;
  };
  currency: string;
}
interface RawChannelReport {
  rangeLabel: string;
  totalOrders: number;
  totalGrossRevenueCents: number;
  totalNetAfterFeesCents: number;
  currency: string;
  byChannel: {
    channel: string;
    label: string;
    orders: number;
    grossRevenueCents: number;
    sharePct: number;
  }[];
}
interface RawAging {
  asOf: string;
  buckets: { key: string; balance: number }[];
  totalOutstanding: number;
  totalCount: number;
}
interface RawCollections {
  collectedThisMonthCents: number;
  collectedLastMonthCents: number;
  depositsCents: number;
  avgDaysToPay: number | null;
}
interface RawBilling {
  configured: boolean;
  billingActive: boolean;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  billingInterval: 'monthly' | 'annual';
  planModules: { moduleKey: string; monthlyCents: number }[];
  planTotalCents: number;
  planType: 'standard' | 'enterprise';
}

const AGING_LABELS: Record<string, string> = {
  current: 'Current',
  d1_30: '1–30 days',
  d31_60: '31–60 days',
  d60plus: '60+ days',
};

async function safe<T>(p: Promise<T>): Promise<T | null> {
  return p.then((v) => v).catch(() => null);
}

function bucketLabel(bucket: string): string {
  return new Date(`${bucket}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

// Normalize whichever selling motion the tenant runs into one cash-in trend.
// Commerce net revenue leads (it consolidates storefront + marketplace + B2B orders);
// a store-less invoicing/service tenant falls back to cash collected on invoices.
function buildCashIn(
  rev: RawRevenueTimeseries | null,
  collected: RawCollectedTimeseries | null
): CashInSeries | null {
  if (rev && rev.totals.ordersCount > 0) {
    return {
      source: 'commerce',
      points: rev.points.map((p) => ({
        label: bucketLabel(p.bucket),
        amount: (p.netCents ?? 0) / 100,
      })),
      footer: [
        { label: 'Gross', cents: rev.totals.grossCents },
        { label: 'Discounts', cents: rev.totals.discountCents, negative: true },
        { label: 'Refunds', cents: rev.totals.refundedCents, negative: true },
        { label: 'Net', cents: rev.totals.netCents },
      ],
      netCents: rev.totals.netCents,
      currency: rev.currency,
    };
  }
  if (collected && collected.totals.paymentsCount > 0) {
    return {
      source: 'invoicing',
      points: collected.points.map((p) => ({
        label: bucketLabel(p.bucket),
        amount: (p.collectedCents ?? 0) / 100,
      })),
      footer: [
        { label: 'Billed', cents: collected.totals.billedCents },
        { label: 'Refunds', cents: collected.totals.refundedCents, negative: true },
        { label: 'Collected', cents: collected.totals.collectedCents },
      ],
      netCents: collected.totals.collectedCents,
      currency: collected.currency,
    };
  }
  return null;
}

export async function loadFinanceOverview(): Promise<FinanceOverview> {
  const now = Date.now();
  const from = new Date(now - 30 * 86_400_000).toISOString();
  const to = new Date(now).toISOString();
  const range = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  const [
    payments,
    revenue,
    revenueTs,
    collectedTs,
    payoutBalance,
    settlement,
    settlementRuns,
    channelsRaw,
    agingRaw,
    collections,
    debtors,
    billingRaw,
  ] = await Promise.all([
    safe(api.get<PaymentConfigState>('/v1/commerce/payments/config')),
    safe(api.get<RevenueSummary>(`/v1/commerce/reports/revenue-summary?${range}`)),
    safe(
      api.get<RawRevenueTimeseries>(`/v1/commerce/reports/revenue-timeseries?${range}&grain=day`)
    ),
    safe(
      api.get<RawCollectedTimeseries>(
        `/v1/invoicing/reports/collected-timeseries?${range}&grain=day`
      )
    ),
    safe(api.get<SparxPayBalance | null>('/v1/commerce/payments/sparx-pay/balance')),
    safe(api.get<SettlementSummary>('/v1/market/settlement/summary')),
    safe(api.get<SettlementRunRow[]>('/v1/market/settlement/runs?take=4')),
    safe(api.get<RawChannelReport>(`/v1/commerce/reports/channel-revenue?${range}`)),
    // No scope ⇒ AR across Invoicing documents AND B2B invoices (one BillingDocument
    // table since Phase 8) — the unified receivables summary (docs/110 GAP B).
    safe(api.get<RawAging>('/v1/invoicing/aging')),
    safe(api.get<RawCollections>('/v1/invoicing/reports/collections')),
    safe(api.get<DebtorRow[]>('/v1/invoicing/reports/customer-breakdown?limit=3')),
    safe(api.get<RawBilling>('/v1/billing')),
  ]);

  const channels: ChannelTotals | null = channelsRaw
    ? {
        rangeLabel: channelsRaw.rangeLabel,
        totalOrders: channelsRaw.totalOrders,
        totalGrossRevenueCents: channelsRaw.totalGrossRevenueCents,
        totalNetAfterFeesCents: channelsRaw.totalNetAfterFeesCents,
        currency: channelsRaw.currency,
        channelCount: channelsRaw.byChannel.length,
        rows: channelsRaw.byChannel,
      }
    : null;

  const receivables: ArSummary | null = agingRaw
    ? {
        asOf: agingRaw.asOf,
        totalOutstanding: agingRaw.totalOutstanding,
        totalCount: agingRaw.totalCount,
        overdue: agingRaw.buckets
          .filter((b) => b.key !== 'current')
          .reduce((n, b) => n + b.balance, 0),
        buckets: agingRaw.buckets.map((b) => ({
          key: b.key,
          label: AGING_LABELS[b.key] ?? b.key,
          balance: b.balance,
        })),
      }
    : null;

  const subscription: SubscriptionSummary | null = billingRaw
    ? {
        configured: billingRaw.configured,
        billingActive: billingRaw.billingActive,
        subscriptionStatus: billingRaw.subscriptionStatus,
        trialEndsAt: billingRaw.trialEndsAt,
        currentPeriodEnd: billingRaw.currentPeriodEnd,
        cancelAtPeriodEnd: billingRaw.cancelAtPeriodEnd,
        billingInterval: billingRaw.billingInterval,
        planTotalCents: billingRaw.planTotalCents,
        planModules: billingRaw.planModules,
        planType: billingRaw.planType,
      }
    : null;

  return {
    payments,
    revenue,
    cashIn: buildCashIn(revenueTs, collectedTs),
    payoutBalance,
    settlement,
    settlementRuns: settlementRuns ?? [],
    channels,
    receivables,
    collections,
    topDebtors: debtors ?? [],
    subscription,
  };
}
