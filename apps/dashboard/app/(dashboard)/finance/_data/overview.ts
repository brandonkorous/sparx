import 'server-only';
import { api } from '@/lib/api-rest-client';
import type { PaymentConfigState, SparxPayBalance } from '../payments/actions';

// The Finance Overview's one composed read (docs/110 Slice 2, D5: real-data-or-it-
// doesn't-ship). Every financial signal the hub summarizes, gathered in parallel and
// each guarded so a disabled module / unreachable report degrades to null — the card
// then renders a calm empty or "set up" state instead of crashing the whole page.
//
// Types are declared locally (not imported from the section surfaces) so the Overview
// stays decoupled from where those surfaces live — several of them relocate across
// docs/110's slices, and the Overview should not churn with them. Payments types are
// the exception: payments/actions.ts is itself in finance/ and stable.

export interface SettlementSummary {
  grossCents: number;
  commissionCents: number;
  netCents: number;
  paidCents: number;
  pendingCents: number;
  orderCount: number;
}

export interface ChannelTotals {
  rangeLabel: string;
  totalOrders: number;
  totalGrossRevenueCents: number;
  totalNetAfterFeesCents: number;
  totalChannelFeeCents: number;
  currency: string;
  channelCount: number;
}

export interface ArSummary {
  asOf: string;
  /** Dollars — the aging report mirrors Decimal money columns, not cents. */
  totalOutstanding: number;
  totalCount: number;
  /** Dollars in every bucket past `current` (i.e. actually overdue). */
  overdue: number;
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
  planModuleCount: number;
  planType: 'standard' | 'enterprise';
}

export interface FinanceOverview {
  /** Non-null ⇒ commerce is active (the read is commerce-gated). Drives whether the
   *  "you get paid" commerce cards show at all. */
  payments: PaymentConfigState | null;
  payoutBalance: SparxPayBalance | null;
  settlement: SettlementSummary | null;
  channels: ChannelTotals | null;
  receivables: ArSummary | null;
  subscription: SubscriptionSummary | null;
}

interface RawChannelReport {
  rangeLabel: string;
  totalOrders: number;
  totalGrossRevenueCents: number;
  totalNetAfterFeesCents: number;
  totalChannelFeeCents: number;
  byChannel: { channel: string }[];
  currency: string;
}

interface RawAging {
  asOf: string;
  buckets: { key: string; balance: number }[];
  totalOutstanding: number;
  totalCount: number;
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

async function safe<T>(p: Promise<T>): Promise<T | null> {
  return p.then((v) => v).catch(() => null);
}

export async function loadFinanceOverview(): Promise<FinanceOverview> {
  const [payments, payoutBalance, settlement, channelsRaw, agingRaw, billingRaw] =
    await Promise.all([
      safe(api.get<PaymentConfigState>('/v1/commerce/payments/config')),
      safe(api.get<SparxPayBalance | null>('/v1/commerce/payments/sparx-pay/balance')),
      safe(api.get<SettlementSummary>('/v1/market/settlement/summary')),
      safe(api.get<RawChannelReport>('/v1/commerce/reports/channel-revenue')),
      // No scope ⇒ AR across Invoicing documents AND B2B invoices (one BillingDocument
      // table since Phase 8), which is the unified receivables summary (docs/110 GAP B).
      safe(api.get<RawAging>('/v1/invoicing/aging')),
      safe(api.get<RawBilling>('/v1/billing')),
    ]);

  const channels: ChannelTotals | null = channelsRaw
    ? {
        rangeLabel: channelsRaw.rangeLabel,
        totalOrders: channelsRaw.totalOrders,
        totalGrossRevenueCents: channelsRaw.totalGrossRevenueCents,
        totalNetAfterFeesCents: channelsRaw.totalNetAfterFeesCents,
        totalChannelFeeCents: channelsRaw.totalChannelFeeCents,
        currency: channelsRaw.currency,
        channelCount: channelsRaw.byChannel.length,
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
        planModuleCount: billingRaw.planModules.length,
        planType: billingRaw.planType,
      }
    : null;

  return { payments, payoutBalance, settlement, channels, receivables, subscription };
}
