-- SEO — stored audit scorecard snapshots (docs/50 §7).
--
-- One row per audited entity per tenant: the last computed score + grade + the
-- full scorecard JSON. Populated by the live audit endpoint (upsert on compute)
-- and a whole-site reindex; read by the site-wide SEO overview so it can rank
-- every page without firing N live audits.
--
-- One tenant-scoped table, ENABLE + FORCE RLS with a tenant_isolation policy on
-- current_tenant_id() (defined in 20260527000100_rls). Mirrors
-- 20260621000000_builder_layouts.
--
-- ADDITIVE + non-destructive: a new empty table only. No backfill, so no
-- per-tenant app.tenant_id loop is needed.

-- CreateTable
CREATE TABLE "seo_audits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "entity_type" VARCHAR(20) NOT NULL,
    "entity_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "grade" VARCHAR(20) NOT NULL,
    "fix_first" VARCHAR(500),
    "title" VARCHAR(300),
    "path" VARCHAR(2048),
    "card" JSONB NOT NULL,
    "computed_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "seo_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex — one snapshot per (tenant, entity).
CREATE UNIQUE INDEX "seo_audits_tenant_id_entity_type_entity_id_key" ON "seo_audits"("tenant_id", "entity_type", "entity_id");
-- Overview sort (worst-scoring first) + per-type filtering.
CREATE INDEX "seo_audits_tenant_id_score_idx" ON "seo_audits"("tenant_id", "score");
CREATE INDEX "seo_audits_tenant_id_entity_type_idx" ON "seo_audits"("tenant_id", "entity_type");

-- AddForeignKey
ALTER TABLE "seo_audits" ADD CONSTRAINT "seo_audits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security — tenant isolation (ENABLE + FORCE). Mirrors
-- 20260621000000_builder_layouts.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE "seo_audits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "seo_audits" FORCE  ROW LEVEL SECURITY;
CREATE POLICY seo_audits_tenant_isolation ON "seo_audits"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Align updated_at with Prisma's @updatedAt convention (the client sets it on
-- every write; no DB default). Keeps `prisma migrate diff` clean.
ALTER TABLE "seo_audits" ALTER COLUMN "updated_at" DROP DEFAULT;
