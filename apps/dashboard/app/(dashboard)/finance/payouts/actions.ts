'use server';

// Server actions for the Finance → Payouts surface (docs/110 Slice 3). The
// sparx.market settlement reads + the ACH payout-account read/write, moved here from
// the market settings surface. Tenant-scoped via the api-rest client (which forwards
// the staff session); every /v1/market route is gated on the Commerce module + role
// server-side. Reads are plain `api.get`; the write returns an ActionResult so the
// client form surfaces the friendly message.

import 'server-only';
import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-rest-client';
import type {
  ActionResult,
  MarketPayoutAccount,
  MarketSettlementRun,
  MarketSettlementSummary,
} from './_types';

const PAYOUTS_PATH = '/finance/payouts';

// ── Reads ─────────────────────────────────────────────────────────────────────

/** Whether the tenant participates in sparx.market — gates the settlement section. */
export async function getMarketEnabled(): Promise<boolean> {
  try {
    const profile = await api.get<{ enabled: boolean }>('/v1/market/profile');
    return profile.enabled;
  } catch {
    return false;
  }
}

/** The masked payout account, or null when none is on file. */
export async function getMarketPayoutAccount(): Promise<MarketPayoutAccount | null> {
  return api.get<MarketPayoutAccount | null>('/v1/market/payout-account');
}

/** Settlement aggregates. Degrades to null so the page still renders if the reports
 *  read is briefly unreachable. */
export async function getMarketSettlementSummary(): Promise<MarketSettlementSummary | null> {
  return api.get<MarketSettlementSummary>('/v1/market/settlement/summary').catch(() => null);
}

export async function getMarketSettlementRuns(take = 24): Promise<MarketSettlementRun[]> {
  return api.get<MarketSettlementRun[]>(`/v1/market/settlement/runs?take=${take}`).catch(() => []);
}

// ── Writes ──────────────────────────────────────────────────────────────────────

export interface PayoutAccountInput {
  accountHolderName: string;
  bankName?: string;
  routingNumber: string;
  accountNumber: string;
  accountType: 'checking' | 'savings';
}

export async function updatePayoutAccountAction(
  input: PayoutAccountInput
): Promise<ActionResult<MarketPayoutAccount>> {
  try {
    const data = await api.put<MarketPayoutAccount>('/v1/market/payout-account', input);
    revalidatePath(PAYOUTS_PATH);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: { message: err instanceof Error ? err.message : String(err) } };
  }
}
