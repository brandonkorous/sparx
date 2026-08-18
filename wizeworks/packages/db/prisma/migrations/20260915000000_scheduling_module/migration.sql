-- Scheduling module (docs/79) — appointments / classes / reservations / rentals.
-- The CREATE TABLEs + payment_intents.booking_id are Prisma-generated; the
-- btree_gist no-overlap EXCLUDE constraint (docs/79 §7.4) and per-table RLS are
-- hand-added below (Prisma can express neither).

-- AlterTable
ALTER TABLE "payment_intents" ADD COLUMN     "booking_id" UUID;

-- CreateTable
CREATE TABLE "scheduling_resources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "user_id" UUID,
    "location_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "color" VARCHAR(7),
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "exclusive" BOOLEAN NOT NULL DEFAULT true,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "capacity_min" INTEGER,
    "capacity_max" INTEGER,
    "skill_tags" TEXT[],
    "bookable_online" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "scheduling_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling_services" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "booking_type" VARCHAR(20) NOT NULL DEFAULT 'appointment',
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "buffer_before_min" INTEGER NOT NULL DEFAULT 0,
    "buffer_after_min" INTEGER NOT NULL DEFAULT 0,
    "price_cents" INTEGER NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'usd',
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "assignment_strategy" VARCHAR(20) NOT NULL DEFAULT 'any_available',
    "resource_requirements" JSONB NOT NULL DEFAULT '[]',
    "policy_id" UUID,
    "intake_form_id" UUID,
    "location_id" UUID,
    "min_lead_minutes" INTEGER NOT NULL DEFAULT 0,
    "max_advance_days" INTEGER NOT NULL DEFAULT 365,
    "slot_interval_min" INTEGER NOT NULL DEFAULT 15,
    "color" VARCHAR(7),
    "image_url" TEXT,
    "bookable_online" BOOLEAN NOT NULL DEFAULT true,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "requires_asset" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "scheduling_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "booking_type" VARCHAR(20) NOT NULL,
    "series_id" UUID,
    "location_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'requested',
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "party_size" INTEGER,
    "customer_id" UUID,
    "b2b_account_id" UUID,
    "asset_ref" JSONB,
    "parts_linked" JSONB NOT NULL DEFAULT '[]',
    "work_order_id" UUID,
    "source" VARCHAR(20) NOT NULL DEFAULT 'dashboard',
    "policy_id" UUID,
    "deposit_status" VARCHAR(20),
    "payment_intent_id" UUID,
    "intake_submission_id" UUID,
    "notes" TEXT,
    "staff_notes" TEXT,
    "reminder_state" JSONB NOT NULL DEFAULT '{}',
    "confirmed_by_user_id" UUID,
    "confirmed_at" TIMESTAMPTZ,
    "checked_in_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "cancellation_reason" TEXT,
    "no_show_at" TIMESTAMPTZ,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_resources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "role" VARCHAR(40) NOT NULL,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "exclusive" BOOLEAN NOT NULL DEFAULT true,
    "status" VARCHAR(20) NOT NULL DEFAULT 'confirmed',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_attendees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "customer_id" UUID,
    "guest_name" VARCHAR(255),
    "party_size" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(20) NOT NULL DEFAULT 'booked',
    "waitlist_position" INTEGER,
    "payment_intent_id" UUID,
    "credit_applied" INTEGER NOT NULL DEFAULT 0,
    "intake_submission_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "booking_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling_availability_windows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,
    "valid_from" DATE,
    "valid_to" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduling_availability_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling_availability_exceptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "resource_id" UUID,
    "location_id" UUID,
    "kind" VARCHAR(20) NOT NULL,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "reason" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduling_availability_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling_booking_series" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "rrule" TEXT NOT NULL,
    "customer_id" UUID,
    "resource_ids" TEXT[],
    "materialized_through" TIMESTAMPTZ,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "scheduling_booking_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling_waitlist_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "resource_pref" UUID,
    "desired_from" TIMESTAMPTZ NOT NULL,
    "desired_to" TIMESTAMPTZ NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'waiting',
    "offered_at" TIMESTAMPTZ,
    "offer_expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduling_waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling_booking_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "deposit_type" VARCHAR(20) NOT NULL DEFAULT 'none',
    "deposit_amount_cents" INTEGER,
    "deposit_percent" INTEGER,
    "cancellation_window_hours" INTEGER NOT NULL DEFAULT 24,
    "late_cancel_fee_type" VARCHAR(20),
    "late_cancel_fee_value" INTEGER,
    "no_show_fee_type" VARCHAR(20),
    "no_show_fee_value" INTEGER,
    "policy_text" TEXT,
    "reminder_offsets_min" INTEGER[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "scheduling_booking_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling_intake_forms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "schema" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "scheduling_intake_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling_intake_submissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "form_id" UUID NOT NULL,
    "booking_id" UUID,
    "customer_id" UUID,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduling_intake_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling_calendar_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "connection_kind" VARCHAR(20) NOT NULL DEFAULT 'oauth',
    "credential_source" VARCHAR(20) NOT NULL DEFAULT 'tenant_byo',
    "direction" VARCHAR(10) NOT NULL DEFAULT 'two_way',
    "fidelity" VARCHAR(20) NOT NULL DEFAULT 'realtime',
    "oauth_client_ref" VARCHAR(255),
    "credentials_ref" VARCHAR(255),
    "ical_url_ref" VARCHAR(255),
    "external_calendar_id" VARCHAR(255),
    "sync_token" TEXT,
    "channel_id" VARCHAR(255),
    "channel_expires_at" TIMESTAMPTZ,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "last_synced_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "scheduling_calendar_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling_external_busy_blocks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "external_event_id" VARCHAR(255) NOT NULL,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduling_external_busy_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling_booking_notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "channel" VARCHAR(10) NOT NULL,
    "scheduled_for" TIMESTAMPTZ NOT NULL,
    "sent_at" TIMESTAMPTZ,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduling_booking_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling_locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "address" JSONB NOT NULL DEFAULT '{}',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "scheduling_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scheduling_resources_tenant_id_kind_is_active_idx" ON "scheduling_resources"("tenant_id", "kind", "is_active");

-- CreateIndex
CREATE INDEX "scheduling_resources_tenant_id_location_id_idx" ON "scheduling_resources"("tenant_id", "location_id");

-- CreateIndex
CREATE INDEX "scheduling_services_tenant_id_booking_type_is_active_idx" ON "scheduling_services"("tenant_id", "booking_type", "is_active");

-- CreateIndex
CREATE INDEX "scheduling_services_tenant_id_policy_id_idx" ON "scheduling_services"("tenant_id", "policy_id");

-- CreateIndex
CREATE INDEX "scheduling_services_tenant_id_intake_form_id_idx" ON "scheduling_services"("tenant_id", "intake_form_id");

-- CreateIndex
CREATE INDEX "bookings_tenant_id_status_idx" ON "bookings"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "bookings_tenant_id_start_at_idx" ON "bookings"("tenant_id", "start_at");

-- CreateIndex
CREATE INDEX "bookings_tenant_id_customer_id_idx" ON "bookings"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "bookings_tenant_id_b2b_account_id_idx" ON "bookings"("tenant_id", "b2b_account_id");

-- CreateIndex
CREATE INDEX "bookings_tenant_id_service_id_idx" ON "bookings"("tenant_id", "service_id");

-- CreateIndex
CREATE INDEX "bookings_tenant_id_series_id_idx" ON "bookings"("tenant_id", "series_id");

-- CreateIndex
CREATE INDEX "booking_resources_tenant_id_resource_id_start_at_idx" ON "booking_resources"("tenant_id", "resource_id", "start_at");

-- CreateIndex
CREATE INDEX "booking_resources_booking_id_idx" ON "booking_resources"("booking_id");

-- CreateIndex
CREATE INDEX "booking_attendees_tenant_id_booking_id_status_idx" ON "booking_attendees"("tenant_id", "booking_id", "status");

-- CreateIndex
CREATE INDEX "booking_attendees_tenant_id_customer_id_idx" ON "booking_attendees"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "scheduling_availability_windows_tenant_id_resource_id_day_o_idx" ON "scheduling_availability_windows"("tenant_id", "resource_id", "day_of_week");

-- CreateIndex
CREATE INDEX "scheduling_availability_exceptions_tenant_id_resource_id_st_idx" ON "scheduling_availability_exceptions"("tenant_id", "resource_id", "start_at");

-- CreateIndex
CREATE INDEX "scheduling_availability_exceptions_tenant_id_location_id_st_idx" ON "scheduling_availability_exceptions"("tenant_id", "location_id", "start_at");

-- CreateIndex
CREATE INDEX "scheduling_booking_series_tenant_id_status_idx" ON "scheduling_booking_series"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "scheduling_booking_series_tenant_id_service_id_idx" ON "scheduling_booking_series"("tenant_id", "service_id");

-- CreateIndex
CREATE INDEX "scheduling_waitlist_entries_tenant_id_service_id_status_idx" ON "scheduling_waitlist_entries"("tenant_id", "service_id", "status");

-- CreateIndex
CREATE INDEX "scheduling_waitlist_entries_tenant_id_customer_id_idx" ON "scheduling_waitlist_entries"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "scheduling_booking_policies_tenant_id_idx" ON "scheduling_booking_policies"("tenant_id");

-- CreateIndex
CREATE INDEX "scheduling_intake_forms_tenant_id_is_active_idx" ON "scheduling_intake_forms"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "scheduling_intake_submissions_tenant_id_booking_id_idx" ON "scheduling_intake_submissions"("tenant_id", "booking_id");

-- CreateIndex
CREATE INDEX "scheduling_intake_submissions_tenant_id_form_id_idx" ON "scheduling_intake_submissions"("tenant_id", "form_id");

-- CreateIndex
CREATE INDEX "scheduling_calendar_connections_tenant_id_resource_id_idx" ON "scheduling_calendar_connections"("tenant_id", "resource_id");

-- CreateIndex
CREATE INDEX "scheduling_external_busy_blocks_tenant_id_resource_id_start_idx" ON "scheduling_external_busy_blocks"("tenant_id", "resource_id", "start_at");

-- CreateIndex
CREATE UNIQUE INDEX "scheduling_external_busy_idem" ON "scheduling_external_busy_blocks"("connection_id", "external_event_id");

-- CreateIndex
CREATE INDEX "scheduling_booking_notifications_tenant_id_status_scheduled_idx" ON "scheduling_booking_notifications"("tenant_id", "status", "scheduled_for");

-- CreateIndex
CREATE INDEX "scheduling_booking_notifications_booking_id_idx" ON "scheduling_booking_notifications"("booking_id");

-- CreateIndex
CREATE INDEX "scheduling_locations_tenant_id_is_active_idx" ON "scheduling_locations"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "payment_intents_tenant_id_booking_id_idx" ON "payment_intents"("tenant_id", "booking_id");

-- AddForeignKey
ALTER TABLE "scheduling_resources" ADD CONSTRAINT "scheduling_resources_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_resources" ADD CONSTRAINT "scheduling_resources_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "scheduling_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_services" ADD CONSTRAINT "scheduling_services_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_services" ADD CONSTRAINT "scheduling_services_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "scheduling_booking_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_services" ADD CONSTRAINT "scheduling_services_intake_form_id_fkey" FOREIGN KEY ("intake_form_id") REFERENCES "scheduling_intake_forms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_services" ADD CONSTRAINT "scheduling_services_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "scheduling_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "scheduling_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "scheduling_booking_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "scheduling_booking_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "scheduling_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_resources" ADD CONSTRAINT "booking_resources_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_resources" ADD CONSTRAINT "booking_resources_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_resources" ADD CONSTRAINT "booking_resources_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "scheduling_resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_attendees" ADD CONSTRAINT "booking_attendees_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_attendees" ADD CONSTRAINT "booking_attendees_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_availability_windows" ADD CONSTRAINT "scheduling_availability_windows_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_availability_windows" ADD CONSTRAINT "scheduling_availability_windows_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "scheduling_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_availability_exceptions" ADD CONSTRAINT "scheduling_availability_exceptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_availability_exceptions" ADD CONSTRAINT "scheduling_availability_exceptions_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "scheduling_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_availability_exceptions" ADD CONSTRAINT "scheduling_availability_exceptions_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "scheduling_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_booking_series" ADD CONSTRAINT "scheduling_booking_series_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_booking_series" ADD CONSTRAINT "scheduling_booking_series_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "scheduling_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_waitlist_entries" ADD CONSTRAINT "scheduling_waitlist_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_waitlist_entries" ADD CONSTRAINT "scheduling_waitlist_entries_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "scheduling_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_booking_policies" ADD CONSTRAINT "scheduling_booking_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_intake_forms" ADD CONSTRAINT "scheduling_intake_forms_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_intake_submissions" ADD CONSTRAINT "scheduling_intake_submissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_intake_submissions" ADD CONSTRAINT "scheduling_intake_submissions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "scheduling_intake_forms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_calendar_connections" ADD CONSTRAINT "scheduling_calendar_connections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_calendar_connections" ADD CONSTRAINT "scheduling_calendar_connections_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "scheduling_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_external_busy_blocks" ADD CONSTRAINT "scheduling_external_busy_blocks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_external_busy_blocks" ADD CONSTRAINT "scheduling_external_busy_blocks_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "scheduling_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_external_busy_blocks" ADD CONSTRAINT "scheduling_external_busy_blocks_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "scheduling_calendar_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_booking_notifications" ADD CONSTRAINT "scheduling_booking_notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_booking_notifications" ADD CONSTRAINT "scheduling_booking_notifications_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_locations" ADD CONSTRAINT "scheduling_locations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ── No double-booking: DB-level guarantee (docs/79 §7.4) ──────────────────────
-- An exclusive resource cannot hold two overlapping live allocations. Pooled
-- (exclusive=false) resources skip this and rely on capacity counting.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "booking_resources"
  ADD CONSTRAINT "booking_resources_no_overlap"
  EXCLUDE USING gist ("resource_id" WITH =, tstzrange("start_at", "end_at", '[)') WITH &&)
  WHERE ("exclusive" AND "status" NOT IN ('cancelled', 'no_show'));

-- ── Row Level Security — every scheduling table is tenant-scoped ──────────────
-- ENABLE + FORCE + tenant_isolation, the platform-standard pattern. All tables
-- are new/empty so the FORCE-RLS backfill footgun (packages/db/CLAUDE.md) N/A.
ALTER TABLE "scheduling_resources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduling_resources" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "scheduling_resources" USING ("tenant_id" = current_tenant_id());

ALTER TABLE "scheduling_services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduling_services" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "scheduling_services" USING ("tenant_id" = current_tenant_id());

ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bookings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "bookings" USING ("tenant_id" = current_tenant_id());

ALTER TABLE "booking_resources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "booking_resources" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "booking_resources" USING ("tenant_id" = current_tenant_id());

ALTER TABLE "booking_attendees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "booking_attendees" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "booking_attendees" USING ("tenant_id" = current_tenant_id());

ALTER TABLE "scheduling_availability_windows" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduling_availability_windows" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "scheduling_availability_windows" USING ("tenant_id" = current_tenant_id());

ALTER TABLE "scheduling_availability_exceptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduling_availability_exceptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "scheduling_availability_exceptions" USING ("tenant_id" = current_tenant_id());

ALTER TABLE "scheduling_booking_series" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduling_booking_series" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "scheduling_booking_series" USING ("tenant_id" = current_tenant_id());

ALTER TABLE "scheduling_waitlist_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduling_waitlist_entries" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "scheduling_waitlist_entries" USING ("tenant_id" = current_tenant_id());

ALTER TABLE "scheduling_booking_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduling_booking_policies" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "scheduling_booking_policies" USING ("tenant_id" = current_tenant_id());

ALTER TABLE "scheduling_intake_forms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduling_intake_forms" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "scheduling_intake_forms" USING ("tenant_id" = current_tenant_id());

ALTER TABLE "scheduling_intake_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduling_intake_submissions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "scheduling_intake_submissions" USING ("tenant_id" = current_tenant_id());

ALTER TABLE "scheduling_calendar_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduling_calendar_connections" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "scheduling_calendar_connections" USING ("tenant_id" = current_tenant_id());

ALTER TABLE "scheduling_external_busy_blocks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduling_external_busy_blocks" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "scheduling_external_busy_blocks" USING ("tenant_id" = current_tenant_id());

ALTER TABLE "scheduling_booking_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduling_booking_notifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "scheduling_booking_notifications" USING ("tenant_id" = current_tenant_id());

ALTER TABLE "scheduling_locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduling_locations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "scheduling_locations" USING ("tenant_id" = current_tenant_id());

