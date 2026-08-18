-- Phase 8 (docs/87 §15): retire `b2b_invoices` INTO `billing_documents`.
--
-- `b2b_invoices` was a thin net-terms AR header auto-created from a B2B order.
-- `BillingDocument` doubles that AR responsibility, so the two converge onto one
-- billing engine. This migration:
--   (1) ensures the system `net-terms-ar` workflow (+ Invoice / Paid stages) for
--       every tenant that has any legacy invoice;
--   (2) backfills each `b2b_invoice` → a finalised `billing_document` (+ one
--       synthetic line, + a payment row when paid), preserving the human invoice
--       number, status, due date and payments;
--   (3) rewrites `sync_b2b_credit_used()` to sum OPEN `billing_documents` balances
--       (the new single AR source) instead of `b2b_invoices`;
--   (4) re-syncs `credit_used` for every account from the new source.
--
-- No schema/DDL change — `b2b_invoices` stays (read-only) for one release, then a
-- later migration drops it (expand/contract). Pure data + function rewrite.
--
-- RLS FOOTGUN (packages/db/CLAUDE.md): `billing_*`, `document_*` and `b2b_*` are
-- FORCE-RLS and prod `sparx_owner` is a non-superuser, so every read/write below
-- MUST run under `set_config('app.tenant_id', …)` for the tenant — otherwise the
-- `tenant_isolation` policies hide every row (passes as superuser locally, fails
-- 0-rows / 23502 in prod). Hence the per-tenant loop.

-- ── (1) + (2) ensure workflow + backfill, per tenant ──────────────────────────
DO $$
DECLARE
  t            RECORD;
  inv          RECORD;
  v_workflow   uuid;
  v_inv_stage  uuid;
  v_paid_stage uuid;
  v_doc        uuid;
  v_seq        int;
  v_amount     numeric(12,2);
  v_paid       boolean;
  v_voided     boolean;
  v_status     varchar(20);
  v_desc       varchar(500);
BEGIN
  FOR t IN SELECT DISTINCT tenant_id FROM b2b_invoices LOOP
    PERFORM set_config('app.tenant_id', t.tenant_id::text, false);

    -- (1) ensure the net-terms-ar workflow + its Invoice / Paid stages.
    SELECT id INTO v_workflow FROM document_workflows
      WHERE tenant_id = t.tenant_id AND slug = 'net-terms-ar';
    IF v_workflow IS NULL THEN
      INSERT INTO document_workflows
        (tenant_id, name, slug, is_default, sort_order, created_at, updated_at)
        VALUES (t.tenant_id, 'Net-terms AR', 'net-terms-ar', false, 100, now(), now())
        RETURNING id INTO v_workflow;
      INSERT INTO document_stages
        (tenant_id, workflow_id, name, customer_label, stage_type, snapshot_on_enter,
         number_on_enter, number_prefix, locks_editing, color, sort_order, created_at, updated_at)
        VALUES
          (t.tenant_id, v_workflow, 'Invoice', 'Invoice', 'final', true,  true,  'INV-', true, '#6366F1', 0, now(), now()),
          (t.tenant_id, v_workflow, 'Paid',    'Receipt', 'paid',  false, false, NULL,   true, '#10B981', 1, now(), now());
    END IF;
    SELECT id INTO v_inv_stage FROM document_stages
      WHERE tenant_id = t.tenant_id AND workflow_id = v_workflow AND stage_type = 'final'
      ORDER BY sort_order LIMIT 1;
    SELECT id INTO v_paid_stage FROM document_stages
      WHERE tenant_id = t.tenant_id AND workflow_id = v_workflow AND stage_type = 'paid'
      ORDER BY sort_order LIMIT 1;

    -- (2) backfill each legacy invoice not already migrated (idempotent via the
    --     metadata->>'b2bInvoiceId' tag, so a re-run is a no-op).
    FOR inv IN
      SELECT i.* FROM b2b_invoices i
      WHERE i.tenant_id = t.tenant_id
        AND NOT EXISTS (
          SELECT 1 FROM billing_documents d
          WHERE d.tenant_id = t.tenant_id
            AND d.metadata->>'b2bInvoiceId' = i.id::text
        )
      ORDER BY i.created_at
    LOOP
      v_amount := round(inv.amount_cents / 100.0, 2);
      v_paid   := inv.status = 'paid';
      v_voided := inv.status = 'written_off';
      v_status := CASE inv.status
                    WHEN 'paid'        THEN 'paid'
                    WHEN 'overdue'     THEN 'overdue'
                    WHEN 'written_off' THEN 'void'
                    ELSE 'unpaid'
                  END;
      v_desc := CASE WHEN inv.order_id IS NOT NULL THEN 'Order charge' ELSE 'Invoice' END;

      -- next stable per-tenant document sequence (matches nextBillingDocumentSeq).
      SELECT COALESCE(MAX(number_seq), 0) + 1 INTO v_seq
        FROM billing_documents WHERE tenant_id = t.tenant_id;

      INSERT INTO billing_documents (
        tenant_id, workflow_id, stage_id, b2b_account_id, currency,
        number, number_seq, tax_rate,
        subtotal, discount_total, tax_total, shipping_total, surcharge_total,
        total, deposit_total, amount_paid, balance,
        status, due_at, paid_at, overdue_days,
        notes, finalized_at, voided_at, metadata, created_at, updated_at
      ) VALUES (
        t.tenant_id, v_workflow,
        CASE WHEN v_paid THEN v_paid_stage ELSE v_inv_stage END,
        inv.account_id, 'USD',
        inv.invoice_number, v_seq, 0,
        v_amount, 0, 0, 0, 0,
        v_amount, 0,
        CASE WHEN v_paid THEN v_amount ELSE 0 END,
        CASE WHEN v_paid OR v_voided THEN 0 ELSE v_amount END,
        v_status, inv.due_at, inv.paid_at, inv.overdue_days,
        inv.notes, inv.created_at,
        CASE WHEN v_voided THEN inv.updated_at ELSE NULL END,
        jsonb_build_object(
          'source', 'b2b_invoice_backfill',
          'b2bInvoiceId', inv.id::text,
          'orderId', inv.order_id
        ),
        inv.created_at, inv.updated_at
      ) RETURNING id INTO v_doc;

      -- synthetic line carrying the receivable (flat, non-taxable — the order
      -- already computed + included tax, so the AR amount is authoritative).
      INSERT INTO billing_document_lines (
        tenant_id, document_id, description, quantity, unit_price,
        taxable, discount_amount, tax_amount, line_subtotal, line_total,
        sort_order, metadata, created_at, updated_at
      ) VALUES (
        t.tenant_id, v_doc, v_desc, 1, v_amount,
        false, 0, 0, v_amount, v_amount, 0, '{}'::jsonb, inv.created_at, inv.updated_at
      );

      -- payment row for a paid invoice, so amount_paid is reproducible from rows.
      IF v_paid THEN
        INSERT INTO billing_document_payments (
          tenant_id, document_id, kind, method, amount, received_at, recorded_by_id, created_at
        ) VALUES (
          t.tenant_id, v_doc, 'payment',
          CASE inv.paid_method
            WHEN 'check'       THEN 'check'
            WHEN 'ach'         THEN 'ach'
            WHEN 'wire'        THEN 'wire'
            WHEN 'credit_card' THEN 'card'
            ELSE 'other'
          END,
          v_amount, COALESCE(inv.paid_at, inv.updated_at), inv.paid_by_user_id,
          COALESCE(inv.paid_at, inv.updated_at)
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- ── (3) rewrite sync_b2b_credit_used → sum OPEN billing_documents balances ─────
-- credit_used = the account's outstanding net-terms AR. `balance` already nets out
-- partial payments (the legacy header could not), so this is strictly more correct.
-- void / paid documents fall out of the open set. SECURITY DEFINER + RLS-bound, so
-- callers must have the tenant GUC set (every caller runs under withTenant).
CREATE OR REPLACE FUNCTION sync_b2b_credit_used(p_account_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE b2b_accounts a
  SET credit_used = (
    SELECT COALESCE(SUM(d.balance), 0)
    FROM billing_documents d
    WHERE d.b2b_account_id = p_account_id
      AND d.deleted_at IS NULL
      AND d.status IN ('unpaid', 'partial', 'overdue')
  ),
  updated_at = now()
  WHERE a.id = p_account_id;
END;
$$;

-- ── (4) re-sync credit_used for every account from the new source, per tenant ──
DO $$
DECLARE
  t RECORD;
  a RECORD;
BEGIN
  FOR t IN
    SELECT DISTINCT tenant_id FROM billing_documents WHERE b2b_account_id IS NOT NULL
  LOOP
    PERFORM set_config('app.tenant_id', t.tenant_id::text, false);
    FOR a IN
      SELECT DISTINCT b2b_account_id FROM billing_documents
      WHERE tenant_id = t.tenant_id AND b2b_account_id IS NOT NULL
    LOOP
      PERFORM sync_b2b_credit_used(a.b2b_account_id);
    END LOOP;
  END LOOP;
END $$;
