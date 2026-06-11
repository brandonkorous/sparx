-- Invoicing (docs/87 §10, Phase 5b) — builder-authored print templates.
-- One BuilderNode tree per template (draft + published), AUTHOR-only; the
-- tenant's default template drives the `…/pdf` render when published.

-- CreateTable
CREATE TABLE "billing_document_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "draft_tree" JSONB NOT NULL,
    "published_tree" JSONB,
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "billing_document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_document_templates_tenant_id_idx" ON "billing_document_templates"("tenant_id");

-- One default template per tenant (partial unique — hand-SQL, not Prisma-generated).
CREATE UNIQUE INDEX "billing_document_templates_tenant_default_unique"
  ON "billing_document_templates"("tenant_id")
  WHERE "is_default";

-- AddForeignKey
ALTER TABLE "billing_document_templates" ADD CONSTRAINT "billing_document_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security (tenant-scoped table — ENABLE + FORCE + isolation policy).
ALTER TABLE "billing_document_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_document_templates" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "billing_document_templates"
  USING ("tenant_id" = current_tenant_id());
