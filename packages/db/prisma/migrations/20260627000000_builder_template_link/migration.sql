-- Builder — first-class template ↔ content link (docs/51 §6, Phase 1b).
--
-- Replaces the loose "lowest-position published wins" heuristic with an explicit
-- per-type DEFAULT template plus an optional per-record OVERRIDE, so the
-- storefront resolver becomes: override → type default → published fallback.
-- This is the structural fix for the seed drift that motivated docs/51 (a
-- builder page targeting a record_type string that no longer matched a real
-- content type silently stopped resolving).
--
-- Storage mirrors the proven builder_* patterns rather than converging on the
-- legacy sitebuilder_layout_* tables (the sections tier is on a retirement path):
--   · builder_pages.is_default — at most one default per (tenant, record_type),
--     enforced by a PARTIAL UNIQUE index (Prisma can't express the predicate, so
--     it lives here — cf. builder_layouts.is_active in 20260622000000).
--   · builder_page_assignments — per-record override, the builder-owned analogue
--     of sitebuilder_layout_assignments (item_ref = the module's record id, no
--     cross-module FK), ENABLE/FORCE RLS like every builder_* table.
--
-- Additive, NO backfill: a (tenant, record_type) with no explicit default and a
-- record with no override both fall through to the published fallback — exactly
-- today's behaviour — so existing storefronts keep rendering unchanged.

-- AlterTable — the per-type default flag.
ALTER TABLE "builder_pages"
    ADD COLUMN "is_default" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex — at most one DEFAULT template per (tenant, record_type). The
-- service clears the prior default before setting the new one in one transaction,
-- so the intermediate (zero default) never trips this. record_type IS NOT NULL
-- so the predicate only constrains real collection targets.
CREATE UNIQUE INDEX "builder_pages_one_default_per_record_type"
    ON "builder_pages" ("tenant_id", "record_type")
    WHERE "is_default" AND "record_type" IS NOT NULL;

-- CreateTable — per-record template override.
CREATE TABLE "builder_page_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "record_type" VARCHAR(63) NOT NULL,
    "item_ref" VARCHAR(255) NOT NULL,
    "builder_page_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "builder_page_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "builder_page_assignments_tenant_id_record_type_item_ref_key"
    ON "builder_page_assignments" ("tenant_id", "record_type", "item_ref");
CREATE INDEX "builder_page_assignments_tenant_id_record_type_idx"
    ON "builder_page_assignments" ("tenant_id", "record_type");
CREATE INDEX "builder_page_assignments_builder_page_id_idx"
    ON "builder_page_assignments" ("builder_page_id");

-- AddForeignKey
ALTER TABLE "builder_page_assignments"
    ADD CONSTRAINT "builder_page_assignments_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "builder_page_assignments"
    ADD CONSTRAINT "builder_page_assignments_builder_page_id_fkey"
    FOREIGN KEY ("builder_page_id") REFERENCES "builder_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security — tenant isolation (ENABLE + FORCE), current_tenant_id()
-- defined in 20260527000100_rls, mirroring the other builder_* tables.
ALTER TABLE "builder_page_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "builder_page_assignments" FORCE ROW LEVEL SECURITY;
CREATE POLICY builder_page_assignments_tenant_isolation ON "builder_page_assignments"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
