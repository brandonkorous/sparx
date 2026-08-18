-- A restorable snapshot of the DRAFT site, sealed on every save (docs/126 §4.6).
--
-- The publish releases (builder_releases) make any PUBLISHED state recoverable. This does
-- the same for the DRAFT — the state the studio edits — so a save that overwrote work (the
-- last-write-wins case concurrent agent+operator editing makes routine) is no longer
-- permanent: the overwritten version is one row back.
--
-- Reuses builder_page_artifacts verbatim for the trees (content-addressed, so an unchanged
-- page dedupes and a draft tree identical to a published one shares the row). This table
-- only names the manifest — the same shape a release carries. Separate from builder_releases
-- because the two restore different columns (draft vs published) and must not share history.
--
-- Additive only. Nothing outside the studio reads it, so there is no backfill here and none
-- of the FORCE-RLS backfill footgun.

CREATE TABLE "builder_draft_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "hash" CHAR(64) NOT NULL,
    "manifest" JSONB NOT NULL,
    "page_count" INTEGER NOT NULL DEFAULT 0,
    "source" VARCHAR(16) NOT NULL DEFAULT 'save',
    "restored_from_id" UUID,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "builder_draft_versions_pkey" PRIMARY KEY ("id")
);

-- The history list, newest first, scoped to the property.
CREATE INDEX "builder_draft_versions_tenant_id_property_id_created_at_idx"
    ON "builder_draft_versions" ("tenant_id", "property_id", "created_at");

ALTER TABLE "builder_draft_versions"
    ADD CONSTRAINT "builder_draft_versions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "builder_draft_versions"
    ADD CONSTRAINT "builder_draft_versions_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant isolation. FORCE so a callsite that forgets withTenant() reads nothing rather than
-- leaking another tenant's draft history.
ALTER TABLE "builder_draft_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "builder_draft_versions" FORCE ROW LEVEL SECURITY;
CREATE POLICY builder_draft_versions_tenant_isolation ON "builder_draft_versions"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());
