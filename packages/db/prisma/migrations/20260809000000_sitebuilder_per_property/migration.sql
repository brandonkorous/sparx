-- Sitebuilder applied-theme trio + the StorefrontTheme write-through → per-property
-- (docs/49 Phase 6). Each of a tenant's sites publishes its OWN theme + version
-- history + schedule; the storefront resolves the published snapshot per site. The
-- legacy section tier (page layouts / sections) and the saved-theme LIBRARY
-- (sitebuilder_themes) stay TENANT-wide and are NOT touched here.
--
-- property_id is NOT a security boundary — tenant_id (the RLS GUC) stays the only
-- one (docs/49 §2). No RLS policy references property_id; the existing
-- tenant_isolation policies are unchanged.
--
-- BACKFILL: every existing config / version / schedule / theme belongs to its
-- tenant's single PRIMARY property (the only one that exists pre-rollout, seeded by
-- 20260626000000_properties). FORCE RLS + the non-superuser prod runner
-- (sparx_owner) ⇒ unqualified rows are invisible, so we loop tenants and set
-- app.tenant_id per tenant (cf. 20260628000000_builder_per_property).

-- ── Add property_id (nullable first, so the backfill can run) ──────────────
ALTER TABLE "sitebuilder_configs"           ADD COLUMN "property_id" UUID;
ALTER TABLE "sitebuilder_versions"          ADD COLUMN "property_id" UUID;
ALTER TABLE "sitebuilder_publish_schedules" ADD COLUMN "property_id" UUID;
ALTER TABLE "commerce_storefront_themes"    ADD COLUMN "property_id" UUID;

-- ── Backfill from each tenant's primary property ──────────────────────────
DO $$
DECLARE
    v_tenant UUID;
    v_prop   UUID;
BEGIN
    FOR v_tenant IN SELECT "id" FROM "tenants" LOOP
        PERFORM set_config('app.tenant_id', v_tenant::text, true);
        SELECT "id" INTO v_prop FROM "properties" WHERE "tenant_id" = v_tenant AND "is_primary";
        -- All of a tenant's pre-rollout rows belong to its primary property. We
        -- filter by tenant_id EXPLICITLY (not only via RLS): the migration role is
        -- a superuser locally (RLS bypassed), so an unqualified UPDATE would assign
        -- the first tenant's primary to EVERY row — caught here by the per-property
        -- unique on sitebuilder_configs. In prod (non-superuser) RLS also scopes it;
        -- the explicit filter is correct in both worlds.
        UPDATE "sitebuilder_configs"           SET "property_id" = v_prop WHERE "property_id" IS NULL AND "tenant_id" = v_tenant;
        UPDATE "sitebuilder_versions"          SET "property_id" = v_prop WHERE "property_id" IS NULL AND "tenant_id" = v_tenant;
        UPDATE "sitebuilder_publish_schedules" SET "property_id" = v_prop WHERE "property_id" IS NULL AND "tenant_id" = v_tenant;
        UPDATE "commerce_storefront_themes"    SET "property_id" = v_prop WHERE "property_id" IS NULL AND "tenant_id" = v_tenant;
    END LOOP;
END
$$;

-- ── Enforce NOT NULL once every row is backfilled ─────────────────────────
ALTER TABLE "sitebuilder_configs"           ALTER COLUMN "property_id" SET NOT NULL;
ALTER TABLE "sitebuilder_versions"          ALTER COLUMN "property_id" SET NOT NULL;
ALTER TABLE "sitebuilder_publish_schedules" ALTER COLUMN "property_id" SET NOT NULL;
ALTER TABLE "commerce_storefront_themes"    ALTER COLUMN "property_id" SET NOT NULL;

-- ── sitebuilder_configs — swap PK (tenant) → (tenant, property) ────────────
ALTER TABLE "sitebuilder_configs" DROP CONSTRAINT "sitebuilder_configs_pkey";
ALTER TABLE "sitebuilder_configs"
    ADD CONSTRAINT "sitebuilder_configs_pkey" PRIMARY KEY ("tenant_id", "property_id");
-- A property has exactly one config (Property↔SiteConfig is 1:1).
CREATE UNIQUE INDEX "sitebuilder_configs_property_id_key"
    ON "sitebuilder_configs" ("property_id");
ALTER TABLE "sitebuilder_configs"
    ADD CONSTRAINT "sitebuilder_configs_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── sitebuilder_versions — version numbers now per (tenant, property) ──────
DROP INDEX "sitebuilder_versions_tenant_id_version_number_key";
DROP INDEX "sitebuilder_versions_tenant_id_created_at_idx";
CREATE UNIQUE INDEX "sitebuilder_versions_tenant_id_property_id_version_number_key"
    ON "sitebuilder_versions" ("tenant_id", "property_id", "version_number");
CREATE INDEX "sitebuilder_versions_tenant_id_property_id_created_at_idx"
    ON "sitebuilder_versions" ("tenant_id", "property_id", "created_at" DESC);
ALTER TABLE "sitebuilder_versions"
    ADD CONSTRAINT "sitebuilder_versions_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── sitebuilder_publish_schedules — per (tenant, property); cross-tenant scan
--    index (status, scheduled_at) is unchanged ──────────────────────────────
DROP INDEX "sitebuilder_publish_schedules_tenant_id_scheduled_at_idx";
CREATE INDEX "sitebuilder_schedules_tenant_property_scheduled_idx"
    ON "sitebuilder_publish_schedules" ("tenant_id", "property_id", "scheduled_at" DESC);
ALTER TABLE "sitebuilder_publish_schedules"
    ADD CONSTRAINT "sitebuilder_publish_schedules_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── commerce_storefront_themes — swap PK (tenant) → (tenant, property) ──────
ALTER TABLE "commerce_storefront_themes" DROP CONSTRAINT "commerce_storefront_themes_pkey";
ALTER TABLE "commerce_storefront_themes"
    ADD CONSTRAINT "commerce_storefront_themes_pkey" PRIMARY KEY ("tenant_id", "property_id");
-- A property has exactly one write-through theme (Property↔StorefrontTheme is 1:1).
CREATE UNIQUE INDEX "commerce_storefront_themes_property_id_key"
    ON "commerce_storefront_themes" ("property_id");
ALTER TABLE "commerce_storefront_themes"
    ADD CONSTRAINT "commerce_storefront_themes_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
