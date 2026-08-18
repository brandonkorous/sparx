-- Careers (first-party) — job applications for WizeWorks/sparx itself.
-- One tenant-scoped table. Applications are only ever written on the platform
-- tenant (`wizeworks`), following the /early-access convention (docs/80 §2), so
-- it uses the standard FORCE RLS + tenant_isolation pattern (current_tenant_id()
-- defined in 20260527000100_rls). New empty table → no backfill, so no FORCE-RLS
-- per-tenant loop is needed.

-- CreateTable
CREATE TABLE "job_applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "role_slug" VARCHAR(120) NOT NULL,
    "role_title" VARCHAR(255) NOT NULL,
    "posting_id" UUID,
    "full_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "location" VARCHAR(255),
    "linkedin_url" VARCHAR(500),
    "portfolio_url" VARCHAR(500),
    "cover_letter" TEXT,
    "role_interest" VARCHAR(255),
    "resume_key" VARCHAR(1024),
    "resume_filename" VARCHAR(255),
    "resume_mime" VARCHAR(120),
    "resume_size" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'new',
    "linked_user_id" UUID,
    "source" VARCHAR(50) NOT NULL DEFAULT 'careers-site',
    "ip_address" VARCHAR(64),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_applications_tenant_id_status_created_at_idx" ON "job_applications"("tenant_id", "status", "created_at" DESC);
CREATE INDEX "job_applications_tenant_id_created_at_idx" ON "job_applications"("tenant_id", "created_at" DESC);
CREATE INDEX "job_applications_tenant_id_role_slug_idx" ON "job_applications"("tenant_id", "role_slug");
CREATE INDEX "job_applications_tenant_id_email_idx" ON "job_applications"("tenant_id", "email");

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security — hand-edited (Prisma does not generate RLS). Tenant-scoped
-- → ENABLE + FORCE + tenant_isolation. The public apply route inserts under
-- withTenant({ tenantId }) (no user id), which sets app.tenant_id so WITH CHECK
-- passes. The admin portal reads cross-tenant through its own role (docs/76 §5),
-- bypassing this policy.
ALTER TABLE "job_applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "job_applications" FORCE  ROW LEVEL SECURITY;
CREATE POLICY job_applications_tenant_isolation ON "job_applications"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
