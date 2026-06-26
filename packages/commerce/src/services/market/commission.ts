// sparx.market commission resolution (docs/106 §4.7).
//
// Commission is a FLAT platform rate in basis points, with an optional per-tenant
// override (the "Enterprise: negotiated" case) — NOT a plan tier (the platform has
// modules, not tiers). The pure math + the override-vs-default precedence live in
// @sparx/commerce-schemas; this server-layer wrapper reads the platform default
// from env and the tenant override from the merchant profile.

import type { TxClient } from '@sparx/db';
import { MARKET_COMMISSION_BPS_DEFAULT, resolveCommissionBps } from '@sparx/commerce-schemas';

/** The platform default commission (bps) from env MARKET_COMMISSION_BPS, clamped to
 *  [0, 3000]; falls back to MARKET_COMMISSION_BPS_DEFAULT (200 = 2%). */
export function platformCommissionBps(): number {
  const raw = process.env.MARKET_COMMISSION_BPS;
  if (!raw) return MARKET_COMMISSION_BPS_DEFAULT;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 0 || n > 3000) return MARKET_COMMISSION_BPS_DEFAULT;
  return n;
}

/** Resolve the effective commission (bps) for a tenant: its merchant-profile
 *  override if set, else the platform default. Reads within an existing tx. */
export async function resolveTenantCommissionBps(tx: TxClient, tenantId: string): Promise<number> {
  const profile = await tx.marketMerchantProfile.findUnique({
    where: { tenantId },
    select: { commissionBpsOverride: true },
  });
  return resolveCommissionBps(profile?.commissionBpsOverride ?? null, platformCommissionBps());
}
