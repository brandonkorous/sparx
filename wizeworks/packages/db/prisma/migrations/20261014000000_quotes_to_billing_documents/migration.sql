-- Consolidate `quotes`/`quote_items` INTO `billing_documents` (locked decision:
-- one canonical RFQ/quote/invoice/receipt entity, owned by Invoicing).
--
-- `Quote` was two independently-implemented lifecycles (a CRM path and a
-- separate B2B/RFQ path) sharing one table pair, with only the CRM path able
-- to convert an accepted quote to an Order. `BillingDocument` already owns a
-- strictly more capable document engine (configurable stages, immutable
-- snapshots, a real branded print system, a payments/AR ledger) — so quotes
-- converge onto it, same as the earlier `b2b_invoices` → `billing_documents`
-- convergence (see 20260807000000_b2b_invoices_to_billing_documents). This
-- migration:
--   (1) ensures a system `b2b-quotes` DocumentWorkflow (+ 7 stages spanning the
--       old Draft/Submitted/Under Review/Quoted/Accepted/Declined/Expired
--       lifecycle) for every tenant that has any legacy quote;
--   (2) backfills each `quote` → a `billing_document` (+ its `quote_items` →
--       `billing_document_lines`, preserving `cost_cents`/`applied_markup`
--       verbatim), stamping the old lifecycle timestamps (submitted/accepted/
--       declined/expired) into `metadata` since BillingDocument has no direct
--       column equivalent — that history now also lives in
--       BillingDocumentSnapshot/audit-log rows going forward;
--   (3) backfills each `deal_quotes` join row → `deal_billing_documents`;
--   (4) for already-converted quotes, backfills the new
--       `orders.converted_from_document_id` FK — the one physical column for
--       that relation (BillingDocument navigates the reverse direction via its
--       non-FK `convertedOrder` relation) — replacing the old
--       metadata/string-only pointer.
--
-- The schema-expand DDL (new BillingDocument/Order columns, the
-- deal_billing_documents table + its RLS) is hand-authored below, ahead of the
-- data backfill in the same file — this repo's migrations are never generated
-- against the private-IP prod instance, only authored by hand against the
-- schema.prisma source of truth (packages/db/CLAUDE.md).
-- `quotes`/`quote_items`/`deal_quotes` stay (read-only, by convention) for one
-- full release; a later migration drops them (expand/contract "contract" step).
--
-- RLS FOOTGUN (packages/db/CLAUDE.md): `billing_*`, `document_*`, `deal_*` and
-- `quotes`/`quote_items` are FORCE-RLS and prod `sparx_owner` is a non-superuser,
-- so every read/write below MUST run under `set_config('app.tenant_id', …)` for
-- the tenant — otherwise the `tenant_isolation` policies hide every row (passes
-- as superuser locally, fails 0-rows/23502 in prod). Hence the per-tenant loop.

-- ── schema expand: new columns + deal_billing_documents table ─────────────────

ALTER TABLE "billing_documents"
  ADD COLUMN "customer_note" TEXT,
  ADD COLUMN "declined_reason" VARCHAR(500),
  ADD COLUMN "converted_at" TIMESTAMPTZ,
  ADD COLUMN "created_by_user_id" UUID;

ALTER TABLE "billing_documents"
  ADD CONSTRAINT "billing_documents_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Single physical FK for the document→order conversion link (1:1). Column-level
-- @unique, not a tenant-scoped composite — see the comment on
-- Order.convertedFromDocumentId in 24-crm-orders.prisma for why.
ALTER TABLE "orders"
  ADD COLUMN "converted_from_document_id" UUID;

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_converted_from_document_id_key" UNIQUE ("converted_from_document_id");

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_converted_from_document_id_fkey"
    FOREIGN KEY ("converted_from_document_id") REFERENCES "billing_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Cart.fromQuoteId → Cart.fromDocumentId (schema rename, same consolidation):
-- a cart bootstrapped from an accepted quote now points at a BillingDocument,
-- not a retired Quote row. No write path populates this column yet (soft
-- reference, no FK) — a plain rename, no backfill needed.
ALTER TABLE "commerce_carts"
  RENAME COLUMN "from_quote_id" TO "from_document_id";

-- deal_billing_documents — replaces deal_quotes as the Deal↔BillingDocument join
-- (mirrors deal_orders/deal_quotes shape from 20260601000000_crm_module).
CREATE TABLE "deal_billing_documents" (
    "deal_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deal_billing_documents_pkey" PRIMARY KEY ("deal_id", "document_id")
);

CREATE INDEX "deal_billing_documents_tenant_id_document_id_idx"
  ON "deal_billing_documents"("tenant_id", "document_id");

ALTER TABLE "deal_billing_documents"
    ADD CONSTRAINT "deal_billing_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "deal_billing_documents_deal_id_fkey"   FOREIGN KEY ("deal_id")   REFERENCES "deals"("id")   ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "deal_billing_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "billing_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deal_billing_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deal_billing_documents" FORCE  ROW LEVEL SECURITY;
CREATE POLICY deal_billing_documents_tenant_isolation ON "deal_billing_documents"
  USING ("tenant_id" = current_tenant_id());

-- ── (1) + (2) ensure workflow + backfill documents/lines, per tenant ──────────
DO $$
DECLARE
  t              RECORD;
  q              RECORD;
  item           RECORD;
  v_workflow     uuid;
  v_stage_draft  uuid;
  v_stage_subm   uuid;
  v_stage_review uuid;
  v_stage_quoted uuid;
  v_stage_accept uuid;
  v_stage_decl   uuid;
  v_stage_exp    uuid;
  v_target_stage uuid;
  v_doc          uuid;
  v_seq          int;
  v_status       varchar(20);
  v_line_desc    varchar(500);
BEGIN
  FOR t IN SELECT DISTINCT tenant_id FROM quotes LOOP
    PERFORM set_config('app.tenant_id', t.tenant_id::text, false);

    -- (1) ensure the b2b-quotes workflow + its 7 stages. Semantics: draft-type
    -- covers every pre-decision state (Draft/Submitted/Under Review/Quoted);
    -- committed = customer-approved (Accepted, snapshot-on-enter freezes "the
    -- approved quote"); void covers the two terminal non-approval outcomes.
    -- There is deliberately no "Converted" stage — conversion is tracked by
    -- orders.converted_from_document_id (plus this document's own
    -- converted_at) independent of stage, so an accepted+converted quote
    -- simply stays in Accepted.
    SELECT id INTO v_workflow FROM document_workflows
      WHERE tenant_id = t.tenant_id AND slug = 'b2b-quotes';
    IF v_workflow IS NULL THEN
      INSERT INTO document_workflows
        (tenant_id, name, slug, is_default, sort_order, created_at, updated_at)
        VALUES (t.tenant_id, 'B2B Quotes', 'b2b-quotes', false, 101, now(), now())
        RETURNING id INTO v_workflow;
      INSERT INTO document_stages
        (tenant_id, workflow_id, name, customer_label, stage_type, snapshot_on_enter,
         number_on_enter, number_prefix, locks_editing, color, sort_order, created_at, updated_at)
        VALUES
          (t.tenant_id, v_workflow, 'Draft',         'Draft',         'draft',     false, true,  'Q-', false, '#94A3B8', 0, now(), now()),
          (t.tenant_id, v_workflow, 'Submitted',     'Submitted',     'draft',     false, false, NULL, false, '#0EA5E9', 1, now(), now()),
          (t.tenant_id, v_workflow, 'Under Review',  'Under Review',  'draft',     false, false, NULL, false, '#0EA5E9', 2, now(), now()),
          (t.tenant_id, v_workflow, 'Quoted',        'Quoted',        'draft',     false, false, NULL, false, '#6366F1', 3, now(), now()),
          (t.tenant_id, v_workflow, 'Accepted',      'Accepted',      'committed', true,  false, NULL, false, '#10B981', 4, now(), now()),
          (t.tenant_id, v_workflow, 'Declined',      'Declined',      'void',      false, false, NULL, true,  '#EF4444', 5, now(), now()),
          (t.tenant_id, v_workflow, 'Expired',       'Expired',       'void',      false, false, NULL, true,  '#94A3B8', 6, now(), now());
    END IF;

    SELECT id INTO v_stage_draft  FROM document_stages WHERE tenant_id = t.tenant_id AND workflow_id = v_workflow AND name = 'Draft';
    SELECT id INTO v_stage_subm   FROM document_stages WHERE tenant_id = t.tenant_id AND workflow_id = v_workflow AND name = 'Submitted';
    SELECT id INTO v_stage_review FROM document_stages WHERE tenant_id = t.tenant_id AND workflow_id = v_workflow AND name = 'Under Review';
    SELECT id INTO v_stage_quoted FROM document_stages WHERE tenant_id = t.tenant_id AND workflow_id = v_workflow AND name = 'Quoted';
    SELECT id INTO v_stage_accept FROM document_stages WHERE tenant_id = t.tenant_id AND workflow_id = v_workflow AND name = 'Accepted';
    SELECT id INTO v_stage_decl   FROM document_stages WHERE tenant_id = t.tenant_id AND workflow_id = v_workflow AND name = 'Declined';
    SELECT id INTO v_stage_exp    FROM document_stages WHERE tenant_id = t.tenant_id AND workflow_id = v_workflow AND name = 'Expired';

    -- (2) backfill each legacy quote not already migrated (idempotent via the
    --     metadata->>'legacyQuoteId' tag, so a re-run is a no-op).
    FOR q IN
      SELECT qq.* FROM quotes qq
      WHERE qq.tenant_id = t.tenant_id
        AND NOT EXISTS (
          SELECT 1 FROM billing_documents d
          WHERE d.tenant_id = t.tenant_id
            AND d.metadata->>'legacyQuoteId' = qq.id::text
        )
      ORDER BY qq.created_at
    LOOP
      v_target_stage := CASE q.status
                           WHEN 'draft'      THEN v_stage_draft
                           WHEN 'submitted'  THEN v_stage_subm
                           WHEN 'under_review' THEN v_stage_review
                           WHEN 'quoted'     THEN v_stage_quoted
                           WHEN 'accepted'   THEN v_stage_accept
                           WHEN 'converted'  THEN v_stage_accept
                           WHEN 'declined'   THEN v_stage_decl
                           WHEN 'expired'    THEN v_stage_exp
                           ELSE v_stage_draft
                         END;
      v_status := CASE WHEN q.status IN ('declined', 'expired') THEN 'void' ELSE 'unpaid' END;

      -- next stable per-tenant document sequence (matches nextBillingDocumentSeq).
      SELECT COALESCE(MAX(number_seq), 0) + 1 INTO v_seq
        FROM billing_documents WHERE tenant_id = t.tenant_id;

      INSERT INTO billing_documents (
        tenant_id, workflow_id, stage_id, customer_id, b2b_account_id, assigned_user_id,
        number, number_seq, currency, tax_rate,
        subtotal, discount_total, tax_total, shipping_total, surcharge_total,
        total, deposit_total, amount_paid, balance,
        status, due_at, paid_at, overdue_days,
        notes, customer_note, declined_reason, valid_until, finalized_at, voided_at,
        converted_at, created_by_user_id,
        metadata, created_at, updated_at
      ) VALUES (
        t.tenant_id, v_workflow, v_target_stage, q.customer_id, q.b2b_account_id, NULL,
        q.quote_number, v_seq, q.currency, 0,
        q.subtotal, q.discount_total, q.tax_total, q.shipping_total, 0,
        q.total, 0, 0, q.total,
        v_status, NULL, NULL, 0,
        q.internal_note, q.customer_note, q.declined_reason, q.valid_until,
        CASE WHEN q.status IN ('accepted', 'converted') THEN q.accepted_at ELSE NULL END,
        CASE WHEN q.status IN ('declined', 'expired') THEN COALESCE(q.declined_at, q.expired_at) ELSE NULL END,
        q.converted_at, q.created_by_user_id,
        jsonb_build_object(
          'source', 'quote_backfill',
          'legacyQuoteId', q.id::text,
          'legacyStatus', q.status,
          'paymentTerms', q.payment_terms,
          'submittedAt', q.submitted_at,
          'acceptedAt', q.accepted_at,
          'declinedAt', q.declined_at,
          'expiredAt', q.expired_at
        ),
        q.created_at, q.updated_at
      ) RETURNING id INTO v_doc;

      -- (4) mirror the conversion FK onto the order side too, for already-
      -- converted quotes — the real bidirectional relation replacing the old
      -- metadata/string-only pointer (Order.metadata.convertedFromQuoteId).
      IF q.converted_to_order_id IS NOT NULL THEN
        UPDATE orders SET converted_from_document_id = v_doc
          WHERE id = q.converted_to_order_id AND tenant_id = t.tenant_id;
      END IF;

      -- backfill lines, preserving cost_cents/applied_markup verbatim (identical
      -- reproducibility-snapshot shape on both models).
      FOR item IN SELECT * FROM quote_items WHERE quote_id = q.id ORDER BY created_at LOOP
        v_line_desc := COALESCE(NULLIF(item.name, ''), item.description, 'Line item');
        IF item.sku IS NOT NULL AND item.sku <> '' THEN
          v_line_desc := left(v_line_desc || ' (' || item.sku || ')', 500);
        END IF;

        INSERT INTO billing_document_lines (
          tenant_id, document_id, product_id, variant_id,
          description, quantity, unit_price,
          cost_cents, applied_markup,
          taxable, discount_amount, tax_amount, line_subtotal, line_total,
          sort_order, metadata, created_at, updated_at
        ) VALUES (
          t.tenant_id, v_doc, item.product_id, item.variant_id,
          v_line_desc, item.quantity, item.unit_price,
          item.cost_cents, item.applied_markup,
          true, item.discount_amount, item.tax_amount, item.line_subtotal, item.line_total,
          0, jsonb_build_object('sku', item.sku, 'legacyQuoteItemId', item.id::text),
          item.created_at, item.updated_at
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ── (3) backfill deal_quotes → deal_billing_documents, per tenant ─────────────
DO $$
DECLARE
  t RECORD;
  dq RECORD;
  v_doc uuid;
BEGIN
  FOR t IN SELECT DISTINCT tenant_id FROM deal_quotes LOOP
    PERFORM set_config('app.tenant_id', t.tenant_id::text, false);
    FOR dq IN SELECT * FROM deal_quotes WHERE tenant_id = t.tenant_id LOOP
      SELECT id INTO v_doc FROM billing_documents
        WHERE tenant_id = t.tenant_id AND metadata->>'legacyQuoteId' = dq.quote_id::text;
      IF v_doc IS NOT NULL THEN
        INSERT INTO deal_billing_documents (tenant_id, deal_id, document_id, created_at)
          VALUES (t.tenant_id, dq.deal_id, v_doc, dq.created_at)
          ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END $$;
