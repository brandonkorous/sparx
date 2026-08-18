-- Builder — the Email Builder's email documents (docs/52-email-builder.md).
-- One tenant-scoped table; the node-tree JSON (the email body) is validated by
-- @sparx/builder-schemas, not the DB. Sibling of builder_pages
-- (20260618000000_builder_pages) and builder_layouts with the same draft/publish
-- lifecycle. An email is ONE self-contained body tree — no slug, kind,
-- recordType, or SEO; two document fields the page model lacks: subject +
-- preheader.
--
-- ENABLE + FORCE RLS with a tenant_isolation policy on current_tenant_id()
-- (defined in 20260527000100_rls). Mirrors 20260621000000_builder_layouts.
--
-- ADDITIVE + non-destructive: a new empty table only. No backfill, so no
-- per-tenant app.tenant_id loop is needed. The starter emails are seeded at
-- RUNTIME by the service (under withTenant, so RLS is satisfied), never here.

-- CreateTable
CREATE TABLE "builder_emails" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(255) NOT NULL DEFAULT '',
    "preheader" VARCHAR(255),
    "draft_tree" JSONB NOT NULL,
    "published_tree" JSONB,
    "published_at" TIMESTAMPTZ,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "builder_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex — catalog ordering (matches @@index([tenantId, position])).
CREATE INDEX "builder_emails_tenant_id_position_idx"
    ON "builder_emails" ("tenant_id", "position");

-- AddForeignKey
ALTER TABLE "builder_emails" ADD CONSTRAINT "builder_emails_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security — tenant isolation (ENABLE + FORCE). Mirrors
-- 20260621000000_builder_layouts.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE "builder_emails" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "builder_emails" FORCE  ROW LEVEL SECURITY;
CREATE POLICY builder_emails_tenant_isolation ON "builder_emails"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Align updated_at with Prisma's @updatedAt convention (the client sets it on
-- every write; no DB default). Keeps `prisma migrate diff` clean.
ALTER TABLE "builder_emails" ALTER COLUMN "updated_at" DROP DEFAULT;
