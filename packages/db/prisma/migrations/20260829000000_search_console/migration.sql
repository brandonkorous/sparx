-- Google Search Console integration (docs/50 §7, docs/97 §4) — organic-search
-- performance for the SEO overview.
--
-- Per-tenant OAuth: each tenant connects THEIR own Search Console property. A
-- nightly job pulls the Search Analytics API and writes the daily rollup + top
-- queries here, so the SEO overview's organic cards read pre-aggregated rows
-- (never a live Google call on the hot path). GSC data lags ~2-3 days, so there
-- is no "live overlay" — the rollup IS the source of truth for these reads.
--
-- OAuth tokens are encrypted at rest (AES-256-GCM, services/api-rest
-- lib/search-console crypto) — the *_token_enc columns hold opaque base64
-- ciphertext bundles (iv.tag.cipher), never plaintext.
--
-- RLS is hand-authored per packages/db/CLAUDE.md — every tenant-scoped table
-- gets ENABLE + FORCE + a current_tenant_id() policy.

-- ── OAuth connection (one per tenant+property) ──────────────────────────────
CREATE TABLE "search_console_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "site_url" VARCHAR(2048),
    "status" VARCHAR(20) NOT NULL DEFAULT 'needs_site',
    "access_token_enc" TEXT,
    "refresh_token_enc" TEXT,
    "token_expires_at" TIMESTAMPTZ,
    "last_sync_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "connected_by_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "search_console_connections_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "search_console_connections" ALTER COLUMN "updated_at" DROP DEFAULT;

CREATE UNIQUE INDEX "search_console_connections_tenant_property_unique"
    ON "search_console_connections" ("tenant_id", "property_id");

ALTER TABLE "search_console_connections" ADD CONSTRAINT "search_console_connections_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "search_console_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "search_console_connections" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "search_console_connections"
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ── Daily organic-search rollup ─────────────────────────────────────────────
-- CTR and average position are DERIVED at read time: ctr = clicks / impressions,
-- and the impression-weighted avg position = sum_position / impressions, where
-- sum_position = Σ(position × impressions) so it aggregates correctly across days.
CREATE TABLE "rollup_search_console_daily" (
    "tenant_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "bucket" DATE NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "sum_position" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rollup_search_console_daily_pkey" PRIMARY KEY ("tenant_id", "property_id", "bucket")
);
ALTER TABLE "rollup_search_console_daily" ALTER COLUMN "updated_at" DROP DEFAULT;

-- The composite PK (tenant_id, property_id, bucket) already covers the dominant
-- range read (WHERE tenant_id = current_tenant_id() AND property_id = $1 AND
-- bucket BETWEEN $2 AND $3), so no extra index is needed.

ALTER TABLE "rollup_search_console_daily" ADD CONSTRAINT "rollup_search_console_daily_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rollup_search_console_daily" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rollup_search_console_daily" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "rollup_search_console_daily"
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ── Top queries (replaced wholesale each sync) ──────────────────────────────
CREATE TABLE "search_console_queries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "query" VARCHAR(512) NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "sum_position" BIGINT NOT NULL DEFAULT 0,
    "captured_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "search_console_queries_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "search_console_queries" ALTER COLUMN "captured_at" DROP DEFAULT;

CREATE INDEX "search_console_queries_tenant_id_property_id_clicks_idx"
    ON "search_console_queries" ("tenant_id", "property_id", "clicks" DESC);

ALTER TABLE "search_console_queries" ADD CONSTRAINT "search_console_queries_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "search_console_queries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "search_console_queries" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "search_console_queries"
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());