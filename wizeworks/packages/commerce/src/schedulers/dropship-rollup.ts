// Nightly reconcile for the dropship daily-orders rollup (docs/97 §5).
//
// Recomputes a trailing window of `rollup_dropship_daily_orders` from the
// source-of-truth dropship orders + storefront items and overwrites it, so the
// Dropship overview's "order volume" chart reads pre-aggregated rows instead of
// expanding line-item JSON and joining order_items ↔ variants on the hot path.
// The read endpoint live-overlays the most recent open day(s), so this job only
// keeps closed days correct (and heals status changes — a pending order becoming
// shipped). Run once over full history, it is also the backfill. Invoked per
// active tenant by `/internal/dropship/orders-rollup`.

import { reportingService } from '../services';

export interface DropshipOrdersRollupResult {
  tenantId: string;
  days: number;
  ordersCount: number;
  windowStart: string;
}

export async function reconcileDropshipOrdersRollup(input: {
  tenantId: string;
  sinceDays?: number;
}): Promise<DropshipOrdersRollupResult> {
  const res = await reportingService.reconcileDropshipOrdersRollup(
    { tenantId: input.tenantId },
    input.sinceDays !== undefined ? { sinceDays: input.sinceDays } : undefined
  );
  return { tenantId: input.tenantId, ...res };
}
