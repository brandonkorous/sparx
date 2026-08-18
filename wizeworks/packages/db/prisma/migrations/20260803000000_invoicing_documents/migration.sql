-- Invoicing module (docs/87) Phase 2 — billing documents + their lines.
-- Hand-authored (the repo's generated diff carries pre-existing index-rename
-- noise); only the two new objects + their RLS are kept here.

-- CreateTable
CREATE TABLE "billing_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "customer_id" UUID,
    "b2b_account_id" UUID,
    "assigned_user_id" UUID,
    "number" VARCHAR(63),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "bill_to" JSONB,
    "ship_to" JSONB,
    "tax_rate" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shipping_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "surcharge_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deposit_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'unpaid',
    "notes" TEXT,
    "valid_until" TIMESTAMPTZ,
    "finalized_at" TIMESTAMPTZ,
    "voided_at" TIMESTAMPTZ,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "billing_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_document_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "line_type_id" UUID,
    "product_id" UUID,
    "variant_id" UUID,
    "technician_user_id" UUID,
    "description" VARCHAR(500) NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cost_cents" INTEGER,
    "applied_markup" JSONB,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "line_subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "billing_document_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_documents_tenant_id_workflow_id_stage_id_idx" ON "billing_documents"("tenant_id", "workflow_id", "stage_id");

-- CreateIndex
CREATE INDEX "billing_documents_tenant_id_customer_id_idx" ON "billing_documents"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "billing_documents_tenant_id_b2b_account_id_idx" ON "billing_documents"("tenant_id", "b2b_account_id");

-- CreateIndex
CREATE INDEX "billing_documents_tenant_id_status_idx" ON "billing_documents"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "billing_documents_tenant_id_updated_at_idx" ON "billing_documents"("tenant_id", "updated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "billing_documents_tenant_number_unique" ON "billing_documents"("tenant_id", "number");

-- CreateIndex
CREATE INDEX "billing_document_lines_tenant_id_document_id_idx" ON "billing_document_lines"("tenant_id", "document_id");

-- CreateIndex
CREATE INDEX "billing_document_lines_variant_id_idx" ON "billing_document_lines"("variant_id");

-- AddForeignKey
ALTER TABLE "billing_documents" ADD CONSTRAINT "billing_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_documents" ADD CONSTRAINT "billing_documents_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "document_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_documents" ADD CONSTRAINT "billing_documents_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "document_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_documents" ADD CONSTRAINT "billing_documents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_documents" ADD CONSTRAINT "billing_documents_b2b_account_id_fkey" FOREIGN KEY ("b2b_account_id") REFERENCES "b2b_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_documents" ADD CONSTRAINT "billing_documents_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_document_lines" ADD CONSTRAINT "billing_document_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_document_lines" ADD CONSTRAINT "billing_document_lines_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "billing_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_document_lines" ADD CONSTRAINT "billing_document_lines_line_type_id_fkey" FOREIGN KEY ("line_type_id") REFERENCES "billing_document_line_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_document_lines" ADD CONSTRAINT "billing_document_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "commerce_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_document_lines" ADD CONSTRAINT "billing_document_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "commerce_product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_document_lines" ADD CONSTRAINT "billing_document_lines_technician_user_id_fkey" FOREIGN KEY ("technician_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Row Level Security (hand-authored) ──────────────────────────────────────
-- Both tables are tenant-scoped: ENABLE + FORCE + tenant_isolation. New tables,
-- so no backfill loop is needed.

ALTER TABLE "billing_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_documents" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "billing_documents"
  USING ("tenant_id" = current_tenant_id());

ALTER TABLE "billing_document_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_document_lines" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "billing_document_lines"
  USING ("tenant_id" = current_tenant_id());
