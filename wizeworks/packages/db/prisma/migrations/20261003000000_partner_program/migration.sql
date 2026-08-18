-- Partner Program (docs/114 Part B). A partner is an organization (tenant) that
-- opted in; these tables key on `tenant_id` (== the org id) so the standard
-- current_tenant_id() RLS applies. Two visibility patterns:
--   • `partners` + `bootcamps` — a marketplace_visibility-style policy so the
--     public directory (read under withSystem, no tenant) sees only active/
--     published rows, while a tenant additionally sees its own drafts.
--   • everything else (applications, referrals, commissions, payout runs,
--     registrations) — standard ENABLE + FORCE + tenant_isolation.
-- All tables are new/empty → the FORCE-RLS per-tenant backfill footgun N/A.

-- ── partners ────────────────────────────────────────────────────────────────────
CREATE TABLE "partners" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "tier" VARCHAR(20) NOT NULL DEFAULT 'informal',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "display_name" VARCHAR(255) NOT NULL,
    "bio" VARCHAR(2000),
    "website_url" VARCHAR(500),
    "kind" VARCHAR(20) NOT NULL DEFAULT 'freelance',
    "location_city" VARCHAR(160),
    "location_state" VARCHAR(120),
    "location_country" VARCHAR(2),
    "is_remote" BOOLEAN NOT NULL DEFAULT false,
    "specialties" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "photo_url" VARCHAR(1024),
    "directory_visible" BOOLEAN NOT NULL DEFAULT true,
    "referral_code" VARCHAR(32) NOT NULL,
    "stripe_payout_account_id" VARCHAR(255),
    "payout_min_cents" INTEGER NOT NULL DEFAULT 5000,
    "applied_at" TIMESTAMPTZ,
    "approved_at" TIMESTAMPTZ,
    "certified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "partners_tenant_unique" ON "partners"("tenant_id");
CREATE UNIQUE INDEX "partners_referral_code_unique" ON "partners"("referral_code");
CREATE INDEX "partners_status_tier_idx" ON "partners"("status", "tier");
CREATE INDEX "partners_directory_visible_status_idx" ON "partners"("directory_visible", "status");
ALTER TABLE "partners" ADD CONSTRAINT "partners_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "partners" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "partners" FORCE  ROW LEVEL SECURITY;
-- Active partners are visible to everyone (incl. the no-tenant public directory
-- + referral-code resolution); a tenant additionally sees its own row (any
-- status). The directory route further filters directory_visible in the app
-- layer (the policy is the backstop, not the whole filter — marketplace pattern).
CREATE POLICY partners_visibility ON "partners"
    AS PERMISSIVE FOR ALL
    USING ("status" = 'active' OR "tenant_id" = current_tenant_id())
    WITH CHECK ("tenant_id" = current_tenant_id());

-- ── partner_applications (WizeWorks' review queue on the platform tenant) ────────
CREATE TABLE "partner_applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "applicant_tenant_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "website_url" VARCHAR(500),
    "kind" VARCHAR(20) NOT NULL DEFAULT 'freelance',
    "note" TEXT,
    "requested_tier" VARCHAR(20) NOT NULL DEFAULT 'informal',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "reviewed_at" TIMESTAMPTZ,
    "reviewed_by" UUID,
    "ip_address" VARCHAR(64),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "partner_applications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "partner_applications_tenant_id_status_created_at_idx" ON "partner_applications"("tenant_id", "status", "created_at" DESC);
CREATE INDEX "partner_applications_tenant_id_email_idx" ON "partner_applications"("tenant_id", "email");
ALTER TABLE "partner_applications" ADD CONSTRAINT "partner_applications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "partner_applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "partner_applications" FORCE  ROW LEVEL SECURITY;
CREATE POLICY partner_applications_tenant_isolation ON "partner_applications"
    AS PERMISSIVE FOR ALL
    USING ("tenant_id" = current_tenant_id())
    WITH CHECK ("tenant_id" = current_tenant_id());

-- ── partner_referrals ───────────────────────────────────────────────────────────
CREATE TABLE "partner_referrals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "referred_tenant_id" UUID NOT NULL,
    "referral_code" VARCHAR(32) NOT NULL,
    "signup_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "first_payment_at" TIMESTAMPTZ,
    "commission_rate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "commission_type" VARCHAR(20) NOT NULL DEFAULT 'one_time',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "partner_referrals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "partner_referrals_referred_tenant_unique" ON "partner_referrals"("referred_tenant_id");
CREATE INDEX "partner_referrals_tenant_id_status_idx" ON "partner_referrals"("tenant_id", "status");
CREATE INDEX "partner_referrals_partner_id_idx" ON "partner_referrals"("partner_id");
CREATE INDEX "partner_referrals_referral_code_idx" ON "partner_referrals"("referral_code");
ALTER TABLE "partner_referrals" ADD CONSTRAINT "partner_referrals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "partner_referrals" ADD CONSTRAINT "partner_referrals_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "partner_referrals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "partner_referrals" FORCE  ROW LEVEL SECURITY;
CREATE POLICY partner_referrals_tenant_isolation ON "partner_referrals"
    AS PERMISSIVE FOR ALL
    USING ("tenant_id" = current_tenant_id())
    WITH CHECK ("tenant_id" = current_tenant_id());

-- ── partner_commissions ─────────────────────────────────────────────────────────
CREATE TABLE "partner_commissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "referral_id" UUID,
    "amount_cents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "period" VARCHAR(7),
    "kind" VARCHAR(20) NOT NULL DEFAULT 'one_time',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "payout_run_id" UUID,
    "stripe_transfer_id" VARCHAR(255),
    "paid_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "partner_commissions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "partner_commissions_tenant_id_status_idx" ON "partner_commissions"("tenant_id", "status");
CREATE INDEX "partner_commissions_partner_id_idx" ON "partner_commissions"("partner_id");
CREATE INDEX "partner_commissions_payout_run_id_idx" ON "partner_commissions"("payout_run_id");
ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "partner_referrals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "partner_commissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "partner_commissions" FORCE  ROW LEVEL SECURITY;
CREATE POLICY partner_commissions_tenant_isolation ON "partner_commissions"
    AS PERMISSIVE FOR ALL
    USING ("tenant_id" = current_tenant_id())
    WITH CHECK ("tenant_id" = current_tenant_id());

-- ── partner_payout_runs ─────────────────────────────────────────────────────────
CREATE TABLE "partner_payout_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "period_start" TIMESTAMPTZ NOT NULL,
    "period_end" TIMESTAMPTZ NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "commission_count" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "stripe_transfer_id" VARCHAR(255),
    "failure_reason" TEXT,
    "paid_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "partner_payout_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "partner_payout_runs_tenant_id_status_idx" ON "partner_payout_runs"("tenant_id", "status");
ALTER TABLE "partner_payout_runs" ADD CONSTRAINT "partner_payout_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "partner_payout_runs" ADD CONSTRAINT "partner_payout_runs_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- The commission→run FK is added here (both tables now exist).
ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_payout_run_id_fkey" FOREIGN KEY ("payout_run_id") REFERENCES "partner_payout_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "partner_payout_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "partner_payout_runs" FORCE  ROW LEVEL SECURITY;
CREATE POLICY partner_payout_runs_tenant_isolation ON "partner_payout_runs"
    AS PERMISSIVE FOR ALL
    USING ("tenant_id" = current_tenant_id())
    WITH CHECK ("tenant_id" = current_tenant_id());

-- ── bootcamps ───────────────────────────────────────────────────────────────────
CREATE TABLE "bootcamps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "format" VARCHAR(20) NOT NULL DEFAULT 'virtual',
    "location_city" VARCHAR(160),
    "location_state" VARCHAR(120),
    "location_country" VARCHAR(2) NOT NULL DEFAULT 'US',
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ NOT NULL,
    "seats_total" INTEGER,
    "seats_filled" INTEGER NOT NULL DEFAULT 0,
    "price_cents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "registration_mode" VARCHAR(20) NOT NULL DEFAULT 'internal',
    "registration_url" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "bootcamps_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bootcamps_slug_unique" ON "bootcamps"("slug");
CREATE INDEX "bootcamps_tenant_id_status_idx" ON "bootcamps"("tenant_id", "status");
CREATE INDEX "bootcamps_status_starts_at_idx" ON "bootcamps"("status", "starts_at");
CREATE INDEX "bootcamps_partner_id_idx" ON "bootcamps"("partner_id");
ALTER TABLE "bootcamps" ADD CONSTRAINT "bootcamps_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bootcamps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bootcamps" FORCE  ROW LEVEL SECURITY;
CREATE POLICY bootcamps_visibility ON "bootcamps"
    AS PERMISSIVE FOR ALL
    USING ("status" = 'published' OR "tenant_id" = current_tenant_id())
    WITH CHECK ("tenant_id" = current_tenant_id());

-- ── bootcamp_registrations ──────────────────────────────────────────────────────
CREATE TABLE "bootcamp_registrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "bootcamp_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "seats" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(20) NOT NULL DEFAULT 'registered',
    "crm_customer_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bootcamp_registrations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bootcamp_registrations_bootcamp_email_unique" ON "bootcamp_registrations"("bootcamp_id", "email");
CREATE INDEX "bootcamp_registrations_tenant_id_idx" ON "bootcamp_registrations"("tenant_id");
CREATE INDEX "bootcamp_registrations_bootcamp_id_status_idx" ON "bootcamp_registrations"("bootcamp_id", "status");
ALTER TABLE "bootcamp_registrations" ADD CONSTRAINT "bootcamp_registrations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bootcamp_registrations" ADD CONSTRAINT "bootcamp_registrations_bootcamp_id_fkey" FOREIGN KEY ("bootcamp_id") REFERENCES "bootcamps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bootcamp_registrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bootcamp_registrations" FORCE  ROW LEVEL SECURITY;
CREATE POLICY bootcamp_registrations_tenant_isolation ON "bootcamp_registrations"
    AS PERMISSIVE FOR ALL
    USING ("tenant_id" = current_tenant_id())
    WITH CHECK ("tenant_id" = current_tenant_id());
