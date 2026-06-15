// Nightly reconcile for the automation daily run-activity rollup (docs/97 §5).
//
// Recomputes a trailing window of `rollup_automation_daily_runs` from the
// source-of-truth automation_runs and overwrites it, so the Automations
// overview's "run activity" chart + success-rate KPI read pre-aggregated rows
// instead of scanning every automation's run history on the hot path. The read
// endpoint live-overlays the most recent open day(s), so this job only keeps
// closed days correct (and heals runs that settled after the last reconcile).
// Run once over full history, it is also the backfill. Invoked per active tenant
// by `/internal/automations/runs-rollup`.

import { reconcileRunsRollup as reconcile } from '../service/run-report-service';

export interface RunsRollupResult {
  tenantId: string;
  days: number;
  runsCount: number;
  windowStart: string;
}

export async function reconcileRunsRollup(input: {
  tenantId: string;
  sinceDays?: number;
}): Promise<RunsRollupResult> {
  const res = await reconcile(
    { tenantId: input.tenantId },
    input.sinceDays !== undefined ? { sinceDays: input.sinceDays } : undefined
  );
  return { tenantId: input.tenantId, ...res };
}
