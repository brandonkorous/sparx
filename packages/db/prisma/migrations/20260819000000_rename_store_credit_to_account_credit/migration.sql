-- Store credit → Account credit (store→site rename, docs/34 §5).
-- Data-preserving renames (ALTER ... RENAME, never DROP/CREATE) of the
-- account-credit tables, their columns, constraints, indexes, and RLS policies,
-- plus a per-tenant backfill of the persisted 'store_credit' enum value to
-- 'account_credit' on FORCE-RLS tables (return outcomes + invoice payments).

-- ── Tables ────────────────────────────────────────────────────────────────
ALTER TABLE "commerce_store_credit" RENAME TO "commerce_account_credit";
ALTER TABLE "commerce_store_credit_transactions" RENAME TO "commerce_account_credit_transactions";

-- ── Columns ───────────────────────────────────────────────────────────────
ALTER TABLE "commerce_account_credit_transactions" RENAME COLUMN "store_credit_id" TO "account_credit_id";
ALTER TABLE "commerce_carts" RENAME COLUMN "store_credit_applied_cents" TO "account_credit_applied_cents";
ALTER TABLE "commerce_checkout_sessions" RENAME COLUMN "store_credit_applied_cents" TO "account_credit_applied_cents";

-- ── Primary keys ──────────────────────────────────────────────────────────
ALTER TABLE "commerce_account_credit" RENAME CONSTRAINT "commerce_store_credit_pkey" TO "commerce_account_credit_pkey";
ALTER TABLE "commerce_account_credit_transactions" RENAME CONSTRAINT "commerce_store_credit_transactions_pkey" TO "commerce_account_credit_transactions_pkey";

-- ── Foreign keys ──────────────────────────────────────────────────────────
ALTER TABLE "commerce_account_credit" RENAME CONSTRAINT "commerce_store_credit_tenant_id_fkey" TO "commerce_account_credit_tenant_id_fkey";
ALTER TABLE "commerce_account_credit" RENAME CONSTRAINT "commerce_store_credit_customer_id_fkey" TO "commerce_account_credit_customer_id_fkey";
ALTER TABLE "commerce_account_credit_transactions" RENAME CONSTRAINT "commerce_store_credit_transactions_tenant_id_fkey" TO "commerce_account_credit_transactions_tenant_id_fkey";
ALTER TABLE "commerce_account_credit_transactions" RENAME CONSTRAINT "commerce_store_credit_transactions_store_credit_id_fkey" TO "commerce_account_credit_transactions_account_credit_id_fkey";

-- ── Indexes ───────────────────────────────────────────────────────────────
ALTER INDEX "store_credit_unique" RENAME TO "account_credit_unique";
ALTER INDEX "commerce_store_credit_transactions_tenant_id_store_credit_i_idx" RENAME TO "commerce_account_credit_transactions_tenant_id_account_cred_idx";

-- ── RLS policies (hand-managed; renamed for naming consistency) ────────────
ALTER POLICY "commerce_store_credit_tenant_isolation" ON "commerce_account_credit" RENAME TO "commerce_account_credit_tenant_isolation";
ALTER POLICY "commerce_store_credit_transactions_tenant_isolation" ON "commerce_account_credit_transactions" RENAME TO "commerce_account_credit_transactions_tenant_isolation";

-- ── Backfill persisted enum value 'store_credit' → 'account_credit' ────────
-- FORCE-RLS tables: sparx_owner is a non-superuser in prod and sees 0 rows
-- without tenant context, so loop tenants + set_config (memory: sparx_db_rls).
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM "tenants" LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);
        UPDATE "commerce_return_requests"
           SET "preferred_outcome" = 'account_credit'
         WHERE "preferred_outcome" = 'store_credit';
        UPDATE "commerce_return_requests"
           SET "refund_issued_as" = 'account_credit'
         WHERE "refund_issued_as" = 'store_credit';
        UPDATE "billing_document_payments"
           SET "method" = 'account_credit'
         WHERE "method" = 'store_credit';
    END LOOP;
    PERFORM set_config('app.tenant_id', '', true);
END $$;
