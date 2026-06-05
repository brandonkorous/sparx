-- Builder presentation layer → per-property re-key (docs/49 Phase 1B;
-- docs/handoffs/multi-property-phase1-spec.md).
--
-- The Builder render path (pages + chrome + per-record overrides) becomes
-- PER-PROPERTY: each of a tenant's web properties (sites) keeps its own page
-- tree and its own active layout. builder_emails and builder_components stay
-- tenant-wide (email is not a web property; the component library is shared
-- across a tenant's sites), so they are NOT touched here.
--
-- property_id is NOT a security boundary — tenant_id (the RLS GUC) stays the
-- only one; property_id is application-tier scoping (docs/49 §2). No RLS policy
-- references it; the existing tenant_isolation policies are unchanged.
--
-- BACKFILL: every existing page/layout/assignment belongs to its tenant's single
-- PRIMARY property (the only one that exists pre-rollout, seeded by
-- 20260626000000_properties). FORCE RLS + the non-superuser prod runner
-- (sparx_owner) ⇒ unqualified rows are invisible, so we loop tenants and set
-- app.tenant_id per tenant (cf. 20260622000000_builder_multi_layouts).

-- ── Add property_id (nullable first, so the backfill can run) ──────────────
ALTER TABLE "builder_pages" ADD COLUMN "property_id" UUID;
ALTER TABLE "builder_layouts" ADD COLUMN "property_id" UUID;
ALTER TABLE "builder_page_assignments" ADD COLUMN "property_id" UUID;

-- ── Backfill from each tenant's primary property ──────────────────────────
DO $$
DECLARE
    v_tenant UUID;
    v_prop   UUID;
BEGIN
    FOR v_tenant IN SELECT "id" FROM "tenants" LOOP
        PERFORM set_config('app.tenant_id', v_tenant::text, true);
        SELECT "id" INTO v_prop FROM "properties" WHERE "tenant_id" = v_tenant AND "is_primary";
        -- All of a tenant's pre-rollout rows belong to its primary property.
        -- RLS scopes each UPDATE to the current tenant (no tenant_id filter needed).
        UPDATE "builder_pages"             SET "property_id" = v_prop WHERE "property_id" IS NULL;
        UPDATE "builder_layouts"           SET "property_id" = v_prop WHERE "property_id" IS NULL;
        UPDATE "builder_page_assignments"  SET "property_id" = v_prop WHERE "property_id" IS NULL;
    END LOOP;
END
$$;

-- ── Enforce NOT NULL once every row is backfilled ─────────────────────────
ALTER TABLE "builder_pages"            ALTER COLUMN "property_id" SET NOT NULL;
ALTER TABLE "builder_layouts"          ALTER COLUMN "property_id" SET NOT NULL;
ALTER TABLE "builder_page_assignments" ALTER COLUMN "property_id" SET NOT NULL;

-- ── builder_pages — swap (tenant) keys → (tenant, property) ────────────────
DROP INDEX "builder_pages_tenant_id_slug_key";
DROP INDEX "builder_pages_tenant_id_position_idx";
CREATE UNIQUE INDEX "builder_pages_tenant_id_property_id_slug_key"
    ON "builder_pages" ("tenant_id", "property_id", "slug");
CREATE INDEX "builder_pages_tenant_id_property_id_position_idx"
    ON "builder_pages" ("tenant_id", "property_id", "position");

-- Default-template partial unique → now per (tenant, property, record_type).
DROP INDEX "builder_pages_one_default_per_record_type";
CREATE UNIQUE INDEX "builder_pages_one_default_per_record_type"
    ON "builder_pages" ("tenant_id", "property_id", "record_type")
    WHERE "is_default" AND "record_type" IS NOT NULL;

ALTER TABLE "builder_pages"
    ADD CONSTRAINT "builder_pages_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── builder_layouts — one ACTIVE per (tenant, property) ────────────────────
DROP INDEX "builder_layouts_tenant_id_position_idx";
CREATE INDEX "builder_layouts_tenant_id_property_id_position_idx"
    ON "builder_layouts" ("tenant_id", "property_id", "position");

DROP INDEX "builder_layouts_one_active_per_tenant";
CREATE UNIQUE INDEX "builder_layouts_one_active_per_tenant"
    ON "builder_layouts" ("tenant_id", "property_id") WHERE "is_active";

ALTER TABLE "builder_layouts"
    ADD CONSTRAINT "builder_layouts_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── builder_page_assignments — per-record override, now per (tenant, property) ──
DROP INDEX "builder_page_assignments_tenant_id_record_type_item_ref_key";
DROP INDEX "builder_page_assignments_tenant_id_record_type_idx";
CREATE UNIQUE INDEX "builder_page_assignments_property_record_item_key"
    ON "builder_page_assignments" ("tenant_id", "property_id", "record_type", "item_ref");
CREATE INDEX "builder_page_assignments_tenant_id_property_id_record_type_idx"
    ON "builder_page_assignments" ("tenant_id", "property_id", "record_type");

ALTER TABLE "builder_page_assignments"
    ADD CONSTRAINT "builder_page_assignments_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
