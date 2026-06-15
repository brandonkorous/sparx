-- Analytics rollups (docs/97 §5) — invoicing daily collected/billed.
--
-- Pre-aggregated, tenant-scoped summary read by the Invoicing overview's
-- "collected over time" chart instead of GROUP BYs over payments + documents on
-- the operational path. One row per (tenant, UTC day), holding two independent
-- series on a shared calendar axis: cash COLLECTED (billing_document_payments by
-- received_at) and amount BILLED (billing_documents by finalized_at). Maintained
-- by the nightly `/internal/invoicing/collected-rollup` reconcile (also the
-- backfill); the read endpoint live-overlays the most recent open day(s) so
-- "today" stays fresh without an event-increment worker.
--
-- Money is integer cents in BIGINT (a busy shop's daily billed can exceed INT4's
-- ~$21M ceiling). RLS is hand-authored per packages/db/CLAUDE.md — every
-- tenant-scoped table gets ENABLE + FORCE + a current_tenant_id() policy.

CREATE TABLE "rollup_invoicing_daily_collected" (
    "tenant_id" UUID NOT NULL,
    "bucket" DATE NOT NULL,
    "payments_count" INTEGER NOT NULL DEFAULT 0,
    "invoices_count" INTEGER NOT NULL DEFAULT 0,
    "collected_cents" BIGINT NOT NULL DEFAULT 0,
    "refunded_cents" BIGINT NOT NULL DEFAULT 0,
    "billed_cents" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rollup_invoicing_daily_collected_pkey" PRIMARY KEY ("tenant_id", "bucket")
);
ALTER TABLE "rollup_invoicing_daily_collected" ALTER COLUMN "updated_at" DROP DEFAULT;

-- The composite PK (tenant_id, bucket) already covers the dominant query
-- (WHERE tenant_id = current_tenant_id() AND bucket BETWEEN $1 AND $2), so no
-- extra index is needed.

ALTER TABLE "rollup_invoicing_daily_collected" ADD CONSTRAINT "rollup_invoicing_daily_collected_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rollup_invoicing_daily_collected" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rollup_invoicing_daily_collected" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "rollup_invoicing_daily_collected"
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
