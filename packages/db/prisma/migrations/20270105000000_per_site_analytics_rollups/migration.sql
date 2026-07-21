-- Per-site analytics rollups (docs/131 §6).
--
-- Four of the five daily rollups gain a `property_id` dimension so the dashboards
-- (docs/129) can split revenue / cashflow / dropship margin / automation activity
-- by business. RollupInventoryDailyValuation is intentionally NOT here — stock is a
-- single tenant-wide pool (a warehouse is not a site), so it stays (tenant, day).
--
-- Null-property semantics differ by source and are the whole reason §6 is a phase,
-- not a column-add:
--   • commerce + dropship — source orders are SetNull, so revenue can outlive its
--     site. property_id nullable; null = the "unattributed" bucket (per-site reads
--     exclude it, the all-sites total includes it). A NULLABLE key component can't
--     sit in a PK, so these get a surrogate `id` PK + a NULLS NOT DISTINCT unique
--     over (tenant, property, day) — the ProductReviewRollup shape.
--   • invoicing — billing_documents.property_id is NOT NULL + ON DELETE RESTRICT, so
--     there is never an unattributed row. property_id NOT NULL, plain composite PK.
--   • automation — buckets by AutomationRun.property_id; null is SHARED (a tenant-
--     wide automation applies to every site), so per-site reads INCLUDE it. Same
--     nullable/surrogate shape as commerce.
--
-- These are DERIVED tables (nightly reconcile is also the backfill), so each is
-- TRUNCATED and rebuilt clean rather than back-patched — the reconcile/backfill
-- repopulates with correct per-site attribution, and the read endpoints live-overlay
-- "today" from source so current figures stay live in the meantime. RLS (ENABLE +
-- FORCE + tenant_isolation) already exists on every table and is unaffected by the
-- column/key changes below.

-- ── Commerce revenue: surrogate id + nullable property ──────────────────────────
TRUNCATE TABLE "rollup_commerce_daily_revenue";
ALTER TABLE "rollup_commerce_daily_revenue" DROP CONSTRAINT "rollup_commerce_daily_revenue_pkey";
ALTER TABLE "rollup_commerce_daily_revenue" ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "rollup_commerce_daily_revenue" ADD COLUMN "property_id" UUID;
ALTER TABLE "rollup_commerce_daily_revenue"
    ADD CONSTRAINT "rollup_commerce_daily_revenue_pkey" PRIMARY KEY ("id");
CREATE UNIQUE INDEX "rollup_commerce_daily_revenue_grain"
    ON "rollup_commerce_daily_revenue" ("tenant_id", "property_id", "bucket") NULLS NOT DISTINCT;
ALTER TABLE "rollup_commerce_daily_revenue"
    ADD CONSTRAINT "rollup_commerce_daily_revenue_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;

-- ── Invoicing cashflow: non-null property, composite PK ─────────────────────────
TRUNCATE TABLE "rollup_invoicing_daily_collected";
ALTER TABLE "rollup_invoicing_daily_collected" DROP CONSTRAINT "rollup_invoicing_daily_collected_pkey";
ALTER TABLE "rollup_invoicing_daily_collected" ADD COLUMN "property_id" UUID NOT NULL;
ALTER TABLE "rollup_invoicing_daily_collected"
    ADD CONSTRAINT "rollup_invoicing_daily_collected_pkey" PRIMARY KEY ("tenant_id", "property_id", "bucket");
ALTER TABLE "rollup_invoicing_daily_collected"
    ADD CONSTRAINT "rollup_invoicing_daily_collected_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;

-- ── Dropship economics: surrogate id + nullable property ────────────────────────
TRUNCATE TABLE "rollup_dropship_daily_orders";
ALTER TABLE "rollup_dropship_daily_orders" DROP CONSTRAINT "rollup_dropship_daily_orders_pkey";
ALTER TABLE "rollup_dropship_daily_orders" ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "rollup_dropship_daily_orders" ADD COLUMN "property_id" UUID;
ALTER TABLE "rollup_dropship_daily_orders"
    ADD CONSTRAINT "rollup_dropship_daily_orders_pkey" PRIMARY KEY ("id");
CREATE UNIQUE INDEX "rollup_dropship_daily_orders_grain"
    ON "rollup_dropship_daily_orders" ("tenant_id", "property_id", "bucket") NULLS NOT DISTINCT;
ALTER TABLE "rollup_dropship_daily_orders"
    ADD CONSTRAINT "rollup_dropship_daily_orders_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;

-- ── Automation runs: surrogate id + nullable property (shared-null) ─────────────
TRUNCATE TABLE "rollup_automation_daily_runs";
ALTER TABLE "rollup_automation_daily_runs" DROP CONSTRAINT "rollup_automation_daily_runs_pkey";
ALTER TABLE "rollup_automation_daily_runs" ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "rollup_automation_daily_runs" ADD COLUMN "property_id" UUID;
ALTER TABLE "rollup_automation_daily_runs"
    ADD CONSTRAINT "rollup_automation_daily_runs_pkey" PRIMARY KEY ("id");
CREATE UNIQUE INDEX "rollup_automation_daily_runs_grain"
    ON "rollup_automation_daily_runs" ("tenant_id", "property_id", "bucket") NULLS NOT DISTINCT;
ALTER TABLE "rollup_automation_daily_runs"
    ADD CONSTRAINT "rollup_automation_daily_runs_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;
