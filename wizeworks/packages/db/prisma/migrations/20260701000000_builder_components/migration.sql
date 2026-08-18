-- Builder — tenant-authored components (docs/53, P-A foundation).
--
-- A tenant component is a DECLARATIVE, versioned, parameterized node subtree the
-- user composes in the builder (vs. system components, which are in-code and
-- carry a renderLeaf function). It renders by EXPANSION through the trusted
-- registry renderers — never as user code — so it is safe to store + version.
--
-- Two tables, mirroring the proven builder_* storage (never the retiring
-- sitebuilder_* tier):
--   · builder_components          — identity, one row per (tenant, key).
--   · builder_component_versions  — immutable version snapshots (tree + propSpec);
--     a page placement PINS a version and opts into upgrades (docs/53 §6).
--
-- Both ENABLE/FORCE RLS with the standard tenant_isolation policy on
-- current_tenant_id() (defined in 20260527000100_rls), like every builder_* table.
-- Additive — no backfill; no existing rows reference these.

-- CreateTable — component identity.
CREATE TABLE "builder_components" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "key" VARCHAR(56) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "group" VARCHAR(20) NOT NULL DEFAULT 'content',
    "icon" VARCHAR(64) NOT NULL DEFAULT 'box',
    "description" VARCHAR(500),
    "surfaces" JSONB NOT NULL DEFAULT '["page"]',
    "latest_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "builder_components_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "builder_components_tenant_id_key_key"
    ON "builder_components" ("tenant_id", "key");
CREATE INDEX "builder_components_tenant_id_group_idx"
    ON "builder_components" ("tenant_id", "group");

-- CreateTable — immutable version snapshots.
CREATE TABLE "builder_component_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "component_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "tree" JSONB NOT NULL,
    "prop_spec" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "builder_component_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "builder_component_versions_component_id_version_key"
    ON "builder_component_versions" ("component_id", "version");
CREATE INDEX "builder_component_versions_tenant_id_component_id_idx"
    ON "builder_component_versions" ("tenant_id", "component_id");

-- AddForeignKey
ALTER TABLE "builder_components"
    ADD CONSTRAINT "builder_components_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "builder_component_versions"
    ADD CONSTRAINT "builder_component_versions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "builder_component_versions"
    ADD CONSTRAINT "builder_component_versions_component_id_fkey"
    FOREIGN KEY ("component_id") REFERENCES "builder_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security — tenant isolation (ENABLE + FORCE), mirroring the other
-- builder_* tables. current_tenant_id() is defined in 20260527000100_rls.
ALTER TABLE "builder_components" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "builder_components" FORCE ROW LEVEL SECURITY;
CREATE POLICY builder_components_tenant_isolation ON "builder_components"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE "builder_component_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "builder_component_versions" FORCE ROW LEVEL SECURITY;
CREATE POLICY builder_component_versions_tenant_isolation ON "builder_component_versions"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
