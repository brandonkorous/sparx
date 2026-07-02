-- Layer 2 (site shoppers) → Better Auth. See docs/27 v2.
--
-- Replaces the bespoke customer-auth tables (customer_identities /
-- customer_credentials / customer_sessions / customer_password_resets) with a
-- dedicated Better Auth customer instance's tables (customer_users /
-- customer_sessions [now Better-Auth-shaped] / customer_accounts /
-- customer_verifications) plus a tenant-scoped MCP OAuth authorization server
-- (customer_oauth_applications / customer_oauth_access_tokens /
-- customer_oauth_consents).
--
-- Application-level multi-tenancy: the same email is a separate account per
-- tenant. Every table is ENABLE + FORCE RLS with a tenant_isolation policy, and
-- tenant_id DEFAULTs to current_tenant_id() so Better Auth's inserts (which never
-- carry a tenant_id — BA is tenant-oblivious) are auto-stamped with the tenant
-- the request's tenant-scoping adapter set via SET LOCAL app.tenant_id. Unlike
-- the STAFF oauth_* tables (03-auth-oauth.prisma), which are ENABLE + NO FORCE
-- because the single-host resource server (mcp.sparx.works) doesn't know the
-- tenant before token lookup, the storefront MCP resource server ALWAYS knows
-- its store (per-site host), so the customer oauth tables are FORCE-RLS too and
-- token verification runs inside withTenant(knownTenant) — a token issued for
-- one store presented to another resolves to zero rows.
--
-- Cutover: existing shopper SESSIONS and pending RESET tokens are dropped —
-- every logged-in shopper is signed out once and re-logs-in with their existing
-- password. Passwords (Argon2id hashes) and the tenant-wide identity carry over.

-- ── 0. Drop the old session + reset tables first (not needed for backfill; this
--    also frees the `customer_sessions` name for the new Better Auth session
--    table). CASCADE drops their FKs to customers / customer_credentials. ──
DROP TABLE "customer_sessions" CASCADE;
DROP TABLE "customer_password_resets" CASCADE;

-- ── 1. Better Auth core: user / session / account / verification. ──

CREATE TABLE "customer_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL DEFAULT current_tenant_id(),
    "email" VARCHAR(255) NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "name" VARCHAR(255) NOT NULL,
    "image" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "customer_users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customer_users_tenant_email_unique" ON "customer_users"("tenant_id", "email");
CREATE INDEX "customer_users_tenant_id_idx" ON "customer_users"("tenant_id");
ALTER TABLE "customer_users" ADD CONSTRAINT "customer_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "customer_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL DEFAULT current_tenant_id(),
    "user_id" UUID NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "customer_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customer_sessions_token_key" ON "customer_sessions"("token");
CREATE INDEX "customer_sessions_tenant_id_idx" ON "customer_sessions"("tenant_id");
CREATE INDEX "customer_sessions_user_id_idx" ON "customer_sessions"("user_id");
CREATE INDEX "customer_sessions_expires_at_idx" ON "customer_sessions"("expires_at");
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "customer_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "customer_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL DEFAULT current_tenant_id(),
    "user_id" UUID NOT NULL,
    "provider_id" VARCHAR(50) NOT NULL,
    "account_id" VARCHAR(255) NOT NULL,
    "password" TEXT,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "access_token_expires_at" TIMESTAMPTZ,
    "refresh_token_expires_at" TIMESTAMPTZ,
    "scope" TEXT,
    "id_token" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "customer_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customer_accounts_tenant_provider_account_unique" ON "customer_accounts"("tenant_id", "provider_id", "account_id");
CREATE INDEX "customer_accounts_tenant_id_idx" ON "customer_accounts"("tenant_id");
CREATE INDEX "customer_accounts_user_id_idx" ON "customer_accounts"("user_id");
ALTER TABLE "customer_accounts" ADD CONSTRAINT "customer_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_accounts" ADD CONSTRAINT "customer_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "customer_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "customer_verifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL DEFAULT current_tenant_id(),
    "identifier" VARCHAR(255) NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "customer_verifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "customer_verifications_tenant_id_identifier_idx" ON "customer_verifications"("tenant_id", "identifier");
CREATE INDEX "customer_verifications_expires_at_idx" ON "customer_verifications"("expires_at");
ALTER TABLE "customer_verifications" ADD CONSTRAINT "customer_verifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 2. Shopper MCP OAuth authorization server (tenant-scoped). ──

CREATE TABLE "customer_oauth_applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL DEFAULT current_tenant_id(),
    "name" VARCHAR(255),
    "icon" TEXT,
    "metadata" TEXT,
    "client_id" VARCHAR(255) NOT NULL,
    "client_secret" TEXT,
    "redirect_urls" TEXT NOT NULL,
    "type" VARCHAR(32) NOT NULL,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "customer_oauth_applications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customer_oauth_applications_client_id_key" ON "customer_oauth_applications"("client_id");
CREATE INDEX "customer_oauth_applications_tenant_id_idx" ON "customer_oauth_applications"("tenant_id");
CREATE INDEX "customer_oauth_applications_user_id_idx" ON "customer_oauth_applications"("user_id");
ALTER TABLE "customer_oauth_applications" ADD CONSTRAINT "customer_oauth_applications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_oauth_applications" ADD CONSTRAINT "customer_oauth_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "customer_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "customer_oauth_access_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL DEFAULT current_tenant_id(),
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "access_token_expires_at" TIMESTAMPTZ NOT NULL,
    "refresh_token_expires_at" TIMESTAMPTZ NOT NULL,
    "client_id" VARCHAR(255) NOT NULL,
    "user_id" UUID,
    "scopes" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "customer_oauth_access_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customer_oauth_access_tokens_access_token_key" ON "customer_oauth_access_tokens"("access_token");
CREATE UNIQUE INDEX "customer_oauth_access_tokens_refresh_token_key" ON "customer_oauth_access_tokens"("refresh_token");
CREATE INDEX "customer_oauth_access_tokens_tenant_id_idx" ON "customer_oauth_access_tokens"("tenant_id");
CREATE INDEX "customer_oauth_access_tokens_client_id_idx" ON "customer_oauth_access_tokens"("client_id");
CREATE INDEX "customer_oauth_access_tokens_user_id_idx" ON "customer_oauth_access_tokens"("user_id");
CREATE INDEX "customer_oauth_access_tokens_access_token_expires_at_idx" ON "customer_oauth_access_tokens"("access_token_expires_at");
ALTER TABLE "customer_oauth_access_tokens" ADD CONSTRAINT "customer_oauth_access_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_oauth_access_tokens" ADD CONSTRAINT "customer_oauth_access_tokens_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "customer_oauth_applications"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_oauth_access_tokens" ADD CONSTRAINT "customer_oauth_access_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "customer_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "customer_oauth_consents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL DEFAULT current_tenant_id(),
    "client_id" VARCHAR(255) NOT NULL,
    "user_id" UUID NOT NULL,
    "scopes" TEXT NOT NULL,
    "consent_given" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "customer_oauth_consents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "customer_oauth_consents_tenant_id_idx" ON "customer_oauth_consents"("tenant_id");
CREATE INDEX "customer_oauth_consents_client_id_idx" ON "customer_oauth_consents"("client_id");
CREATE INDEX "customer_oauth_consents_user_id_idx" ON "customer_oauth_consents"("user_id");
ALTER TABLE "customer_oauth_consents" ADD CONSTRAINT "customer_oauth_consents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_oauth_consents" ADD CONSTRAINT "customer_oauth_consents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "customer_oauth_applications"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_oauth_consents" ADD CONSTRAINT "customer_oauth_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "customer_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 3. RLS: ENABLE + FORCE + tenant_isolation for every customer-auth table. ──
ALTER TABLE "customer_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_users" FORCE ROW LEVEL SECURITY;
CREATE POLICY "customer_users_tenant_isolation" ON "customer_users"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());

ALTER TABLE "customer_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "customer_sessions_tenant_isolation" ON "customer_sessions"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());

ALTER TABLE "customer_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_accounts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "customer_accounts_tenant_isolation" ON "customer_accounts"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());

ALTER TABLE "customer_verifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_verifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY "customer_verifications_tenant_isolation" ON "customer_verifications"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());

ALTER TABLE "customer_oauth_applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_oauth_applications" FORCE ROW LEVEL SECURITY;
CREATE POLICY "customer_oauth_applications_tenant_isolation" ON "customer_oauth_applications"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());

ALTER TABLE "customer_oauth_access_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_oauth_access_tokens" FORCE ROW LEVEL SECURITY;
CREATE POLICY "customer_oauth_access_tokens_tenant_isolation" ON "customer_oauth_access_tokens"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());

ALTER TABLE "customer_oauth_consents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_oauth_consents" FORCE ROW LEVEL SECURITY;
CREATE POLICY "customer_oauth_consents_tenant_isolation" ON "customer_oauth_consents"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());

-- ── 4. Backfill (passwords cannot be re-minted). FORCE-RLS tables → loop tenants
--    + set_config('app.tenant_id') (sparx_owner is non-superuser in prod). Only
--    identities WITH a credential migrate (a login); guest identities are dropped
--    with customer_identities below and their customers row stays a guest
--    (auth_user_id = NULL). CustomerUser.id is preserved from the identity id so
--    customers.auth_user_id links without a lookup. ──
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);

    -- CustomerUser ← CustomerIdentity (only those with a credential). name is
    -- NOT NULL: take a linked customer's name, else the email local-part.
    INSERT INTO "customer_users" ("id", "tenant_id", "email", "email_verified", "name", "created_at", "updated_at")
      SELECT ci."id", ci."tenant_id", ci."email", cred."email_verified",
             COALESCE(
               (SELECT NULLIF(TRIM(CONCAT_WS(' ', c."first_name", c."last_name")), '')
                  FROM "customers" c
                 WHERE c."identity_id" = ci."id"
                   AND (c."first_name" IS NOT NULL OR c."last_name" IS NOT NULL)
                 ORDER BY c."created_at" ASC
                 LIMIT 1),
               split_part(ci."email", '@', 1)
             ),
             ci."created_at", CURRENT_TIMESTAMP
        FROM "customer_identities" ci
        JOIN "customer_credentials" cred ON cred."identity_id" = ci."id"
       WHERE ci."tenant_id" = t.id;

    -- CustomerAccount (credential provider) ← CustomerCredential. Better Auth's
    -- credential account keys accountId = the user id; password = the Argon2 hash.
    INSERT INTO "customer_accounts" ("tenant_id", "user_id", "provider_id", "account_id", "password", "created_at", "updated_at")
      SELECT cred."tenant_id", cred."identity_id", 'credential', cred."identity_id"::text,
             cred."password_hash", cred."created_at", CURRENT_TIMESTAMP
        FROM "customer_credentials" cred
       WHERE cred."tenant_id" = t.id;

    -- Repoint the CRM spine: memberships whose identity had a login now link to
    -- the Better Auth user (same id).
    UPDATE "customers" c
       SET "auth_user_id" = c."identity_id"
      FROM "customer_credentials" cred
     WHERE c."tenant_id" = t.id
       AND cred."identity_id" = c."identity_id";
  END LOOP;
END $$;

-- ── 5. customers: retire the identity_id link, wire auth_user_id → customer_users.
--    (auth_user_id column + its index already exist from schema 20.) ──
ALTER TABLE "customers" DROP CONSTRAINT "customers_identity_id_fkey";
DROP INDEX "customers_identity_id_idx";
ALTER TABLE "customers" DROP COLUMN "identity_id";
ALTER TABLE "customers" ADD CONSTRAINT "customers_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "customer_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 6. Drop the retired bespoke auth tables (CASCADE clears their FKs). ──
DROP TABLE "customer_credentials" CASCADE;
DROP TABLE "customer_identities" CASCADE;
