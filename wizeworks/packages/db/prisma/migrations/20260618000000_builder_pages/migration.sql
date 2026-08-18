-- Builder — composition-model page editor persistence (docs/41-builder-page-model.md).
-- One tenant-scoped table per page a tenant has; the node-tree JSON is validated
-- by @sparx/builder-schemas, not the DB. Distinct from the legacy sitebuilder_*
-- tables — Builder is the successor surface (docs/40) on its own clean storage.
--
-- One tenant-scoped table, ENABLE + FORCE RLS with a tenant_isolation policy on
-- current_tenant_id() (defined in 20260527000100_rls). Mirrors
-- 20260617000000_sitebuilder_section_definitions.
--
-- ADDITIVE + non-destructive: a new empty table only. No backfill, so no
-- per-tenant app.tenant_id loop is needed (cf. 20260610000000_tenant_brand). The
-- curated starter pages are seeded at RUNTIME by the service (under withTenant,
-- so RLS is satisfied), never here.

-- CreateTable
CREATE TABLE "builder_pages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "kind" VARCHAR(20) NOT NULL DEFAULT 'singleton',
    "record_type" VARCHAR(63),
    "draft_tree" JSONB NOT NULL,
    "published_tree" JSONB,
    "published_at" TIMESTAMPTZ,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "builder_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "builder_pages_tenant_id_position_idx" ON "builder_pages"("tenant_id", "position");

-- AddForeignKey
ALTER TABLE "builder_pages" ADD CONSTRAINT "builder_pages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security — tenant isolation (ENABLE + FORCE). Mirrors
-- 20260527000100_rls / 20260617000000_sitebuilder_section_definitions.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE "builder_pages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "builder_pages" FORCE  ROW LEVEL SECURITY;
CREATE POLICY builder_pages_tenant_isolation ON "builder_pages"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Align updated_at with Prisma's @updatedAt convention (the client sets it on
-- every write; no DB default). Keeps `prisma migrate diff` clean.
ALTER TABLE "builder_pages" ALTER COLUMN "updated_at" DROP DEFAULT;
