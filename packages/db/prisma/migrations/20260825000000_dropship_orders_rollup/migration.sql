-- Analytics rollups (docs/97 §5) — dropship daily orders/revenue/cost.
--
-- Pre-aggregated, tenant-scoped summary read by the Dropship overview's "order
-- volume" chart instead of expanding line-item JSON + joining order_items ↔
-- commerce_product_variants on the operational path. One row per (tenant, UTC
-- day): the count of routed dropship orders (submitted | shipped | delivered),
-- the storefront revenue attributed to them, and the supplier cost. Net profit
-- and margin are derived in the read (revenue − cost), matching the live
-- /v1/dropship/analytics headline. Maintained by the nightly
-- `/internal/dropship/orders-rollup` reconcile (also the backfill); the read
-- endpoint live-overlays the most recent open day(s) so "today" stays fresh
-- without an event-increment worker.
--
-- Money is integer cents in BIGINT (a high-volume routing network's daily
-- revenue can exceed INT4's ~$21M ceiling). RLS is hand-authored per
-- packages/db/CLAUDE.md — every tenant-scoped table gets ENABLE + FORCE + a
-- current_tenant_id() policy.

CREATE TABLE "rollup_dropship_daily_orders" (
    "tenant_id" UUID NOT NULL,
    "bucket" DATE NOT NULL,
    "orders_count" INTEGER NOT NULL DEFAULT 0,
    "revenue_cents" BIGINT NOT NULL DEFAULT 0,
    "cost_cents" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rollup_dropship_daily_orders_pkey" PRIMARY KEY ("tenant_id", "bucket")
);
ALTER TABLE "rollup_dropship_daily_orders" ALTER COLUMN "updated_at" DROP DEFAULT;

-- The composite PK (tenant_id, bucket) already covers the dominant query
-- (WHERE tenant_id = current_tenant_id() AND bucket BETWEEN $1 AND $2), so no
-- extra index is needed.

ALTER TABLE "rollup_dropship_daily_orders" ADD CONSTRAINT "rollup_dropship_daily_orders_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rollup_dropship_daily_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rollup_dropship_daily_orders" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "rollup_dropship_daily_orders"
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());