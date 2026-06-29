-- In-product feedback (docs/112). Three tenant-scoped tables: submissions, the
-- reply thread, and the per-user pulse frequency-cap state. A dashboard user
-- sends WizeWorks an idea / problem / question / praise with their context
-- attached; staff triage + respond from the admin portal (docs/apps/admin/
-- feedback.md). Keyed on (user_id, tenant_id) like the shell tables (06-shell).
-- All three are FORCE RLS + tenant_isolation (current_tenant_id() defined in
-- 20260527000100_rls). New empty tables → no backfill, so no FORCE-RLS loop.

-- CreateTable
CREATE TABLE "feedback_submissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "submitter_name" VARCHAR(255),
    "submitter_email" VARCHAR(255),
    "source" VARCHAR(20) NOT NULL DEFAULT 'button',
    "category" VARCHAR(20) NOT NULL,
    "subject" VARCHAR(160),
    "body" TEXT NOT NULL,
    "sentiment" SMALLINT,
    "context" JSONB NOT NULL DEFAULT '{}',
    "attachment_asset_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    "status" VARCHAR(20) NOT NULL DEFAULT 'new',
    "assignee_staff_id" UUID,
    "internal_tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "last_response_at" TIMESTAMPTZ,
    "user_unread" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "feedback_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "author_kind" VARCHAR(10) NOT NULL,
    "author_id" UUID NOT NULL,
    "author_name" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "attachment_asset_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_pulse_state" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "last_shown_at" TIMESTAMPTZ,
    "last_dismissed_at" TIMESTAMPTZ,
    "consecutive_dismissals" SMALLINT NOT NULL DEFAULT 0,
    "last_submitted_at" TIMESTAMPTZ,
    "last_sentiment" SMALLINT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "feedback_pulse_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_submissions_tenant_id_created_at_idx" ON "feedback_submissions"("tenant_id", "created_at" DESC);
CREATE INDEX "feedback_submissions_tenant_id_user_id_created_at_idx" ON "feedback_submissions"("tenant_id", "user_id", "created_at" DESC);
CREATE INDEX "feedback_submissions_tenant_id_status_created_at_idx" ON "feedback_submissions"("tenant_id", "status", "created_at" DESC);
CREATE INDEX "feedback_messages_tenant_id_submission_id_created_at_idx" ON "feedback_messages"("tenant_id", "submission_id", "created_at");
CREATE UNIQUE INDEX "feedback_pulse_state_user_tenant_unique" ON "feedback_pulse_state"("user_id", "tenant_id");
CREATE INDEX "feedback_pulse_state_tenant_id_idx" ON "feedback_pulse_state"("tenant_id");

-- AddForeignKey
ALTER TABLE "feedback_submissions" ADD CONSTRAINT "feedback_submissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedback_submissions" ADD CONSTRAINT "feedback_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "feedback_messages" ADD CONSTRAINT "feedback_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedback_messages" ADD CONSTRAINT "feedback_messages_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "feedback_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedback_pulse_state" ADD CONSTRAINT "feedback_pulse_state_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedback_pulse_state" ADD CONSTRAINT "feedback_pulse_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security — hand-edited (Prisma does not generate RLS). All three are
-- tenant-scoped → ENABLE + FORCE + tenant_isolation. The admin portal reads
-- cross-tenant through its own role (docs/76 §5), bypassing these policies.
ALTER TABLE "feedback_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feedback_submissions" FORCE  ROW LEVEL SECURITY;
CREATE POLICY feedback_submissions_tenant_isolation ON "feedback_submissions"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE "feedback_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feedback_messages" FORCE  ROW LEVEL SECURITY;
CREATE POLICY feedback_messages_tenant_isolation ON "feedback_messages"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE "feedback_pulse_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feedback_pulse_state" FORCE  ROW LEVEL SECURITY;
CREATE POLICY feedback_pulse_state_tenant_isolation ON "feedback_pulse_state"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
