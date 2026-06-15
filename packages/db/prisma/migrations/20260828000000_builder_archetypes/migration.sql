-- Builder — brand-governed section ARCHETYPES (docs/61 §6 Phase 6b).
--
-- A curated section/layout STARTING POINT a user stamps onto a page. Stamping
-- forks a COPY of `tree` (fresh ids) into the page — not a live reference — so an
-- archetype needs no versioning and no where-used guard (unlike builder_components,
-- whose `custom:<key>` placements pin a version). `source` separates platform
-- defaults (seeded lazily from PLATFORM_ARCHETYPES) from tenant-authored rows;
-- `enabled=false` hides one from the Add palette without deleting it.
--
-- ENABLE/FORCE RLS with the standard tenant_isolation policy on current_tenant_id()
-- (defined in 20260527000100_rls), like every builder_* table. Additive — no
-- backfill; defaults are seeded at runtime via withTenant() on first list.

-- CreateTable
CREATE TABLE "builder_archetypes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "family" VARCHAR(32) NOT NULL DEFAULT 'content',
    "icon" VARCHAR(64) NOT NULL DEFAULT 'box',
    "description" VARCHAR(500),
    "surfaces" JSONB NOT NULL DEFAULT '["page"]',
    "tree" JSONB NOT NULL,
    "source" VARCHAR(16) NOT NULL DEFAULT 'tenant',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "thumbnail" VARCHAR(2048),
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "builder_archetypes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "builder_archetypes_tenant_id_key_key"
    ON "builder_archetypes" ("tenant_id", "key");
CREATE INDEX "builder_archetypes_tenant_id_family_position_idx"
    ON "builder_archetypes" ("tenant_id", "family", "position");

-- AddForeignKey
ALTER TABLE "builder_archetypes"
    ADD CONSTRAINT "builder_archetypes_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security — tenant isolation (ENABLE + FORCE), mirroring the other
-- builder_* tables. current_tenant_id() is defined in 20260527000100_rls.
ALTER TABLE "builder_archetypes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "builder_archetypes" FORCE ROW LEVEL SECURITY;
CREATE POLICY builder_archetypes_tenant_isolation ON "builder_archetypes"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
