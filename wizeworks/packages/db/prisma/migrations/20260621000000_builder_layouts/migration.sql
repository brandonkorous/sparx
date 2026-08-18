-- Builder — the site LAYOUT / chrome shell (docs/45-builder-site-layout.md).
-- One tenant-scoped table; the node-tree JSON is validated by
-- @sparx/builder-schemas, not the DB. Sibling of builder_pages
-- (20260618000000_builder_pages) with the same draft/publish lifecycle.
--
-- ONE row per tenant in v1 (the global site layout), enforced by a UNIQUE on
-- tenant_id. Named layouts + per-page assignment are deferred (docs/45 §7) —
-- introduced later by dropping this unique.
--
-- One tenant-scoped table, ENABLE + FORCE RLS with a tenant_isolation policy on
-- current_tenant_id() (defined in 20260527000100_rls). Mirrors
-- 20260618000000_builder_pages.
--
-- ADDITIVE + non-destructive: a new empty table only. No backfill, so no
-- per-tenant app.tenant_id loop is needed. The starter layout is seeded at
-- RUNTIME by the service (under withTenant, so RLS is satisfied), never here.

-- CreateTable
CREATE TABLE "builder_layouts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "draft_tree" JSONB NOT NULL,
    "published_tree" JSONB,
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "builder_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex — one layout per tenant (v1).
CREATE UNIQUE INDEX "builder_layouts_tenant_id_key" ON "builder_layouts"("tenant_id");

-- AddForeignKey
ALTER TABLE "builder_layouts" ADD CONSTRAINT "builder_layouts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security — tenant isolation (ENABLE + FORCE). Mirrors
-- 20260618000000_builder_pages.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE "builder_layouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "builder_layouts" FORCE  ROW LEVEL SECURITY;
CREATE POLICY builder_layouts_tenant_isolation ON "builder_layouts"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Align updated_at with Prisma's @updatedAt convention (the client sets it on
-- every write; no DB default). Keeps `prisma migrate diff` clean.
ALTER TABLE "builder_layouts" ALTER COLUMN "updated_at" DROP DEFAULT;
