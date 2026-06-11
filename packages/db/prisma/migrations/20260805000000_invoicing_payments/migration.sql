-- Invoicing Phase 4 (docs/87 §8): payments / AR on billing documents.
--
-- Adds:
--   • billing_document_payments — append-only deposit/payment/refund rows; the
--     document's amountPaid / depositTotal / balance / status derive from their
--     sum. Money is Decimal(12,2) dollars, uniform with the document totals.
--   • billing_documents.due_at / paid_at / overdue_days — AR fields. due_at is
--     set on finalize from the B2B account's terms (or by hand) and drives the
--     overdue escalation; the (tenant_id, status, due_at) index serves that scan
--     (replacing the plain (tenant_id, status) index).
--
-- RLS: billing_document_payments is tenant-scoped → ENABLE + FORCE + isolation
-- policy. New table, no backfill.

-- AlterTable
ALTER TABLE "billing_documents" ADD COLUMN     "due_at" TIMESTAMPTZ,
ADD COLUMN     "overdue_days" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paid_at" TIMESTAMPTZ;

-- DropIndex (superseded by the status+due_at composite below)
DROP INDEX "billing_documents_tenant_id_status_idx";

-- CreateIndex
CREATE INDEX "billing_documents_tenant_id_status_due_at_idx" ON "billing_documents"("tenant_id", "status", "due_at");

-- CreateTable
CREATE TABLE "billing_document_payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "kind" VARCHAR(16) NOT NULL,
    "method" VARCHAR(16) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference" VARCHAR(120),
    "provider_ref" VARCHAR(200),
    "note" TEXT,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_document_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_document_payments_tenant_id_document_id_received_at_idx" ON "billing_document_payments"("tenant_id", "document_id", "received_at" DESC);

-- AddForeignKey
ALTER TABLE "billing_document_payments" ADD CONSTRAINT "billing_document_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_document_payments" ADD CONSTRAINT "billing_document_payments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "billing_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_document_payments" ADD CONSTRAINT "billing_document_payments_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security (hand-authored — Prisma does not generate RLS).
ALTER TABLE "billing_document_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_document_payments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "billing_document_payments"
  USING ("tenant_id" = current_tenant_id());
