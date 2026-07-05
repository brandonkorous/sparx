-- WizeWorks operator (Layer-4) identity schema — docs/16 §2.4, docs/apps/admin/build-plan.md.
--
-- This is a PURE hand-authored SQL migration (no Prisma model change drives it):
-- the operator tables are owned by the SECOND Better Auth instance in
-- @sparx/operator-auth, which uses Better Auth's native Kysely/pg adapter, NOT
-- Prisma. Prisma's (single-schema) drift check only inspects `public`, so this
-- separate `wize_admin` schema is invisible to it. Authored via
--   prisma migrate dev --create-only --name wize_admin_operator_schema
-- then hand-written; applied through the DB Migrate pipeline like every other.
--
-- ISOLATION MODEL (docs/apps/admin build-plan §2 D3/D6, §7):
--   • A dedicated `wize_admin` schema — Postgres's namespace — holds ONLY the
--     operator identity, capabilities, and audit. `sparx_app` (the tenant app
--     role) gets NO grant here; `wize_operator` gets NO grant on `public`
--     business tables. Two-way wall.
--   • NO foreign keys from `wize_admin` into `public` (F3): the operator audit
--     log stores `target_tenant_id` as a BARE UUID value, never an FK, so the
--     whole schema lifts out cleanly in a future split.
--   • NO row-level security on these tables. Schema-level grant isolation is the
--     boundary (mirrors the db CLAUDE.md "auth tables are ENABLE-only, never
--     FORCE" rule — FORCE RLS on the Better Auth tables would break its Kysely
--     queries). `wize_operator` is NOBYPASSRLS regardless, so it can never read
--     a `public` tenant table even if one were granted by mistake.
--
-- ROLE ORDERING FOOTGUN: the GRANTs below require the `wize_operator` role to
-- exist. In prod it is provisioned by Terraform (google_sql_user), which must be
-- applied BEFORE this migration runs; the guarded DO block is the local-dev +
-- fallback path (docker init creates it too). If prod `sparx_owner` lacks
-- CREATEROLE and the role is not pre-provisioned, this migration fails loudly —
-- provision the role first, then re-run.
--
-- Note: the tenant audit log's `actor_type` (public.audit_logs) is a free-text
-- VARCHAR(20), so the new `'operator'` actor value used by operator-initiated
-- writes needs NO enum DDL — it is a convention, documented here.

CREATE SCHEMA IF NOT EXISTS "wize_admin";

-- Ensure the operator DB role exists (idempotent). Prod: Terraform provisions it
-- first, so this is a no-op there. Local/fallback: create with the dev password.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'wize_operator') THEN
    CREATE ROLE "wize_operator" LOGIN PASSWORD 'devpassword' NOBYPASSRLS;
  END IF;
END
$$;

-- ─── Better Auth core tables (default camelCase columns, quoted) ─────────────
-- Column names match Better Auth's defaults so no per-field mapping is needed;
-- table names are mapped in @sparx/operator-auth via modelName. IDs are text
-- (Better Auth generates them).

CREATE TABLE "wize_admin"."platform_operators" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_operators_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "platform_operators_email_key" ON "wize_admin"."platform_operators" ("email");

CREATE TABLE "wize_admin"."platform_operator_sessions" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "platform_operator_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "platform_operator_sessions_userId_fkey" FOREIGN KEY ("userId")
      REFERENCES "wize_admin"."platform_operators" ("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "platform_operator_sessions_token_key" ON "wize_admin"."platform_operator_sessions" ("token");
CREATE INDEX "platform_operator_sessions_userId_idx" ON "wize_admin"."platform_operator_sessions" ("userId");

CREATE TABLE "wize_admin"."platform_operator_accounts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMPTZ,
    "refreshTokenExpiresAt" TIMESTAMPTZ,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_operator_accounts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "platform_operator_accounts_userId_fkey" FOREIGN KEY ("userId")
      REFERENCES "wize_admin"."platform_operators" ("id") ON DELETE CASCADE
);
CREATE INDEX "platform_operator_accounts_userId_idx" ON "wize_admin"."platform_operator_accounts" ("userId");

CREATE TABLE "wize_admin"."platform_operator_verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_operator_verifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "platform_operator_verifications_identifier_idx" ON "wize_admin"."platform_operator_verifications" ("identifier");

-- ─── Sparx-owned operator tables (clean snake_case; we query them ourselves) ──

CREATE TABLE "wize_admin"."platform_operator_capabilities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "operator_id" TEXT NOT NULL,
    "capability" VARCHAR(50) NOT NULL,
    "granted_by" TEXT,
    "granted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_operator_capabilities_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "platform_operator_capabilities_operator_fkey" FOREIGN KEY ("operator_id")
      REFERENCES "wize_admin"."platform_operators" ("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "platform_operator_capabilities_unique"
  ON "wize_admin"."platform_operator_capabilities" ("operator_id", "capability");

-- Append-only, FK-free to public (target_tenant_id is a bare UUID value).
CREATE TABLE "wize_admin"."platform_operator_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "operator_id" TEXT,
    "operator_email" TEXT,
    "capability" VARCHAR(50),
    "action" VARCHAR(100) NOT NULL,
    "target_tenant_id" UUID,
    "target_type" VARCHAR(50),
    "target_id" TEXT,
    "diff" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_operator_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "platform_operator_audit_logs_operator_idx"
  ON "wize_admin"."platform_operator_audit_logs" ("operator_id", "created_at" DESC);
CREATE INDEX "platform_operator_audit_logs_tenant_idx"
  ON "wize_admin"."platform_operator_audit_logs" ("target_tenant_id", "created_at" DESC);

-- ─── Grants: wize_operator is the ONLY app role with access to wize_admin ────
REVOKE ALL ON SCHEMA "wize_admin" FROM PUBLIC;
GRANT USAGE ON SCHEMA "wize_admin" TO "wize_operator";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "wize_admin" TO "wize_operator";
ALTER DEFAULT PRIVILEGES IN SCHEMA "wize_admin"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "wize_operator";
