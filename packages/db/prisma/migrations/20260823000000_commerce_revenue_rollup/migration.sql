-- Analytics rollups (docs/97 §5) — first rollup table: commerce daily revenue.
--
-- Pre-aggregated, tenant-scoped summary read by the Commerce overview's revenue
-- chart instead of a heavy GROUP BY on the operational path. One row per
-- (tenant, UTC day). Maintained by the nightly `/internal/commerce/revenue-rollup`
-- reconcile (also the backfill); the read endpoint live-overlays the most recent
-- open day(s) so "today" stays fresh without an event-increment worker.
--
-- Money is integer cents in BIGINT (a high-volume tenant's daily gross can exceed
-- INT4's ~$21M ceiling). RLS is hand-authored per packages/db/CLAUDE.md — every
-- tenant-scoped table gets ENABLE + FORCE + a current_tenant_id() policy.

CREATE TABLE "rollup_commerce_daily_revenue" (
    "tenant_id" UUID NOT NULL,
    "bucket" DATE NOT NULL,
    "orders_count" INTEGER NOT NULL DEFAULT 0,
    "gross_cents" BIGINT NOT NULL DEFAULT 0,
    "discount_cents" BIGINT NOT NULL DEFAULT 0,
    "refunded_cents" BIGINT NOT NULL DEFAULT 0,
    "net_cents" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rollup_commerce_daily_revenue_pkey" PRIMARY KEY ("tenant_id", "bucket")
);
ALTER TABLE "rollup_commerce_daily_revenue" ALTER COLUMN "updated_at" DROP DEFAULT;

-- The composite PK (tenant_id, bucket) already covers the dominant query
-- (WHERE tenant_id = current_tenant_id() AND bucket BETWEEN $1 AND $2), so no
-- extra index is needed.

ALTER TABLE "rollup_commerce_daily_revenue" ADD CONSTRAINT "rollup_commerce_daily_revenue_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rollup_commerce_daily_revenue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rollup_commerce_daily_revenue" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "rollup_commerce_daily_revenue"
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());