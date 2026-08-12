-- ══════════════════════════════════════════════════════════════════════════
-- Finance — the spend side (docs/148)
-- ══════════════════════════════════════════════════════════════════════════
--
-- Ten new tables, no alters, no backfill. Nothing here touches an existing row:
-- finance is a new module, modules default OFF, and its seeded categories are
-- written by the module INSTALL seam (per-tenant, at enable time) rather than by
-- this migration — which also keeps us clear of the FORCE-RLS backfill footgun
-- entirely (packages/db/CLAUDE.md).
--
-- The naming prefix is `finance_*`, except the rollup, which joins the existing
-- `rollup_*` family so the analytics worker's table sweep finds it.
--
-- Every table is tenant-scoped: ENABLE + FORCE RLS + the canonical
-- `tenant_isolation` policy on `current_tenant_id()`.

-- ══════════════════════════════════════════════════════════════════════════
-- 1. Categories — the owner's words for what money went on
-- ══════════════════════════════════════════════════════════════════════════
--
-- `kind` is the only accounting-shaped column in the module, and it is the
-- minimum needed to subtract in the right order: cost_of_sale hits GROSS profit,
-- labor + operating hit NET.

CREATE TABLE "finance_expense_categories" (
    "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"   UUID NOT NULL,
    "name"        VARCHAR(120) NOT NULL,
    "slug"        VARCHAR(60),
    "kind"        VARCHAR(20) NOT NULL DEFAULT 'operating',
    "color"       VARCHAR(7),
    "is_system"   BOOLEAN NOT NULL DEFAULT false,
    "export_code" VARCHAR(60),
    "sort_order"  INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMPTZ NOT NULL,

    CONSTRAINT "finance_expense_categories_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "finance_expense_categories"
  ADD CONSTRAINT "finance_expense_categories_kind_check" CHECK (
    "kind" IN ('cost_of_sale','labor','operating')
  );

ALTER TABLE "finance_expense_categories"
  ADD CONSTRAINT "finance_expense_categories_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;

-- Plain unique, NOT nulls-not-distinct: a tenant-invented category has a NULL slug
-- and any number of those must coexist. Only the seeded set is slug-addressable.
CREATE UNIQUE INDEX "finance_expense_categories_tenant_slug_unique"
  ON "finance_expense_categories" ("tenant_id", "slug");
CREATE INDEX "finance_expense_categories_tenant_id_archived_at_idx"
  ON "finance_expense_categories" ("tenant_id", "archived_at");

ALTER TABLE "finance_expense_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_expense_categories" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "finance_expense_categories"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 2. Vendors — who got paid
-- ══════════════════════════════════════════════════════════════════════════
--
-- `supplier_id` and `company_id` are deliberately FK-LESS plain uuids. Finance must
-- run with inventory and crm both off, and a hard FK would couple a standalone
-- finance tenant to modules it never bought. The service layer resolves them when
-- those modules are on.

CREATE TABLE "finance_vendors" (
    "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"     UUID NOT NULL,
    "name"          VARCHAR(200) NOT NULL,
    "supplier_id"   UUID,
    "company_id"    UUID,
    "email"         VARCHAR(255),
    "phone"         VARCHAR(40),
    "website"       TEXT,
    "address"       TEXT,
    "account_ref"   VARCHAR(120),
    "payment_terms" VARCHAR(20),
    "notes"         TEXT,
    "archived_at"   TIMESTAMPTZ,
    "created_at"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMPTZ NOT NULL,

    CONSTRAINT "finance_vendors_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "finance_vendors"
  ADD CONSTRAINT "finance_vendors_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;

CREATE INDEX "finance_vendors_tenant_id_archived_at_idx"
  ON "finance_vendors" ("tenant_id", "archived_at");
CREATE INDEX "finance_vendors_tenant_id_supplier_id_idx"
  ON "finance_vendors" ("tenant_id", "supplier_id");

ALTER TABLE "finance_vendors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_vendors" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "finance_vendors"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 3. The expense — the spine
-- ══════════════════════════════════════════════════════════════════════════
--
-- `amount_cents` is deliberately UNCONSTRAINED in sign. A vendor credit, a returned
-- tool, a corrected overcharge — all are negative spend, and forcing them positive
-- means inventing a second "credit" concept that every report then has to remember
-- to subtract. One signed column sums correctly with no cases.
--
-- Two dates, two different questions: `incurred_at` is the period the cost belongs
-- to and is what profit buckets on; `paid_at` is when the money left, and NULL means
-- it has not — an unpaid expense is a payable.

CREATE TABLE "finance_expenses" (
    "id"                         UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"                  UUID NOT NULL,
    "property_id"                UUID,
    "category_id"                UUID NOT NULL,
    "vendor_id"                  UUID,
    "description"                VARCHAR(300) NOT NULL,
    "source"                     VARCHAR(20) NOT NULL DEFAULT 'manual',
    "source_type"                VARCHAR(40),
    "source_id"                  VARCHAR(200),
    "amount_cents"               INTEGER NOT NULL,
    "currency"                   VARCHAR(3) NOT NULL DEFAULT 'USD',
    "fx_rate"                    DECIMAL(18,8),
    "base_currency_amount_cents" INTEGER,
    "tax_cents"                  INTEGER NOT NULL DEFAULT 0,
    "incurred_at"                TIMESTAMPTZ NOT NULL,
    "paid_at"                    TIMESTAMPTZ,
    "due_at"                     TIMESTAMPTZ,
    "payment_method"             VARCHAR(20),
    "reference"                  VARCHAR(120),
    "exported_at"                TIMESTAMPTZ,
    "external_ref"               VARCHAR(200),
    "notes"                      TEXT,
    "metadata"                   JSONB NOT NULL DEFAULT '{}',
    "created_at"                 TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"                 TIMESTAMPTZ NOT NULL,
    "deleted_at"                 TIMESTAMPTZ,

    CONSTRAINT "finance_expenses_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "finance_expenses"
  ADD CONSTRAINT "finance_expenses_source_check" CHECK (
    "source" IN ('manual','recurring','imported','labor','sparx_bill','api')
  );

ALTER TABLE "finance_expenses"
  ADD CONSTRAINT "finance_expenses_payment_method_check" CHECK (
    "payment_method" IS NULL OR "payment_method" IN ('card','bank','cash','check','other')
  );

-- A derived row must carry BOTH halves of its provenance or neither — a source_type
-- with no source_id cannot be matched on the next run, which silently turns an
-- idempotent deriver into one that duplicates.
ALTER TABLE "finance_expenses"
  ADD CONSTRAINT "finance_expenses_source_pair_check" CHECK (
    ("source_type" IS NULL) = ("source_id" IS NULL)
  );

ALTER TABLE "finance_expenses"
  ADD CONSTRAINT "finance_expenses_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
ALTER TABLE "finance_expenses"
  ADD CONSTRAINT "finance_expenses_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;
-- RESTRICT: deleting a category that still has spend against it would silently
-- rewrite history. The UI archives, and offers to re-file first.
ALTER TABLE "finance_expenses"
  ADD CONSTRAINT "finance_expenses_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "finance_expense_categories"("id") ON DELETE RESTRICT;
ALTER TABLE "finance_expenses"
  ADD CONSTRAINT "finance_expenses_vendor_id_fkey"
  FOREIGN KEY ("vendor_id") REFERENCES "finance_vendors"("id") ON DELETE SET NULL;

-- The idempotency key for every deriver and importer. Plain unique (NULLs distinct)
-- so unlimited hand-typed rows coexist while a given (source_type, source_id) can
-- only ever produce one expense per tenant.
CREATE UNIQUE INDEX "finance_expenses_tenant_source_unique"
  ON "finance_expenses" ("tenant_id", "source_type", "source_id");

CREATE INDEX "finance_expenses_tenant_id_incurred_at_idx"
  ON "finance_expenses" ("tenant_id", "incurred_at");
CREATE INDEX "finance_expenses_tenant_id_property_id_incurred_at_idx"
  ON "finance_expenses" ("tenant_id", "property_id", "incurred_at");
CREATE INDEX "finance_expenses_tenant_id_category_id_incurred_at_idx"
  ON "finance_expenses" ("tenant_id", "category_id", "incurred_at");
CREATE INDEX "finance_expenses_tenant_id_vendor_id_idx"
  ON "finance_expenses" ("tenant_id", "vendor_id");
-- "What have I not paid yet" — the payables mirror of the receivables surface.
CREATE INDEX "finance_expenses_tenant_id_paid_at_due_at_idx"
  ON "finance_expenses" ("tenant_id", "paid_at", "due_at");
CREATE INDEX "finance_expenses_tenant_id_exported_at_idx"
  ON "finance_expenses" ("tenant_id", "exported_at");

ALTER TABLE "finance_expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_expenses" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "finance_expenses"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 4. Allocation — which job the money was for
-- ══════════════════════════════════════════════════════════════════════════
--
-- FK-less target on purpose: an allocation must outlive the record it points at.
-- Deleting last year's order should not silently rewrite last year's profit, so the
-- row carries a denormalized label the UI can still render afterwards.
--
-- The unallocated remainder (expense − Σ allocations) is OVERHEAD, and that is a real
-- answer, not a gap. No constraint forces allocations to sum to the expense.

CREATE TABLE "finance_expense_allocations" (
    "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"    UUID NOT NULL,
    "expense_id"   UUID NOT NULL,
    "target_type"  VARCHAR(20) NOT NULL,
    "target_id"    UUID NOT NULL,
    "target_label" VARCHAR(200),
    "amount_cents" INTEGER NOT NULL,
    "created_at"   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMPTZ NOT NULL,

    CONSTRAINT "finance_expense_allocations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "finance_expense_allocations"
  ADD CONSTRAINT "finance_expense_allocations_target_type_check" CHECK (
    "target_type" IN ('order','booking','customer','product','site')
  );

ALTER TABLE "finance_expense_allocations"
  ADD CONSTRAINT "finance_expense_allocations_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
ALTER TABLE "finance_expense_allocations"
  ADD CONSTRAINT "finance_expense_allocations_expense_id_fkey"
  FOREIGN KEY ("expense_id") REFERENCES "finance_expenses"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX "finance_expense_allocations_expense_target_unique"
  ON "finance_expense_allocations" ("expense_id", "target_type", "target_id");
CREATE INDEX "finance_expense_allocations_tenant_target_idx"
  ON "finance_expense_allocations" ("tenant_id", "target_type", "target_id");

ALTER TABLE "finance_expense_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_expense_allocations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "finance_expense_allocations"
  USING ("tenant_id" = current_tenant_id());

-- The receipt. Plural: a bill and its proof of payment are two files, and an owner
-- being audited wants both on the same row.

CREATE TABLE "finance_expense_attachments" (
    "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"  UUID NOT NULL,
    "expense_id" UUID NOT NULL,
    "asset_id"   UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_expense_attachments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "finance_expense_attachments"
  ADD CONSTRAINT "finance_expense_attachments_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
ALTER TABLE "finance_expense_attachments"
  ADD CONSTRAINT "finance_expense_attachments_expense_id_fkey"
  FOREIGN KEY ("expense_id") REFERENCES "finance_expenses"("id") ON DELETE CASCADE;
ALTER TABLE "finance_expense_attachments"
  ADD CONSTRAINT "finance_expense_attachments_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX "finance_expense_attachments_expense_asset_unique"
  ON "finance_expense_attachments" ("expense_id", "asset_id");
CREATE INDEX "finance_expense_attachments_tenant_id_expense_id_idx"
  ON "finance_expense_attachments" ("tenant_id", "expense_id");

ALTER TABLE "finance_expense_attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_expense_attachments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "finance_expense_attachments"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 5. Recurring — the costs you already know are coming
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE "finance_recurring_expenses" (
    "id"                UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"         UUID NOT NULL,
    "property_id"       UUID,
    "name"              VARCHAR(200) NOT NULL,
    "category_id"       UUID NOT NULL,
    "vendor_id"         UUID,
    "amount_cents"      INTEGER NOT NULL,
    "currency"          VARCHAR(3) NOT NULL DEFAULT 'USD',
    "cadence"           VARCHAR(20) NOT NULL,
    "day_of_month"      INTEGER,
    "starts_on"         DATE NOT NULL,
    "ends_on"           DATE,
    "next_run_on"       DATE,
    "last_generated_on" DATE,
    "auto_generate"     BOOLEAN NOT NULL DEFAULT true,
    "is_active"         BOOLEAN NOT NULL DEFAULT true,
    "notes"             TEXT,
    "created_at"        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMPTZ NOT NULL,

    CONSTRAINT "finance_recurring_expenses_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "finance_recurring_expenses"
  ADD CONSTRAINT "finance_recurring_expenses_cadence_check" CHECK (
    "cadence" IN ('weekly','biweekly','monthly','quarterly','annual')
  );

ALTER TABLE "finance_recurring_expenses"
  ADD CONSTRAINT "finance_recurring_expenses_day_of_month_check" CHECK (
    "day_of_month" IS NULL OR ("day_of_month" BETWEEN 1 AND 31)
  );

ALTER TABLE "finance_recurring_expenses"
  ADD CONSTRAINT "finance_recurring_expenses_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
ALTER TABLE "finance_recurring_expenses"
  ADD CONSTRAINT "finance_recurring_expenses_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;
ALTER TABLE "finance_recurring_expenses"
  ADD CONSTRAINT "finance_recurring_expenses_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "finance_expense_categories"("id") ON DELETE RESTRICT;
ALTER TABLE "finance_recurring_expenses"
  ADD CONSTRAINT "finance_recurring_expenses_vendor_id_fkey"
  FOREIGN KEY ("vendor_id") REFERENCES "finance_vendors"("id") ON DELETE SET NULL;

CREATE INDEX "finance_recurring_expenses_tenant_active_next_run_idx"
  ON "finance_recurring_expenses" ("tenant_id", "is_active", "next_run_on");

ALTER TABLE "finance_recurring_expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_recurring_expenses" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "finance_recurring_expenses"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 6. Accounting connections — the handoff to QuickBooks / Xero / Sage 50
-- ══════════════════════════════════════════════════════════════════════════
--
-- sparx does not keep the books. This is the seam where the numbers leave for the
-- system that does, and it is per-SITE because a bookkeeper for one business has no
-- business seeing another's ledger.
--
-- Tokens are the tenant's own OAuth grant, AES-256-GCM ciphertext, never plaintext,
-- never a platform-level credential — same contract as SocialConnection.

CREATE TABLE "finance_accounting_connections" (
    "id"                UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"         UUID NOT NULL,
    "property_id"       UUID,
    "provider"          VARCHAR(40) NOT NULL,
    "status"            VARCHAR(20) NOT NULL DEFAULT 'active',
    "external_id"       VARCHAR(255),
    "display_name"      VARCHAR(255),
    "access_token_enc"  TEXT,
    "refresh_token_enc" TEXT,
    "token_expires_at"  TIMESTAMPTZ,
    "scopes"            VARCHAR(120)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(120)[],
    "sync_expenses"     BOOLEAN NOT NULL DEFAULT true,
    "sync_invoices"     BOOLEAN NOT NULL DEFAULT true,
    "sync_payments"     BOOLEAN NOT NULL DEFAULT true,
    "sync_cadence"      VARCHAR(20) NOT NULL DEFAULT 'manual',
    "sync_from_date"    DATE,
    "last_sync_at"      TIMESTAMPTZ,
    "last_sync_status"  VARCHAR(20),
    "last_error"        JSONB,
    "settings"          JSONB NOT NULL DEFAULT '{}',
    "created_at"        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMPTZ NOT NULL,

    CONSTRAINT "finance_accounting_connections_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "finance_accounting_connections"
  ADD CONSTRAINT "finance_accounting_connections_provider_check" CHECK (
    "provider" IN ('quickbooks_online','quickbooks_desktop','xero','sage50','freshbooks','wave','csv')
  );

ALTER TABLE "finance_accounting_connections"
  ADD CONSTRAINT "finance_accounting_connections_status_check" CHECK (
    "status" IN ('active','expired','revoked','error')
  );

ALTER TABLE "finance_accounting_connections"
  ADD CONSTRAINT "finance_accounting_connections_sync_cadence_check" CHECK (
    "sync_cadence" IN ('manual','daily','weekly')
  );

ALTER TABLE "finance_accounting_connections"
  ADD CONSTRAINT "finance_accounting_connections_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
ALTER TABLE "finance_accounting_connections"
  ADD CONSTRAINT "finance_accounting_connections_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;

-- NULLS NOT DISTINCT: without it, unlimited (tenant, NULL, 'xero') rows coexist and
-- a tenant-wide connection can be created twice. Same hand-edit as SocialConnection.
CREATE UNIQUE INDEX "finance_accounting_connections_tenant_property_provider_unique"
  ON "finance_accounting_connections" ("tenant_id", "property_id", "provider")
  NULLS NOT DISTINCT;
CREATE INDEX "finance_accounting_connections_tenant_id_status_idx"
  ON "finance_accounting_connections" ("tenant_id", "status");

ALTER TABLE "finance_accounting_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_accounting_connections" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "finance_accounting_connections"
  USING ("tenant_id" = current_tenant_id());

-- The translation table between sparx's vocabulary and the accountant's. Loosely
-- keyed (sparx_type + sparx_id) because the mappable set grows — categories today,
-- tax rates and payment methods next — and a column per concept means a migration
-- every time the accountant asks for one more.

CREATE TABLE "finance_accounting_mappings" (
    "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"     UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "sparx_type"    VARCHAR(30) NOT NULL,
    "sparx_id"      VARCHAR(200) NOT NULL,
    "category_id"   UUID,
    "external_id"   VARCHAR(200) NOT NULL,
    "external_name" VARCHAR(255),
    "external_code" VARCHAR(60),
    "created_at"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMPTZ NOT NULL,

    CONSTRAINT "finance_accounting_mappings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "finance_accounting_mappings"
  ADD CONSTRAINT "finance_accounting_mappings_sparx_type_check" CHECK (
    "sparx_type" IN ('expense_category','tax_rate','payment_method','income_account','vendor')
  );

ALTER TABLE "finance_accounting_mappings"
  ADD CONSTRAINT "finance_accounting_mappings_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
ALTER TABLE "finance_accounting_mappings"
  ADD CONSTRAINT "finance_accounting_mappings_connection_id_fkey"
  FOREIGN KEY ("connection_id") REFERENCES "finance_accounting_connections"("id") ON DELETE CASCADE;
ALTER TABLE "finance_accounting_mappings"
  ADD CONSTRAINT "finance_accounting_mappings_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "finance_expense_categories"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX "finance_accounting_mappings_connection_sparx_unique"
  ON "finance_accounting_mappings" ("connection_id", "sparx_type", "sparx_id");
CREATE INDEX "finance_accounting_mappings_tenant_id_connection_id_idx"
  ON "finance_accounting_mappings" ("tenant_id", "connection_id");

ALTER TABLE "finance_accounting_mappings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_accounting_mappings" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "finance_accounting_mappings"
  USING ("tenant_id" = current_tenant_id());

-- What happened last time we talked to their accounting system. Rows rather than a
-- blob because the failure that matters is the 3 expenses out of 140 that bounced,
-- and the owner needs to see WHICH three — hence `partial` as a real status.

CREATE TABLE "finance_accounting_sync_runs" (
    "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"       UUID NOT NULL,
    "connection_id"   UUID NOT NULL,
    "direction"       VARCHAR(10) NOT NULL,
    "status"          VARCHAR(20) NOT NULL DEFAULT 'running',
    "scope"           VARCHAR(20) NOT NULL,
    "trigger"         VARCHAR(20) NOT NULL DEFAULT 'manual',
    "period_start"    DATE,
    "period_end"      DATE,
    "records_total"   INTEGER NOT NULL DEFAULT 0,
    "records_synced"  INTEGER NOT NULL DEFAULT 0,
    "records_skipped" INTEGER NOT NULL DEFAULT 0,
    "records_failed"  INTEGER NOT NULL DEFAULT 0,
    "failures"        JSONB,
    "started_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at"     TIMESTAMPTZ,

    CONSTRAINT "finance_accounting_sync_runs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "finance_accounting_sync_runs"
  ADD CONSTRAINT "finance_accounting_sync_runs_direction_check" CHECK (
    "direction" IN ('export','import')
  );

ALTER TABLE "finance_accounting_sync_runs"
  ADD CONSTRAINT "finance_accounting_sync_runs_status_check" CHECK (
    "status" IN ('running','success','partial','failed')
  );

ALTER TABLE "finance_accounting_sync_runs"
  ADD CONSTRAINT "finance_accounting_sync_runs_scope_check" CHECK (
    "scope" IN ('expenses','invoices','payments','accounts','vendors')
  );

ALTER TABLE "finance_accounting_sync_runs"
  ADD CONSTRAINT "finance_accounting_sync_runs_trigger_check" CHECK (
    "trigger" IN ('manual','scheduled','event')
  );

ALTER TABLE "finance_accounting_sync_runs"
  ADD CONSTRAINT "finance_accounting_sync_runs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
ALTER TABLE "finance_accounting_sync_runs"
  ADD CONSTRAINT "finance_accounting_sync_runs_connection_id_fkey"
  FOREIGN KEY ("connection_id") REFERENCES "finance_accounting_connections"("id") ON DELETE CASCADE;

CREATE INDEX "finance_accounting_sync_runs_tenant_connection_started_idx"
  ON "finance_accounting_sync_runs" ("tenant_id", "connection_id", "started_at");

ALTER TABLE "finance_accounting_sync_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_accounting_sync_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "finance_accounting_sync_runs"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 7. The rollup — the one number the module exists to produce
-- ══════════════════════════════════════════════════════════════════════════
--
-- A cache of a subtraction, safe to truncate and recompute. `cogs_cents` and
-- `fee_cents` are COPIED here but OWNED by the inventory + payment tables; nothing
-- reads a profit figure from here without the option to recompute from source.
--
-- Surrogate PK + NULLS NOT DISTINCT grain, matching RollupCommerceDailyRevenue: the
-- natural key contains a nullable property, which an @@id cannot.

CREATE TABLE "rollup_finance_daily_profit" (
    "id"                 UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"          UUID NOT NULL,
    "property_id"        UUID,
    "bucket"             DATE NOT NULL,
    "revenue_cents"      BIGINT NOT NULL DEFAULT 0,
    "cogs_cents"         BIGINT NOT NULL DEFAULT 0,
    "fee_cents"          BIGINT NOT NULL DEFAULT 0,
    "labor_cents"        BIGINT NOT NULL DEFAULT 0,
    "cost_of_sale_cents" BIGINT NOT NULL DEFAULT 0,
    "operating_cents"    BIGINT NOT NULL DEFAULT 0,
    "gross_profit_cents" BIGINT NOT NULL DEFAULT 0,
    "net_profit_cents"   BIGINT NOT NULL DEFAULT 0,
    "unallocated_cents"  BIGINT NOT NULL DEFAULT 0,
    "computed_at"        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"         TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rollup_finance_daily_profit_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "rollup_finance_daily_profit"
  ADD CONSTRAINT "rollup_finance_daily_profit_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
-- Cascade (not SetNull): deleting a site drops its rollup rows and the nightly
-- reconcile re-buckets that site's now-orphaned sources into the null bucket.
-- SetNull would instead collide the row onto the existing null bucket under the
-- NULLS NOT DISTINCT unique.
ALTER TABLE "rollup_finance_daily_profit"
  ADD CONSTRAINT "rollup_finance_daily_profit_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX "rollup_finance_daily_profit_grain"
  ON "rollup_finance_daily_profit" ("tenant_id", "property_id", "bucket")
  NULLS NOT DISTINCT;
CREATE INDEX "rollup_finance_daily_profit_tenant_id_bucket_idx"
  ON "rollup_finance_daily_profit" ("tenant_id", "bucket");

ALTER TABLE "rollup_finance_daily_profit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rollup_finance_daily_profit" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "rollup_finance_daily_profit"
  USING ("tenant_id" = current_tenant_id());
