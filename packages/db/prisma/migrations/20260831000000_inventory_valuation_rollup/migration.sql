-- Inventory valuation snapshot rollup (docs/97 §5) — powers the Inventory
-- overview's "value over time" chart.
--
-- A point-in-time SNAPSHOT, not a reconcile: stock_levels carry only a current
-- quantity (no per-day ledger), so a day's value can only be captured as of the
-- nightly run. The snapshot cron upserts today's row each night; the read
-- live-overlays the current valuation for today. Money is integer cents (BIGINT),
-- matching every /reports/* surface.
--
-- Tenant-scoped: ENABLE + FORCE RLS + a current_tenant_id() policy (hand-authored
-- per packages/db/CLAUDE.md — Prisma doesn't generate RLS).

CREATE TABLE "rollup_inventory_daily_valuation" (
    "tenant_id" UUID NOT NULL,
    "bucket" DATE NOT NULL,
    "total_units" INTEGER NOT NULL DEFAULT 0,
    "total_cost_cents" BIGINT NOT NULL DEFAULT 0,
    "total_retail_cents" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rollup_inventory_daily_valuation_pkey" PRIMARY KEY ("tenant_id", "bucket")
);
ALTER TABLE "rollup_inventory_daily_valuation" ALTER COLUMN "updated_at" DROP DEFAULT;

-- The composite PK (tenant_id, bucket) already covers the dominant range read
-- (WHERE tenant_id = current_tenant_id() AND bucket BETWEEN $1 AND $2).

ALTER TABLE "rollup_inventory_daily_valuation" ADD CONSTRAINT "rollup_inventory_daily_valuation_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rollup_inventory_daily_valuation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rollup_inventory_daily_valuation" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "rollup_inventory_daily_valuation"
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());