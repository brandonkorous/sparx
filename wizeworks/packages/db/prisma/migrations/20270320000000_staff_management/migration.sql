-- ══════════════════════════════════════════════════════════════════════════
-- Staff management (docs/149)
-- ══════════════════════════════════════════════════════════════════════════
--
-- Nine new tables, no alters, no backfill. Nothing here touches an existing row:
-- `staff` is a new module, modules default OFF, and the module has no seeded
-- content of its own — which keeps this migration clear of the FORCE-RLS backfill
-- footgun entirely (packages/db/CLAUDE.md).
--
-- The links out to `users` and `scheduling_resources` are deliberately FK-LESS
-- plain uuid columns. A hard FK would couple a standalone staff tenant to auth
-- internals and to a scheduling module it never bought; the service layer resolves
-- them only when those modules are on. Same reasoning as finance_vendors' links to
-- suppliers and companies.
--
-- Every table is tenant-scoped: ENABLE + FORCE RLS + the canonical
-- `tenant_isolation` policy on `current_tenant_id()`.

-- ══════════════════════════════════════════════════════════════════════════
-- 1. The person
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE "staff_members" (
    "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"           UUID NOT NULL,
    "first_name"          VARCHAR(120) NOT NULL,
    "last_name"           VARCHAR(120),
    "email"               VARCHAR(255),
    "phone"               VARCHAR(40),
    "job_title"           VARCHAR(120),
    "employment_type"     VARCHAR(20) NOT NULL DEFAULT 'employee',
    "status"              VARCHAR(20) NOT NULL DEFAULT 'active',
    "started_on"          DATE,
    "ended_on"            DATE,
    "user_id"             UUID,
    "resource_id"         UUID,
    "external_payroll_id" VARCHAR(120),
    "color"               VARCHAR(7),
    "photo_url"           TEXT,
    "notes"               TEXT,
    "created_at"          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMPTZ NOT NULL,
    "archived_at"         TIMESTAMPTZ,

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

-- `employment_type` is a COST-REPORTING distinction and never an employment-law
-- determination — sparx does not decide who is a contractor and files nothing on
-- the answer.
ALTER TABLE "staff_members"
  ADD CONSTRAINT "staff_members_employment_type_check" CHECK (
    "employment_type" IN ('employee','contractor','volunteer')
  );

ALTER TABLE "staff_members"
  ADD CONSTRAINT "staff_members_status_check" CHECK (
    "status" IN ('active','onboarding','suspended','former')
  );

ALTER TABLE "staff_members"
  ADD CONSTRAINT "staff_members_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;

-- Plain uniques, NOT nulls-not-distinct, and that is load-bearing. Most staff have
-- neither link, so both columns are usually NULL; under Postgres' default semantics
-- NULL is distinct from NULL, so any number of unlinked people coexist while a
-- second record claiming the same login is rejected. NULLS NOT DISTINCT here would
-- cap a tenant at exactly one staff member without a login.
CREATE UNIQUE INDEX "staff_members_tenant_user_unique"
  ON "staff_members" ("tenant_id", "user_id");
CREATE UNIQUE INDEX "staff_members_tenant_resource_unique"
  ON "staff_members" ("tenant_id", "resource_id");

CREATE INDEX "staff_members_tenant_id_status_last_name_idx"
  ON "staff_members" ("tenant_id", "status", "last_name");
CREATE INDEX "staff_members_tenant_id_archived_at_idx"
  ON "staff_members" ("tenant_id", "archived_at");

ALTER TABLE "staff_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_members" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "staff_members"
  USING ("tenant_id" = current_tenant_id());

-- ── Which businesses they work for ────────────────────────────────────────

CREATE TABLE "staff_member_sites" (
    "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"       UUID NOT NULL,
    "staff_member_id" UUID NOT NULL,
    "property_id"     UUID NOT NULL,
    "is_primary"      BOOLEAN NOT NULL DEFAULT false,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_member_sites_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "staff_member_sites"
  ADD CONSTRAINT "staff_member_sites_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
ALTER TABLE "staff_member_sites"
  ADD CONSTRAINT "staff_member_sites_staff_member_id_fkey"
  FOREIGN KEY ("staff_member_id") REFERENCES "staff_members"("id") ON DELETE CASCADE;
ALTER TABLE "staff_member_sites"
  ADD CONSTRAINT "staff_member_sites_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX "staff_member_sites_member_property_unique"
  ON "staff_member_sites" ("staff_member_id", "property_id");
CREATE INDEX "staff_member_sites_tenant_id_property_id_idx"
  ON "staff_member_sites" ("tenant_id", "property_id");

ALTER TABLE "staff_member_sites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_member_sites" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "staff_member_sites"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 2. What they cost — effective-dated, so history cannot move
-- ══════════════════════════════════════════════════════════════════════════
--
-- A rate stored as a column on the person rewrites the cost of every job they ever
-- worked the moment someone gets a raise. The window is what stops last quarter's
-- profit changing because of this quarter's pay review.

CREATE TABLE "staff_pay_rates" (
    "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"       UUID NOT NULL,
    "staff_member_id" UUID NOT NULL,
    "basis"           VARCHAR(20) NOT NULL DEFAULT 'hourly',
    "amount_cents"    INTEGER NOT NULL,
    "currency"        VARCHAR(3) NOT NULL DEFAULT 'USD',
    "burden_percent"  DECIMAL(5,2) NOT NULL DEFAULT 0,
    "effective_from"  DATE NOT NULL,
    "effective_to"    DATE,
    "note"            TEXT,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMPTZ NOT NULL,

    CONSTRAINT "staff_pay_rates_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "staff_pay_rates"
  ADD CONSTRAINT "staff_pay_rates_basis_check" CHECK (
    "basis" IN ('hourly','salary','commission','none')
  );

-- A rate cannot be negative, and `none` cannot carry one. Without the second half,
-- a volunteer switched to `none` keeps whatever figure was typed before, and the
-- deriver's basis check becomes the only thing standing between that stale number
-- and the ledger.
ALTER TABLE "staff_pay_rates"
  ADD CONSTRAINT "staff_pay_rates_amount_check" CHECK (
    "amount_cents" >= 0 AND ("basis" <> 'none' OR "amount_cents" = 0)
  );

ALTER TABLE "staff_pay_rates"
  ADD CONSTRAINT "staff_pay_rates_burden_check" CHECK (
    "burden_percent" >= 0 AND "burden_percent" <= 200
  );

-- An open-ended window is `effective_to IS NULL`; a closed one must not end before
-- it starts. A same-day window (from = to) is legal — someone hired and re-rated
-- on their first day is rare but real.
ALTER TABLE "staff_pay_rates"
  ADD CONSTRAINT "staff_pay_rates_window_check" CHECK (
    "effective_to" IS NULL OR "effective_to" >= "effective_from"
  );

ALTER TABLE "staff_pay_rates"
  ADD CONSTRAINT "staff_pay_rates_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
ALTER TABLE "staff_pay_rates"
  ADD CONSTRAINT "staff_pay_rates_staff_member_id_fkey"
  FOREIGN KEY ("staff_member_id") REFERENCES "staff_members"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX "staff_pay_rates_member_effective_from_unique"
  ON "staff_pay_rates" ("staff_member_id", "effective_from");
CREATE INDEX "staff_pay_rates_tenant_id_staff_member_id_effective_from_idx"
  ON "staff_pay_rates" ("tenant_id", "staff_member_id", "effective_from");

ALTER TABLE "staff_pay_rates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_pay_rates" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "staff_pay_rates"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 3. Time — what actually happened
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE "staff_time_entries" (
    "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"       UUID NOT NULL,
    "staff_member_id" UUID NOT NULL,
    "property_id"     UUID,
    "worked_on"       DATE NOT NULL,
    "started_at"      TIMESTAMPTZ,
    "ended_at"        TIMESTAMPTZ,
    "minutes"         INTEGER NOT NULL DEFAULT 0,
    "break_minutes"   INTEGER NOT NULL DEFAULT 0,
    "job_type"        VARCHAR(20),
    "job_id"          UUID,
    "source"          VARCHAR(20) NOT NULL DEFAULT 'manual',
    "status"          VARCHAR(20) NOT NULL DEFAULT 'open',
    "approved_at"     TIMESTAMPTZ,
    "approved_by"     UUID,
    "note"            TEXT,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMPTZ NOT NULL,

    CONSTRAINT "staff_time_entries_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "staff_time_entries"
  ADD CONSTRAINT "staff_time_entries_source_check" CHECK (
    "source" IN ('clock','manual','import')
  );

ALTER TABLE "staff_time_entries"
  ADD CONSTRAINT "staff_time_entries_status_check" CHECK (
    "status" IN ('open','submitted','approved','rejected')
  );

-- Same allocation vocabulary finance uses, narrowed to the two things a person can
-- actually work ON. Both halves are set together or neither is — a job id with no
-- type cannot be resolved, and a type with no id is a label pretending to be a link.
ALTER TABLE "staff_time_entries"
  ADD CONSTRAINT "staff_time_entries_job_check" CHECK (
    ("job_type" IS NULL AND "job_id" IS NULL)
    OR ("job_type" IN ('order','booking') AND "job_id" IS NOT NULL)
  );

ALTER TABLE "staff_time_entries"
  ADD CONSTRAINT "staff_time_entries_minutes_check" CHECK (
    "minutes" >= 0 AND "break_minutes" >= 0
  );

-- A clock that has stopped must not have stopped before it started. An open clock
-- (ended_at NULL) is the normal in-progress state and is left alone.
ALTER TABLE "staff_time_entries"
  ADD CONSTRAINT "staff_time_entries_clock_check" CHECK (
    "ended_at" IS NULL OR "started_at" IS NULL OR "ended_at" >= "started_at"
  );

ALTER TABLE "staff_time_entries"
  ADD CONSTRAINT "staff_time_entries_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
ALTER TABLE "staff_time_entries"
  ADD CONSTRAINT "staff_time_entries_staff_member_id_fkey"
  FOREIGN KEY ("staff_member_id") REFERENCES "staff_members"("id") ON DELETE CASCADE;
-- SetNull, not Cascade: deleting a site must not delete the record that someone
-- worked those hours. The entry falls back to the unattributed bucket, which is
-- visible, rather than vanishing from a period that was already reported.
ALTER TABLE "staff_time_entries"
  ADD CONSTRAINT "staff_time_entries_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL;

CREATE INDEX "staff_time_entries_tenant_id_staff_member_id_worked_on_idx"
  ON "staff_time_entries" ("tenant_id", "staff_member_id", "worked_on");
CREATE INDEX "staff_time_entries_tenant_id_status_worked_on_idx"
  ON "staff_time_entries" ("tenant_id", "status", "worked_on");
CREATE INDEX "staff_time_entries_tenant_id_worked_on_idx"
  ON "staff_time_entries" ("tenant_id", "worked_on");
CREATE INDEX "staff_time_entries_tenant_job_idx"
  ON "staff_time_entries" ("tenant_id", "job_type", "job_id");

ALTER TABLE "staff_time_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_time_entries" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "staff_time_entries"
  USING ("tenant_id" = current_tenant_id());

-- ── Rostered time. Nobody is paid for a shift; this never reaches the ledger. ──

CREATE TABLE "staff_shifts" (
    "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"       UUID NOT NULL,
    "staff_member_id" UUID NOT NULL,
    "property_id"     UUID,
    "starts_at"       TIMESTAMPTZ NOT NULL,
    "ends_at"         TIMESTAMPTZ NOT NULL,
    "label"           VARCHAR(120),
    "status"          VARCHAR(20) NOT NULL DEFAULT 'draft',
    "notes"           TEXT,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMPTZ NOT NULL,

    CONSTRAINT "staff_shifts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "staff_shifts"
  ADD CONSTRAINT "staff_shifts_status_check" CHECK (
    "status" IN ('draft','published','cancelled')
  );

ALTER TABLE "staff_shifts"
  ADD CONSTRAINT "staff_shifts_window_check" CHECK ("ends_at" > "starts_at");

ALTER TABLE "staff_shifts"
  ADD CONSTRAINT "staff_shifts_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
ALTER TABLE "staff_shifts"
  ADD CONSTRAINT "staff_shifts_staff_member_id_fkey"
  FOREIGN KEY ("staff_member_id") REFERENCES "staff_members"("id") ON DELETE CASCADE;
ALTER TABLE "staff_shifts"
  ADD CONSTRAINT "staff_shifts_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL;

CREATE INDEX "staff_shifts_tenant_id_starts_at_idx"
  ON "staff_shifts" ("tenant_id", "starts_at");
CREATE INDEX "staff_shifts_tenant_id_staff_member_id_starts_at_idx"
  ON "staff_shifts" ("tenant_id", "staff_member_id", "starts_at");

ALTER TABLE "staff_shifts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_shifts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "staff_shifts"
  USING ("tenant_id" = current_tenant_id());

-- ── Time off ──────────────────────────────────────────────────────────────

CREATE TABLE "staff_time_off_requests" (
    "id"                        UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"                 UUID NOT NULL,
    "staff_member_id"           UUID NOT NULL,
    "kind"                      VARCHAR(20) NOT NULL DEFAULT 'vacation',
    "starts_at"                 TIMESTAMPTZ NOT NULL,
    "ends_at"                   TIMESTAMPTZ NOT NULL,
    "all_day"                   BOOLEAN NOT NULL DEFAULT true,
    "reason"                    TEXT,
    "status"                    VARCHAR(20) NOT NULL DEFAULT 'requested',
    "decided_at"                TIMESTAMPTZ,
    "decided_by"                UUID,
    "decision_note"             TEXT,
    "availability_exception_id" UUID,
    "created_at"                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"                TIMESTAMPTZ NOT NULL,

    CONSTRAINT "staff_time_off_requests_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "staff_time_off_requests"
  ADD CONSTRAINT "staff_time_off_requests_kind_check" CHECK (
    "kind" IN ('vacation','sick','unpaid','other')
  );

ALTER TABLE "staff_time_off_requests"
  ADD CONSTRAINT "staff_time_off_requests_status_check" CHECK (
    "status" IN ('requested','approved','denied','cancelled')
  );

ALTER TABLE "staff_time_off_requests"
  ADD CONSTRAINT "staff_time_off_requests_window_check" CHECK ("ends_at" >= "starts_at");

ALTER TABLE "staff_time_off_requests"
  ADD CONSTRAINT "staff_time_off_requests_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
ALTER TABLE "staff_time_off_requests"
  ADD CONSTRAINT "staff_time_off_requests_staff_member_id_fkey"
  FOREIGN KEY ("staff_member_id") REFERENCES "staff_members"("id") ON DELETE CASCADE;

CREATE INDEX "staff_time_off_requests_tenant_id_status_starts_at_idx"
  ON "staff_time_off_requests" ("tenant_id", "status", "starts_at");
CREATE INDEX "staff_time_off_requests_tenant_member_starts_at_idx"
  ON "staff_time_off_requests" ("tenant_id", "staff_member_id", "starts_at");

ALTER TABLE "staff_time_off_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_time_off_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "staff_time_off_requests"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 4. Paper
-- ══════════════════════════════════════════════════════════════════════════
--
-- Documents come first: a certification points at one, so the FK needs the table
-- to exist.

CREATE TABLE "staff_documents" (
    "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"       UUID NOT NULL,
    "staff_member_id" UUID NOT NULL,
    "asset_id"        UUID NOT NULL,
    "kind"            VARCHAR(20) NOT NULL DEFAULT 'other',
    "title"           VARCHAR(200) NOT NULL,
    "signed_at"       TIMESTAMPTZ,
    "expires_on"      DATE,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMPTZ NOT NULL,

    CONSTRAINT "staff_documents_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "staff_documents"
  ADD CONSTRAINT "staff_documents_kind_check" CHECK (
    "kind" IN ('contract','handbook','id','certification','other')
  );

ALTER TABLE "staff_documents"
  ADD CONSTRAINT "staff_documents_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
ALTER TABLE "staff_documents"
  ADD CONSTRAINT "staff_documents_staff_member_id_fkey"
  FOREIGN KEY ("staff_member_id") REFERENCES "staff_members"("id") ON DELETE CASCADE;
ALTER TABLE "staff_documents"
  ADD CONSTRAINT "staff_documents_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE;

CREATE INDEX "staff_documents_tenant_id_staff_member_id_idx"
  ON "staff_documents" ("tenant_id", "staff_member_id");

ALTER TABLE "staff_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_documents" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "staff_documents"
  USING ("tenant_id" = current_tenant_id());

-- ── Certifications ────────────────────────────────────────────────────────
--
-- `expires_on` NULL means a qualification that does not expire. It is a real
-- answer, and it must never be presented as an urgent one — see the reporting rule
-- that a value nobody measured must not render as though somebody had.

CREATE TABLE "staff_certifications" (
    "id"                 UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"          UUID NOT NULL,
    "staff_member_id"    UUID NOT NULL,
    "name"               VARCHAR(200) NOT NULL,
    "issuer"             VARCHAR(200),
    "reference_number"   VARCHAR(120),
    "issued_on"          DATE,
    "expires_on"         DATE,
    "reminder_lead_days" INTEGER NOT NULL DEFAULT 30,
    "last_reminded_at"   TIMESTAMPTZ,
    "document_id"        UUID,
    "notes"              TEXT,
    "created_at"         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"         TIMESTAMPTZ NOT NULL,

    CONSTRAINT "staff_certifications_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "staff_certifications"
  ADD CONSTRAINT "staff_certifications_lead_days_check" CHECK (
    "reminder_lead_days" >= 0 AND "reminder_lead_days" <= 365
  );

ALTER TABLE "staff_certifications"
  ADD CONSTRAINT "staff_certifications_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
ALTER TABLE "staff_certifications"
  ADD CONSTRAINT "staff_certifications_staff_member_id_fkey"
  FOREIGN KEY ("staff_member_id") REFERENCES "staff_members"("id") ON DELETE CASCADE;
-- SetNull: deleting the scan of a licence does not revoke the licence.
ALTER TABLE "staff_certifications"
  ADD CONSTRAINT "staff_certifications_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "staff_documents"("id") ON DELETE SET NULL;

CREATE INDEX "staff_certifications_tenant_id_expires_on_idx"
  ON "staff_certifications" ("tenant_id", "expires_on");
CREATE INDEX "staff_certifications_tenant_id_staff_member_id_idx"
  ON "staff_certifications" ("tenant_id", "staff_member_id");

ALTER TABLE "staff_certifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_certifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "staff_certifications"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 5. Commission
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE "staff_commissions" (
    "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"       UUID NOT NULL,
    "staff_member_id" UUID NOT NULL,
    "property_id"     UUID,
    "source_type"     VARCHAR(20) NOT NULL,
    "source_id"       UUID NOT NULL,
    "source_label"    VARCHAR(200),
    "basis_cents"     INTEGER NOT NULL,
    "rate_percent"    DECIMAL(6,3),
    "amount_cents"    INTEGER NOT NULL,
    "currency"        VARCHAR(3) NOT NULL DEFAULT 'USD',
    "earned_on"       DATE NOT NULL,
    "status"          VARCHAR(20) NOT NULL DEFAULT 'pending',
    "paid_at"         TIMESTAMPTZ,
    "note"            TEXT,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMPTZ NOT NULL,

    CONSTRAINT "staff_commissions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "staff_commissions"
  ADD CONSTRAINT "staff_commissions_source_type_check" CHECK (
    "source_type" IN ('order','deal')
  );

ALTER TABLE "staff_commissions"
  ADD CONSTRAINT "staff_commissions_status_check" CHECK (
    "status" IN ('pending','approved','paid','void')
  );

ALTER TABLE "staff_commissions"
  ADD CONSTRAINT "staff_commissions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
ALTER TABLE "staff_commissions"
  ADD CONSTRAINT "staff_commissions_staff_member_id_fkey"
  FOREIGN KEY ("staff_member_id") REFERENCES "staff_members"("id") ON DELETE CASCADE;
ALTER TABLE "staff_commissions"
  ADD CONSTRAINT "staff_commissions_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL;

-- One commission per person per sale. This is what makes a re-run of whatever
-- calculates commission update the row instead of paying someone twice.
CREATE UNIQUE INDEX "staff_commissions_tenant_member_source_unique"
  ON "staff_commissions" ("tenant_id", "staff_member_id", "source_type", "source_id");
CREATE INDEX "staff_commissions_tenant_id_status_earned_on_idx"
  ON "staff_commissions" ("tenant_id", "status", "earned_on");
CREATE INDEX "staff_commissions_tenant_id_staff_member_id_earned_on_idx"
  ON "staff_commissions" ("tenant_id", "staff_member_id", "earned_on");

ALTER TABLE "staff_commissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_commissions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "staff_commissions"
  USING ("tenant_id" = current_tenant_id());
