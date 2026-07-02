-- Organizations, Members & Invitations (docs/114 Part A).
--
-- Wires Better Auth's organization concept onto the existing `tenants` row: a
-- tenant gets MANY members (team/staff + external consultants) and a user gets
-- MANY memberships (the "client accounts" list). `organization_id` is always a
-- `tenants.id` (org == tenant, 1:1).
--
-- RLS posture mirrors users/sessions/accounts (20260527162200_auth_tables_no_force_rls):
-- ENABLE + a tenant_isolation policy, but NO FORCE. @sparx/auth connects as
-- `sparx_owner` (table owner, bypasses non-forced RLS) and must resolve "which
-- orgs is this user in?" BEFORE any tenant context exists (login, the
-- client-accounts picker, invitation accept). `sparx_app` stays filtered by the
-- policy as defense-in-depth. Because members/invitations are NOT forced and the
-- migration runs as the table owner, the owner-member backfill below reads
-- `users` and writes `members` freely — the FORCE-RLS per-tenant GUC loop footgun
-- does NOT apply here.

-- CreateTable
CREATE TABLE "members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'editor',
    "member_type" VARCHAR(20) NOT NULL DEFAULT 'staff',
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'editor',
    "member_type" VARCHAR(20) NOT NULL DEFAULT 'staff',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "inviter_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- AlterTable: which org each session is acting in (docs/114 §A.3). NULL → the
-- user's default membership (their own tenant); the JWT `tid` is minted from this.
ALTER TABLE "sessions" ADD COLUMN "active_organization_id" UUID;

-- AlterTable: the two organization fields Better Auth's org plugin reads off the
-- tenant row (org == tenant; docs/114 §A.2). Nullable + additive; the tenants
-- table is the non-RLS dispatch row, so no policy/backfill work.
ALTER TABLE "tenants" ADD COLUMN "org_logo" TEXT;
ALTER TABLE "tenants" ADD COLUMN "org_metadata" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "members_org_user_unique" ON "members"("organization_id", "user_id");
CREATE INDEX "members_user_id_idx" ON "members"("user_id");
CREATE INDEX "members_organization_id_idx" ON "members"("organization_id");

CREATE INDEX "invitations_organization_id_idx" ON "invitations"("organization_id");
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_organization_id_fkey" FOREIGN KEY ("active_organization_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security — auth-layer tables (ENABLE + policy, NO FORCE) so the auth
-- service (sparx_owner) reads cross-org before a tenant context is set, while
-- sparx_app stays filtered to the active org.
ALTER TABLE "members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "members" NO FORCE ROW LEVEL SECURITY;
CREATE POLICY members_tenant_isolation ON "members"
    AS PERMISSIVE FOR ALL
    USING (organization_id = current_tenant_id())
    WITH CHECK (organization_id = current_tenant_id());

ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invitations" NO FORCE ROW LEVEL SECURITY;
CREATE POLICY invitations_tenant_isolation ON "invitations"
    AS PERMISSIVE FOR ALL
    USING (organization_id = current_tenant_id())
    WITH CHECK (organization_id = current_tenant_id());

-- Backfill: every existing user becomes a member of their current tenant. Owners
-- keep member_type='owner'; everyone else is 'staff'. Idempotent via the unique
-- (organization_id, user_id) constraint. Runs as the table owner (non-forced RLS
-- → no per-tenant GUC loop needed).
INSERT INTO "members" ("organization_id", "user_id", "role", "member_type", "status")
SELECT "tenant_id",
       "id",
       "role",
       CASE WHEN "role" = 'owner' THEN 'owner' ELSE 'staff' END,
       'active'
FROM "users"
ON CONFLICT ("organization_id", "user_id") DO NOTHING;
