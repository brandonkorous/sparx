-- Invoicing module (docs/87) Phase 1 — workflow / stage / line-type config tables.
-- Hand-authored: the generated `migrate diff` for this repo carries pre-existing
-- index-rename noise (historical map: drift), so only the new objects are kept
-- here. RLS is appended by hand per packages/db/CLAUDE.md.

-- CreateTable
CREATE TABLE "document_workflows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(63) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "document_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_stages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "customer_label" VARCHAR(60) NOT NULL,
    "stage_type" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "snapshot_on_enter" BOOLEAN NOT NULL DEFAULT false,
    "number_on_enter" BOOLEAN NOT NULL DEFAULT false,
    "number_prefix" VARCHAR(12),
    "locks_editing" BOOLEAN NOT NULL DEFAULT false,
    "color" VARCHAR(9),
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "document_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_document_line_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "key" VARCHAR(63) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "pricing_mode" VARCHAR(16) NOT NULL DEFAULT 'flat',
    "default_taxable" BOOLEAN NOT NULL DEFAULT true,
    "default_markup_rule_id" UUID,
    "computation" VARCHAR(40),
    "gl_code" VARCHAR(40),
    "category" VARCHAR(40),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "billing_document_line_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_workflows_tenant_id_archived_at_idx" ON "document_workflows"("tenant_id", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "document_workflows_tenant_id_slug_key" ON "document_workflows"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "document_stages_tenant_id_workflow_id_idx" ON "document_stages"("tenant_id", "workflow_id");

-- CreateIndex
CREATE INDEX "document_stages_workflow_id_sort_order_idx" ON "document_stages"("workflow_id", "sort_order");

-- CreateIndex
CREATE INDEX "billing_document_line_types_tenant_id_is_active_idx" ON "billing_document_line_types"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "billing_document_line_types_tenant_id_key_key" ON "billing_document_line_types"("tenant_id", "key");

-- AddForeignKey
ALTER TABLE "document_workflows" ADD CONSTRAINT "document_workflows_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_stages" ADD CONSTRAINT "document_stages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_stages" ADD CONSTRAINT "document_stages_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "document_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_document_line_types" ADD CONSTRAINT "billing_document_line_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_document_line_types" ADD CONSTRAINT "billing_document_line_types_default_markup_rule_id_fkey" FOREIGN KEY ("default_markup_rule_id") REFERENCES "markup_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Row Level Security (hand-authored — Prisma does not generate it) ─────────
-- All three tables are tenant-scoped: ENABLE + FORCE + tenant_isolation. No
-- backfill (new tables), so no per-tenant set_config loop is needed.

ALTER TABLE "document_workflows" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_workflows" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "document_workflows"
  USING ("tenant_id" = current_tenant_id());

ALTER TABLE "document_stages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_stages" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "document_stages"
  USING ("tenant_id" = current_tenant_id());

ALTER TABLE "billing_document_line_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_document_line_types" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "billing_document_line_types"
  USING ("tenant_id" = current_tenant_id());
