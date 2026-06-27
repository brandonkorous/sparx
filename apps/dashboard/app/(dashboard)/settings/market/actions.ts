'use server';

// Server actions for the sparx.market settings page (docs/106 §4.7). Tenant-scoped
// via the api-rest client (which forwards the staff session); every route is gated
// on the Commerce module + role server-side. Reads are plain `api.get`; writes
// return an ActionResult so the client forms surface the friendly message.

import 'server-only';
import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-rest-client';
import type {
  ActionResult,
  MarketListedProducts,
  MarketProfile,
  ProductMarketState,
} from './_types';

const MARKET_PATH = '/settings/market';

// Settlement earnings + the ACH payout account moved to Finance → Payouts (docs/110
// Slice 3) — their reads + the payout-account write now live in finance/payouts/actions.ts.

// ── Reads ─────────────────────────────────────────────────────────────────────

export async function getMarketProfile(): Promise<MarketProfile> {
  return api.get<MarketProfile>('/v1/market/profile');
}

export async function getMarketListedProducts(take = 100): Promise<MarketListedProducts> {
  return api.get<MarketListedProducts>(`/v1/market/products?take=${take}&skip=0`);
}

// ── Writes ──────────────────────────────────────────────────────────────────────

export interface MarketProfileInput {
  enabled: boolean;
  bio?: string | null;
  location?: string | null;
  headline?: string | null;
  bannerMediaId?: string | null;
  defaultCategory?: string | null;
}

export async function updateMarketProfileAction(
  input: MarketProfileInput
): Promise<ActionResult<MarketProfile>> {
  try {
    const data = await api.put<MarketProfile>('/v1/market/profile', input);
    revalidatePath(MARKET_PATH);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: { message: err instanceof Error ? err.message : String(err) } };
  }
}

export async function setProductListedAction(
  productId: string,
  input: { listed: boolean; category?: string }
): Promise<ActionResult<ProductMarketState>> {
  try {
    const data = await api.put<ProductMarketState>(`/v1/market/products/${productId}`, input);
    revalidatePath(MARKET_PATH);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: { message: err instanceof Error ? err.message : String(err) } };
  }
}
