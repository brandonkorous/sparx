// Nightly reconcile for the invoicing daily-collected rollup (docs/97 §5).
//
// Recomputes a trailing window of `rollup_invoicing_daily_collected` from the
// source-of-truth payments + finalized documents and overwrites it, so the
// Invoicing overview's "collected over time" chart reads pre-aggregated rows
// instead of GROUP BYs on the hot path. The read endpoint live-overlays the most
// recent open day(s), so this job's only responsibility is keeping closed days
// correct (and healing late refunds / voids). Run once over full history, it is
// also the backfill. Invoked per active tenant by
// `/internal/invoicing/collected-rollup`.

import { invoicingReportingService } from '../services';

export interface CollectedRollupResult {
  tenantId: string;
  days: number;
  collectedCents: number;
  billedCents: number;
  windowStart: string;
}

export async function reconcileCollectedRollup(input: {
  tenantId: string;
  sinceDays?: number;
}): Promise<CollectedRollupResult> {
  const res = await invoicingReportingService.reconcileCollectedRollup(
    { tenantId: input.tenantId },
    input.sinceDays !== undefined ? { sinceDays: input.sinceDays } : undefined
  );
  return { tenantId: input.tenantId, ...res };
}
