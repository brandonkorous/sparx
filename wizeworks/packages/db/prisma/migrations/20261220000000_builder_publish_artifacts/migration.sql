-- Immutable, content-addressed publish artifacts + the release that names them
-- (docs/126 §5.3). Both tables are APPEND-ONLY by contract: the service never
-- updates or deletes a row, and a rollback publishes a prior manifest FORWARD as a
-- new release rather than rewinding history.
--
-- Additive only. Nothing reads these yet on the storefront path — `silica_published_tree`
-- stays authoritative until docs/126 Phase 6 flips reads and drops it — so there is no
-- backfill here, and therefore none of the FORCE-RLS backfill footgun.

CREATE TABLE "builder_page_artifacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "owner_kind" VARCHAR(16) NOT NULL,
    "owner_id" VARCHAR(255) NOT NULL,
    "hash" CHAR(64) NOT NULL,
    "tree" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "builder_page_artifacts_pkey" PRIMARY KEY ("id")
);

-- The dedupe key and the manifest-resolution key. Named explicitly: the generated
-- name would exceed Postgres's 63-char identifier limit and silently truncate.
CREATE UNIQUE INDEX "builder_page_artifacts_owner_hash_key"
    ON "builder_page_artifacts" ("tenant_id", "property_id", "owner_kind", "owner_id", "hash");
CREATE INDEX "builder_page_artifacts_tenant_id_property_id_owner_kind_own_idx"
    ON "builder_page_artifacts" ("tenant_id", "property_id", "owner_kind", "owner_id");

ALTER TABLE "builder_page_artifacts"
    ADD CONSTRAINT "builder_page_artifacts_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "builder_page_artifacts"
    ADD CONSTRAINT "builder_page_artifacts_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "builder_releases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "hash" CHAR(64) NOT NULL,
    "manifest" JSONB NOT NULL,
    "page_count" INTEGER NOT NULL DEFAULT 0,
    "source" VARCHAR(16) NOT NULL DEFAULT 'publish',
    "restored_from_id" UUID,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "builder_releases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "builder_releases_tenant_id_property_id_created_at_idx"
    ON "builder_releases" ("tenant_id", "property_id", "created_at");

ALTER TABLE "builder_releases"
    ADD CONSTRAINT "builder_releases_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "builder_releases"
    ADD CONSTRAINT "builder_releases_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant isolation. FORCE so a callsite that forgets withTenant() reads nothing
-- rather than leaking another tenant's published site.
ALTER TABLE "builder_page_artifacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "builder_page_artifacts" FORCE ROW LEVEL SECURITY;
CREATE POLICY builder_page_artifacts_tenant_isolation ON "builder_page_artifacts"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());

ALTER TABLE "builder_releases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "builder_releases" FORCE ROW LEVEL SECURITY;
CREATE POLICY builder_releases_tenant_isolation ON "builder_releases"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());
