-- Analytics rollups (docs/97 §5) — automation daily run activity.
--
-- Pre-aggregated, tenant-scoped summary read by the Automations overview's
-- "run activity" chart + success-rate KPI instead of scanning automation_runs
-- across every automation on the operational path. One row per (tenant, UTC
-- day): the count of runs started, plus the three terminal outcome counts
-- (completed | failed | skipped) so the read derives a success rate without a
-- second pass. Maintained by the nightly `/internal/automations/runs-rollup`
-- reconcile (also the backfill); the read endpoint live-overlays the most
-- recent open day(s) so "today" stays fresh without an event-increment worker.
--
-- No money columns, so plain INTEGER counts (daily run volume stays well under
-- INT4's ceiling). RLS is hand-authored per packages/db/CLAUDE.md — every
-- tenant-scoped table gets ENABLE + FORCE + a current_tenant_id() policy.

CREATE TABLE "rollup_automation_daily_runs" (
    "tenant_id" UUID NOT NULL,
    "bucket" DATE NOT NULL,
    "runs_count" INTEGER NOT NULL DEFAULT 0,
    "completed_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rollup_automation_daily_runs_pkey" PRIMARY KEY ("tenant_id", "bucket")
);
ALTER TABLE "rollup_automation_daily_runs" ALTER COLUMN "updated_at" DROP DEFAULT;

-- The composite PK (tenant_id, bucket) already covers the dominant query
-- (WHERE tenant_id = current_tenant_id() AND bucket BETWEEN $1 AND $2), so no
-- extra index is needed.

ALTER TABLE "rollup_automation_daily_runs" ADD CONSTRAINT "rollup_automation_daily_runs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rollup_automation_daily_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rollup_automation_daily_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "rollup_automation_daily_runs"
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());