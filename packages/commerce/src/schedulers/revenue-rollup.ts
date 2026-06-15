// Nightly reconcile for the commerce daily-revenue rollup (docs/97 §5).
//
// Recomputes a trailing window of `rollup_commerce_daily_revenue` from the
// source-of-truth orders and overwrites it, so the Commerce overview's revenue
// chart reads pre-aggregated rows instead of running a GROUP BY on the hot
// path. The read endpoint live-overlays the most recent open day(s), so this
// job's only responsibility is keeping closed days correct (and healing late
// refunds / cancellations). Run once over full history, it is also the
// backfill. Invoked per active tenant by `/internal/commerce/revenue-rollup`.

import { reportingService } from '../services';

export interface RevenueRollupResult {
  tenantId: string;
  days: number;
  ordersCount: number;
  windowStart: string;
}

export async function reconcileRevenueRollup(input: {
  tenantId: string;
  sinceDays?: number;
}): Promise<RevenueRollupResult> {
  const res = await reportingService.reconcileRevenueRollup(
    { tenantId: input.tenantId },
    input.sinceDays !== undefined ? { sinceDays: input.sinceDays } : undefined
  );
  return { tenantId: input.tenantId, ...res };
}
