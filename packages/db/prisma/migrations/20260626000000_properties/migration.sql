-- Multi-property (multi-site) foundation — the Property entity (docs/49).
--
-- One TENANT has one-or-more PROPERTIES (a property = a distinct site:
-- presentation + page tree + domain) over the shared back office. This is the
-- Phase 1 / Step A slice: the new table only. The Builder presentation layer
-- (builder_pages / builder_layouts) re-keys onto property_id in a later slice.
--
-- One tenant-scoped table, ENABLE + FORCE RLS with a tenant_isolation policy on
-- current_tenant_id() (defined in 20260527000100_rls). Mirrors
-- 20260625000000_seo_audits. property_id (added to other tables later) is NOT a
-- security boundary and gets no policy — tenant_id stays the only RLS boundary
-- (docs/49 §2).
--
-- BACKFILL: seed exactly one PRIMARY property per existing tenant so the platform
-- behaves identically (one site each) post-migration. The table is FORCE RLS and
-- the prod migration runner (sparx_owner) is NOT a superuser, so an INSERT's
-- WITH CHECK only passes when app.tenant_id is set — we loop tenants and set it
-- per tenant (cf. current_tenant_id() in 20260527000100_rls, and the backfill in
-- 20260622000000_builder_multi_layouts).

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "slug" VARCHAR(63) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex — stable per-tenant handle.
CREATE UNIQUE INDEX "properties_tenant_id_slug_key" ON "properties"("tenant_id", "slug");
CREATE INDEX "properties_tenant_id_idx" ON "properties"("tenant_id");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security — tenant isolation (ENABLE + FORCE). Mirrors
-- 20260625000000_seo_audits.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE "properties" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "properties" FORCE  ROW LEVEL SECURITY;
CREATE POLICY properties_tenant_isolation ON "properties"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Backfill — one PRIMARY property per existing tenant (slug='primary', name from
-- the tenant). Per-tenant loop because FORCE RLS hides rows / blocks the INSERT
-- WITH CHECK for the non-superuser runner unless app.tenant_id is set. Sourced
-- from the non-RLS tenants table.
DO $$
DECLARE
    v_tenant UUID;
    v_name   VARCHAR(255);
BEGIN
    FOR v_tenant, v_name IN SELECT "id", "name" FROM "tenants" LOOP
        PERFORM set_config('app.tenant_id', v_tenant::text, true);
        INSERT INTO "properties" ("tenant_id", "slug", "name", "is_primary", "updated_at")
        VALUES (v_tenant, 'primary', v_name, true, CURRENT_TIMESTAMP);
    END LOOP;
END
$$;

-- CreateIndex — exactly one PRIMARY property per tenant (partial unique). Prisma
-- can't express the predicate, so it lives here in SQL only (the differ leaves it
-- alone), like builder_layouts_one_active_per_tenant.
CREATE UNIQUE INDEX "properties_one_primary_per_tenant"
    ON "properties" ("tenant_id") WHERE "is_primary";

-- Align updated_at with Prisma's @updatedAt convention (the client sets it on
-- every write; no DB default). Keeps `prisma migrate diff` clean.
ALTER TABLE "properties" ALTER COLUMN "updated_at" DROP DEFAULT;
