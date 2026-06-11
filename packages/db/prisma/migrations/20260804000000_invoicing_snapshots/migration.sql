-- Invoicing Phase 3 (docs/87 §4/§9): stage snapshots + stable document sequence.
--
-- Adds:
--   • billing_documents.number_seq — the stable per-tenant document sequence
--     allocated once on first numbering; the formatted `number` swaps prefix
--     per stage (EST-000123 → INV-000123) but keeps this suffix for life.
--   • billing_document_snapshots — an append-only immutable freeze of a document
--     at a `snapshotOnEnter` stage transition (the "approved estimate" / "final
--     invoice"). Never edited or deleted; a void/correction adds a new row.
--
-- RLS: billing_document_snapshots is tenant-scoped → ENABLE + FORCE + isolation
-- policy. New table, no backfill. billing_documents already has RLS (Phase 2),
-- so the added column needs no policy change.

-- AlterTable
ALTER TABLE "billing_documents" ADD COLUMN     "number_seq" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "billing_documents_tenant_seq_unique" ON "billing_documents"("tenant_id", "number_seq");

-- CreateTable
CREATE TABLE "billing_document_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "stage_type" VARCHAR(20) NOT NULL,
    "customer_label" VARCHAR(60) NOT NULL,
    "document_number" VARCHAR(63),
    "snapshot" JSONB NOT NULL,
    "pdf_media_id" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_document_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_document_snapshots_tenant_id_document_id_created_at_idx" ON "billing_document_snapshots"("tenant_id", "document_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "billing_document_snapshots" ADD CONSTRAINT "billing_document_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_document_snapshots" ADD CONSTRAINT "billing_document_snapshots_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "billing_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_document_snapshots" ADD CONSTRAINT "billing_document_snapshots_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "document_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_document_snapshots" ADD CONSTRAINT "billing_document_snapshots_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security (hand-authored — Prisma does not generate RLS).
ALTER TABLE "billing_document_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_document_snapshots" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "billing_document_snapshots"
  USING ("tenant_id" = current_tenant_id());
