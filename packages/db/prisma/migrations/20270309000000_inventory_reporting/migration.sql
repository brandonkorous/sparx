-- Inventory reporting, portability and the accounting handoff (docs/146 Phase 10).
--
-- Four tables and nothing else. No report is stored: a report is computed from
-- the ledger when it is asked for, and a stored one is a number that was true
-- once. What IS stored is the four things a computation cannot recover — the
-- standing instruction to send a report, the evidence that it went, what the
-- tenant's ACCOUNTANT says the stock is worth (sparx keeps no ledger and so
-- cannot derive it), and what each uploaded file did to the stock.

-- ─────────────────────────────────────────────────────────────────────────────
-- 10.4 — Scheduled report delivery
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "inventory_report_schedules" (
  "id"                   UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"            UUID         NOT NULL,
  "report_key"           VARCHAR(40)  NOT NULL,
  "name"                 VARCHAR(120) NOT NULL,
  "cadence"              VARCHAR(20)  NOT NULL,
  "day_of_week"          INTEGER,
  "day_of_month"         INTEGER,
  "hour"                 INTEGER      NOT NULL DEFAULT 7,
  "timezone"             VARCHAR(64)  NOT NULL DEFAULT 'UTC',
  "recipients"           VARCHAR(320)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(320)[],
  "format"               VARCHAR(20)  NOT NULL DEFAULT 'csv',
  "filters"              JSONB        NOT NULL DEFAULT '{}',
  "is_active"            BOOLEAN      NOT NULL DEFAULT true,
  "next_run_at"          TIMESTAMPTZ,
  "last_run_at"          TIMESTAMPTZ,
  "last_run_status"      VARCHAR(20),
  "consecutive_failures" INTEGER      NOT NULL DEFAULT 0,
  "created_by"           UUID,
  "created_at"           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"           TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_report_schedules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_report_schedules_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,

  CONSTRAINT "inventory_report_schedules_cadence_check"
    CHECK ("cadence" IN ('daily', 'weekly', 'monthly')),
  CONSTRAINT "inventory_report_schedules_format_check"
    CHECK ("format" IN ('csv', 'summary')),
  CONSTRAINT "inventory_report_schedules_hour_check"
    CHECK ("hour" BETWEEN 0 AND 23),
  CONSTRAINT "inventory_report_schedules_day_of_week_check"
    CHECK ("day_of_week" IS NULL OR "day_of_week" BETWEEN 0 AND 6),
  -- 1–28, not 1–31. A monthly report set to the 31st skips February, and a
  -- schedule that silently misses a month is the failure a schedule exists to
  -- prevent. Enforced here as well as in the input schema because a row written
  -- by a future importer must not be able to break it either.
  CONSTRAINT "inventory_report_schedules_day_of_month_check"
    CHECK ("day_of_month" IS NULL OR "day_of_month" BETWEEN 1 AND 28),
  -- A weekly schedule needs its day; a monthly one needs its date. Without this
  -- the cadence falls back to a default and the report arrives on a day nobody
  -- chose, which reads as a bug in the report rather than a gap in the setup.
  CONSTRAINT "inventory_report_schedules_cadence_day_check"
    CHECK (
      ("cadence" <> 'weekly'  OR "day_of_week"  IS NOT NULL) AND
      ("cadence" <> 'monthly' OR "day_of_month" IS NOT NULL)
    ),
  -- A schedule with nobody to send to is not a schedule.
  CONSTRAINT "inventory_report_schedules_recipients_check"
    CHECK (array_length("recipients", 1) >= 1),
  CONSTRAINT "inventory_report_schedules_last_status_check"
    CHECK ("last_run_status" IS NULL OR "last_run_status" IN ('success', 'partial', 'failed', 'skipped'))
);

CREATE INDEX "inventory_report_schedules_due_idx"
  ON "inventory_report_schedules" ("tenant_id", "is_active", "next_run_at");
CREATE INDEX "inventory_report_schedules_report_idx"
  ON "inventory_report_schedules" ("tenant_id", "report_key");

ALTER TABLE "inventory_report_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_report_schedules" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "inventory_report_schedules"
  USING ("tenant_id" = current_tenant_id());

CREATE TABLE "inventory_report_deliveries" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"    UUID        NOT NULL,
  "schedule_id"  UUID        NOT NULL,
  "status"       VARCHAR(20) NOT NULL,
  "trigger"      VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  "recipients"   VARCHAR(320)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(320)[],
  "row_count"    INTEGER,
  "period_start" TIMESTAMPTZ,
  "period_end"   TIMESTAMPTZ,
  "error"        TEXT,
  "sent_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_report_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_report_deliveries_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_report_deliveries_schedule_fkey"
    FOREIGN KEY ("schedule_id") REFERENCES "inventory_report_schedules"("id") ON DELETE CASCADE,

  CONSTRAINT "inventory_report_deliveries_status_check"
    CHECK ("status" IN ('success', 'partial', 'failed', 'skipped')),
  CONSTRAINT "inventory_report_deliveries_trigger_check"
    CHECK ("trigger" IN ('scheduled', 'manual')),
  -- A failure explains itself. A delivery that failed with no reason recorded is
  -- a support ticket that cannot be answered.
  CONSTRAINT "inventory_report_deliveries_error_check"
    CHECK ("status" <> 'failed' OR "error" IS NOT NULL)
);

CREATE INDEX "inventory_report_deliveries_history_idx"
  ON "inventory_report_deliveries" ("tenant_id", "schedule_id", "sent_at" DESC);

ALTER TABLE "inventory_report_deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_report_deliveries" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "inventory_report_deliveries"
  USING ("tenant_id" = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- 10.9 — What the accountant says the stock is worth
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "inventory_gl_snapshots" (
  "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"     UUID         NOT NULL,
  "as_of"         DATE         NOT NULL,
  "account_name"  VARCHAR(200) NOT NULL,
  "account_code"  VARCHAR(60),
  "balance_cents" INTEGER      NOT NULL,
  "currency"      VARCHAR(3)   NOT NULL DEFAULT 'USD',
  "source"        VARCHAR(40)  NOT NULL DEFAULT 'manual',
  "connection_id" UUID,
  "captured_by"   UUID,
  "note"          TEXT,
  "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_gl_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_gl_snapshots_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_gl_snapshots_connection_fkey"
    FOREIGN KEY ("connection_id") REFERENCES "finance_accounting_connections"("id") ON DELETE SET NULL,

  CONSTRAINT "inventory_gl_snapshots_source_check"
    CHECK ("source" IN ('manual', 'quickbooks_online', 'xero')),
  -- An imported figure names the connection it came from. Provenance is the
  -- whole difference between "your accountant told us" and "we read it".
  CONSTRAINT "inventory_gl_snapshots_import_provenance_check"
    CHECK ("source" = 'manual' OR "connection_id" IS NOT NULL)
);

CREATE UNIQUE INDEX "inventory_gl_snapshots_account_date_unique"
  ON "inventory_gl_snapshots" ("tenant_id", "as_of", "account_name");
CREATE INDEX "inventory_gl_snapshots_recent_idx"
  ON "inventory_gl_snapshots" ("tenant_id", "as_of" DESC);

ALTER TABLE "inventory_gl_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_gl_snapshots" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "inventory_gl_snapshots"
  USING ("tenant_id" = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- 10.5 — What a file did to the stock
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "inventory_import_batches" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"      UUID         NOT NULL,
  "kind"           VARCHAR(30)  NOT NULL DEFAULT 'adjustment',
  "status"         VARCHAR(20)  NOT NULL DEFAULT 'planned',
  "filename"       VARCHAR(255),
  "warehouse_id"   UUID,
  "reason"         VARCHAR(20)  NOT NULL DEFAULT 'manual',
  "rows_total"     INTEGER      NOT NULL DEFAULT 0,
  "rows_to_apply"  INTEGER      NOT NULL DEFAULT 0,
  "rows_no_change" INTEGER      NOT NULL DEFAULT 0,
  "rows_invalid"   INTEGER      NOT NULL DEFAULT 0,
  "units_changed"  INTEGER      NOT NULL DEFAULT 0,
  "plan"           JSONB        NOT NULL DEFAULT '[]',
  "rows_applied"   INTEGER      NOT NULL DEFAULT 0,
  "reversed_at"    TIMESTAMPTZ,
  "reversed_by"    UUID,
  "error"          TEXT,
  "created_by"     UUID,
  "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "applied_at"     TIMESTAMPTZ,
  "updated_at"     TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_import_batches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_import_batches_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_import_batches_warehouse_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses"("id") ON DELETE SET NULL,

  CONSTRAINT "inventory_import_batches_status_check"
    CHECK ("status" IN ('planned', 'applied', 'discarded', 'failed')),
  CONSTRAINT "inventory_import_batches_kind_check"
    CHECK ("kind" IN ('adjustment')),
  -- An applied batch is stamped. Without this a batch could report rows posted
  -- with no time they were posted at, and the ledger entries it wrote would have
  -- no anchor to reconcile against.
  CONSTRAINT "inventory_import_batches_applied_check"
    CHECK ("status" <> 'applied' OR "applied_at" IS NOT NULL),
  -- Reversal is a pair: the moment and the person. Half of it is a record
  -- nobody can act on.
  CONSTRAINT "inventory_import_batches_reversal_check"
    CHECK (("reversed_at" IS NULL) = ("reversed_by" IS NULL)),
  -- Only something that was actually posted can be reversed.
  CONSTRAINT "inventory_import_batches_reversal_status_check"
    CHECK ("reversed_at" IS NULL OR "status" = 'applied')
);

CREATE INDEX "inventory_import_batches_recent_idx"
  ON "inventory_import_batches" ("tenant_id", "status", "created_at" DESC);

ALTER TABLE "inventory_import_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_import_batches" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "inventory_import_batches"
  USING ("tenant_id" = current_tenant_id());
