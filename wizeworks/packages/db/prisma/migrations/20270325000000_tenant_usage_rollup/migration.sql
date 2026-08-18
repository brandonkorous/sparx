-- Platform capacity usage — one row per (tenant, UTC day).
--
-- The evidence a usage-based price is set from. Nothing was metering storage,
-- email volume, contacts or seats before this, and usage history cannot be
-- backfilled: nobody can reconstruct last March's storage figure. So this lands
-- ahead of the billing surfaces that will read it.
--
-- Every measure is NULLABLE on purpose. A meter that has not been collected must
-- read as "not measured", never as "measured, and the answer was none" — a
-- defaulted 0 is indistinguishable from a real 0, and billing must refuse to act
-- on a value nobody took.

CREATE TABLE "rollup_tenant_daily_usage" (
    "tenant_id"       UUID        NOT NULL,
    "bucket"          DATE        NOT NULL,

    -- STOCKS + UNITS: point-in-time, as at the snapshot. Do not sum across days.
    "storage_bytes"   BIGINT,
    "contacts_count"  INTEGER,
    "seats_count"     INTEGER,
    "sites_count"     INTEGER,
    "locations_count" INTEGER,

    -- FLOW: the total FOR that day. Summing across a period is the correct read.
    "email_sends"     INTEGER,

    "measured_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "rollup_tenant_daily_usage_pkey" PRIMARY KEY ("tenant_id", "bucket"),
    CONSTRAINT "rollup_tenant_daily_usage_tenant_fk"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
);

-- The platform-side read is "every tenant, one day" (who is near a limit, how is
-- usage trending across the base), which is a scan by bucket rather than by
-- tenant — the PK's leading tenant_id cannot serve it.
CREATE INDEX "rollup_tenant_daily_usage_bucket_idx"
    ON "rollup_tenant_daily_usage" ("bucket");

-- Tenant isolation, same as every other rollup. FORCE so the owner role is
-- subject to it too — the nightly job writes as the owner and must still be
-- scoped, and RLS is the backstop for exactly the application bug that would
-- otherwise let one tenant read another's consumption.
ALTER TABLE "rollup_tenant_daily_usage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rollup_tenant_daily_usage" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "rollup_tenant_daily_usage"
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
