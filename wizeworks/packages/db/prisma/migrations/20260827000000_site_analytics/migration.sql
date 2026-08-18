-- First-party site analytics (docs/97 §5, docs/08) — cookieless storefront
-- traffic capture + its daily rollup.
--
-- Privacy: no PII, no cookies. A visitor is a salted daily-rotating hash of
-- (date + tenant + ip + user-agent) computed at ingestion — never an IP, and
-- not reversible across days. DNT + bots are dropped before insert.
--
-- Two tables (the docs/97 §5 hybrid): the raw append-only events (read live for
-- top-pages / sources / window-unique visitors) and a per-(tenant, property, UTC
-- day) rollup of pageviews / visitors / sessions / signups (nightly reconcile +
-- live-overlay of the open day). RLS is hand-authored per packages/db/CLAUDE.md —
-- every tenant-scoped table gets ENABLE + FORCE + a current_tenant_id() policy.

-- ── Raw events ──────────────────────────────────────────────────────────────
CREATE TABLE "site_analytics_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "property_id" UUID,
    "type" VARCHAR(20) NOT NULL DEFAULT 'pageview',
    "path" VARCHAR(2048) NOT NULL,
    "source" VARCHAR(20) NOT NULL DEFAULT 'direct',
    "referrer_host" VARCHAR(255),
    "visitor_hash" VARCHAR(64) NOT NULL,
    "session_hash" VARCHAR(64) NOT NULL,
    "country" VARCHAR(2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "site_analytics_events_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "site_analytics_events" ALTER COLUMN "created_at" DROP DEFAULT;

CREATE INDEX "site_analytics_events_tenant_id_property_id_created_at_idx"
    ON "site_analytics_events" ("tenant_id", "property_id", "created_at");
CREATE INDEX "site_analytics_events_tenant_id_created_at_visitor_hash_idx"
    ON "site_analytics_events" ("tenant_id", "created_at", "visitor_hash");
CREATE INDEX "site_analytics_events_tenant_id_property_id_path_idx"
    ON "site_analytics_events" ("tenant_id", "property_id", "path");

ALTER TABLE "site_analytics_events" ADD CONSTRAINT "site_analytics_events_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "site_analytics_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "site_analytics_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "site_analytics_events"
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ── Daily rollup ────────────────────────────────────────────────────────────
CREATE TABLE "rollup_site_daily" (
    "tenant_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "bucket" DATE NOT NULL,
    "pageviews" INTEGER NOT NULL DEFAULT 0,
    "visitors" INTEGER NOT NULL DEFAULT 0,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "signups" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rollup_site_daily_pkey" PRIMARY KEY ("tenant_id", "property_id", "bucket")
);
ALTER TABLE "rollup_site_daily" ALTER COLUMN "updated_at" DROP DEFAULT;

-- The composite PK (tenant_id, property_id, bucket) already covers the dominant
-- query (WHERE tenant_id = current_tenant_id() AND property_id = $1 AND bucket
-- BETWEEN $2 AND $3), so no extra index is needed.

ALTER TABLE "rollup_site_daily" ADD CONSTRAINT "rollup_site_daily_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rollup_site_daily" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rollup_site_daily" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "rollup_site_daily"
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
