-- MCP OAuth authorization server on Better Auth 1.7 (docs/07 §5, docs/113).
--
-- better-auth moved from 1.6.33 to 1.7.14 to close GHSA-965c-763c-88jm
-- (critical), GHSA-r4xp-prcw-77qf and GHSA-q84f-53jg-9ppm (high) and
-- GHSA-44jh-23m7-hpcf (low); none of them has a 1.6 fix. 1.7 removed the in-core
-- `mcp()` / `oidcProvider` plugins that the old tables backed. Their replacement
-- is `@better-auth/mcp`, which is `@better-auth/oauth-provider` configured for
-- MCP, signing its access tokens with the `jwt()` plugin. It has a different
-- data model: hashed tokens instead of a raw token PAIR, refresh tokens in
-- their own table, scopes as arrays, per-resource policy (RFC 8707), and the
-- signing keys in `jwks`.
--
-- Nothing is carried over. A token pair in the old shape cannot be turned into
-- the new one (the new tables hold a SHA-256 of a token, and the old access
-- tokens were never JWTs), and a client registration without a token is of no
-- use to anybody. So the old tables are dropped and every connected assistant
-- reconnects once, which Brandon accepted for this change. A connection is
-- one click to remake from the assistant's own settings.
--
-- TWO SETS, one per Better Auth instance:
--
--   • STAFF (no tenant_id). Same RLS posture as the tables they replace
--     (20260927000000_mcp_oauth_provider): ENABLE, NO FORCE, NO policy. They
--     hold client secrets, token hashes and private signing keys; only the auth
--     service, which connects as sparx_owner (the owner), reads them, and
--     sparx_app sees zero rows. Tenant scope is resolved transitively (user_id
--     → users.tenant_id) by verifyMcpOAuthToken in @wizeworks/auth.
--
--   • CUSTOMER (tenant_id DEFAULT current_tenant_id()). Same posture as the
--     customer tables they replace (20260930000000_customer_auth_better_auth):
--     ENABLE + FORCE + a tenant_isolation policy. Better Auth never sets
--     tenant_id; the customer-auth adapter runs every op inside withTenant, so
--     the default fills it and the policy scopes it.
--
-- Unique keys stay single-column and global (random client ids, token hashes,
-- one store origin per resource): Better Auth addresses them by that column
-- alone, and the Prisma adapter only treats a single-column unique as a key.
--
-- List columns are NOT NULL DEFAULT '{}' because Prisma cannot write NULL to a
-- list. Plugin `json` fields are TEXT because the Prisma adapter stringifies
-- them (it does not declare JSON support).

-- ─── Drop the 1.6 tables ───────────────────────────────────────────────────
-- Children first; CASCADE would do it, but naming the order keeps the intent
-- legible.

DROP TABLE "oauth_consents";
DROP TABLE "oauth_access_tokens";
DROP TABLE "oauth_applications";

DROP TABLE "customer_oauth_consents";
DROP TABLE "customer_oauth_access_tokens";
DROP TABLE "customer_oauth_applications";

-- ═══ STAFF ══════════════════════════════════════════════════════════════════

-- ─── jwks ──────────────────────────────────────────────────────────────────
-- One key set per brand: each product's deployment encrypts its private keys
-- with its own BETTER_AUTH_SECRET and signs with the newest row it can read, so
-- the brand-scoped client stamps and filters platform_brand (as it does on
-- users). No default: a row without a brand would be read by neither product.
CREATE TABLE "jwks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "platform_brand" VARCHAR(20) NOT NULL,
    "public_key" TEXT NOT NULL,
    "private_key" TEXT NOT NULL,
    "alg" VARCHAR(32),
    "crv" VARCHAR(32),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ,

    CONSTRAINT "jwks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "jwks_platform_brand_created_at_idx" ON "jwks"("platform_brand", "created_at");

-- ─── oauth_clients ─────────────────────────────────────────────────────────
CREATE TABLE "oauth_clients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" VARCHAR(255) NOT NULL,
    "client_secret" TEXT,
    "client_discovery_id" TEXT,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "skip_consent" BOOLEAN,
    "enable_end_session" BOOLEAN,
    "subject_type" VARCHAR(32),
    "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "client_credentials_scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "user_id" UUID,
    "name" VARCHAR(255),
    "uri" TEXT,
    "icon" TEXT,
    "contacts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "tos" TEXT,
    "policy" TEXT,
    "software_id" TEXT,
    "software_version" TEXT,
    "software_statement" TEXT,
    "redirect_uris" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "post_logout_redirect_uris" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "backchannel_logout_uri" TEXT,
    "backchannel_logout_session_required" BOOLEAN,
    "token_endpoint_auth_method" VARCHAR(64),
    "application_type" VARCHAR(32),
    "jwks" TEXT,
    "jwks_uri" TEXT,
    "grant_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "response_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "require_pkce" BOOLEAN,
    "dpop_bound_access_tokens" BOOLEAN NOT NULL DEFAULT false,
    "reference_id" TEXT,
    "metadata" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "oauth_clients_client_id_key" ON "oauth_clients"("client_id");
CREATE INDEX "oauth_clients_user_id_idx" ON "oauth_clients"("user_id");
ALTER TABLE "oauth_clients" ADD CONSTRAINT "oauth_clients_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── oauth_resources ───────────────────────────────────────────────────────
CREATE TABLE "oauth_resources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "identifier" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "access_token_ttl" INTEGER,
    "refresh_token_ttl" INTEGER,
    "signing_algorithm" VARCHAR(32),
    "signing_key_id" TEXT,
    "allowed_scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "custom_claims" TEXT,
    "dpop_bound_access_tokens_required" BOOLEAN NOT NULL DEFAULT false,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "policy_version" INTEGER NOT NULL DEFAULT 1,
    "metadata" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_resources_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "oauth_resources_identifier_key" ON "oauth_resources"("identifier");

-- ─── oauth_client_resources ────────────────────────────────────────────────
CREATE TABLE "oauth_client_resources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" VARCHAR(255) NOT NULL,
    "resource_id" TEXT NOT NULL,
    "metadata" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_client_resources_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "oauth_client_resources_client_id_resource_id_key" ON "oauth_client_resources"("client_id", "resource_id");
CREATE INDEX "oauth_client_resources_client_id_idx" ON "oauth_client_resources"("client_id");
CREATE INDEX "oauth_client_resources_resource_id_idx" ON "oauth_client_resources"("resource_id");
ALTER TABLE "oauth_client_resources" ADD CONSTRAINT "oauth_client_resources_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "oauth_clients"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_client_resources" ADD CONSTRAINT "oauth_client_resources_resource_id_fkey"
    FOREIGN KEY ("resource_id") REFERENCES "oauth_resources"("identifier") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── oauth_refresh_tokens ──────────────────────────────────────────────────
CREATE TABLE "oauth_refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token" TEXT NOT NULL,
    "client_id" VARCHAR(255) NOT NULL,
    "session_id" UUID,
    "user_id" UUID NOT NULL,
    "reference_id" TEXT,
    "authorization_code_id" TEXT,
    "resources" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "requested_user_info_claims" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "revoked" TIMESTAMPTZ,
    "rotated_at" TIMESTAMPTZ,
    "rotation_replay_response" TEXT,
    "rotation_replay_expires_at" TIMESTAMPTZ,
    "auth_time" TIMESTAMPTZ,
    "confirmation" TEXT,

    CONSTRAINT "oauth_refresh_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "oauth_refresh_tokens_token_key" ON "oauth_refresh_tokens"("token");
CREATE INDEX "oauth_refresh_tokens_client_id_idx" ON "oauth_refresh_tokens"("client_id");
CREATE INDEX "oauth_refresh_tokens_session_id_idx" ON "oauth_refresh_tokens"("session_id");
CREATE INDEX "oauth_refresh_tokens_user_id_idx" ON "oauth_refresh_tokens"("user_id");
CREATE INDEX "oauth_refresh_tokens_authorization_code_id_idx" ON "oauth_refresh_tokens"("authorization_code_id");
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "oauth_clients"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;
-- SET NULL, not cascade: signing out of the console must not disconnect an
-- assistant that was authorized from that browser session.
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── oauth_access_tokens ───────────────────────────────────────────────────
CREATE TABLE "oauth_access_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token" TEXT,
    "client_id" VARCHAR(255) NOT NULL,
    "session_id" UUID,
    "user_id" UUID,
    "reference_id" TEXT,
    "authorization_code_id" TEXT,
    "resources" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "requested_user_info_claims" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "refresh_id" UUID,
    "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "revoked" TIMESTAMPTZ,
    "confirmation" TEXT,

    CONSTRAINT "oauth_access_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "oauth_access_tokens_token_key" ON "oauth_access_tokens"("token");
CREATE INDEX "oauth_access_tokens_client_id_idx" ON "oauth_access_tokens"("client_id");
CREATE INDEX "oauth_access_tokens_session_id_idx" ON "oauth_access_tokens"("session_id");
CREATE INDEX "oauth_access_tokens_user_id_idx" ON "oauth_access_tokens"("user_id");
CREATE INDEX "oauth_access_tokens_authorization_code_id_idx" ON "oauth_access_tokens"("authorization_code_id");
CREATE INDEX "oauth_access_tokens_refresh_id_idx" ON "oauth_access_tokens"("refresh_id");
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "oauth_clients"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_refresh_id_fkey"
    FOREIGN KEY ("refresh_id") REFERENCES "oauth_refresh_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── oauth_consents ────────────────────────────────────────────────────────
CREATE TABLE "oauth_consents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" VARCHAR(255) NOT NULL,
    "user_id" UUID,
    "reference_id" TEXT,
    "resources" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "requested_user_info_claims" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_consents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "oauth_consents_client_id_idx" ON "oauth_consents"("client_id");
CREATE INDEX "oauth_consents_user_id_idx" ON "oauth_consents"("user_id");
ALTER TABLE "oauth_consents" ADD CONSTRAINT "oauth_consents_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "oauth_clients"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_consents" ADD CONSTRAINT "oauth_consents_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── oauth_client_assertions ───────────────────────────────────────────────
-- TEXT id: Better Auth writes a base64url digest of the assertion's jti.
CREATE TABLE "oauth_client_assertions" (
    "id" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "oauth_client_assertions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "oauth_client_assertions_expires_at_idx" ON "oauth_client_assertions"("expires_at");

-- ─── STAFF RLS: ENABLE, do NOT FORCE, NO policy ────────────────────────────
-- Owner (auth service) bypasses; sparx_app is fenced out completely.

ALTER TABLE "jwks"                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "oauth_clients"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "oauth_resources"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "oauth_client_resources"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "oauth_refresh_tokens"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "oauth_access_tokens"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "oauth_consents"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "oauth_client_assertions" ENABLE ROW LEVEL SECURITY;

-- ═══ CUSTOMER ═══════════════════════════════════════════════════════════════

-- ─── customer_jwks ─────────────────────────────────────────────────────────
-- One signing key set PER TENANT: a token one store minted cannot verify at
-- another, independently of RLS.
CREATE TABLE "customer_jwks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL DEFAULT current_tenant_id(),
    "public_key" TEXT NOT NULL,
    "private_key" TEXT NOT NULL,
    "alg" VARCHAR(32),
    "crv" VARCHAR(32),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ,

    CONSTRAINT "customer_jwks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "customer_jwks_tenant_id_idx" ON "customer_jwks"("tenant_id");
ALTER TABLE "customer_jwks" ADD CONSTRAINT "customer_jwks_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── customer_oauth_clients ────────────────────────────────────────────────
CREATE TABLE "customer_oauth_clients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL DEFAULT current_tenant_id(),
    "client_id" VARCHAR(255) NOT NULL,
    "client_secret" TEXT,
    "client_discovery_id" TEXT,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "skip_consent" BOOLEAN,
    "enable_end_session" BOOLEAN,
    "subject_type" VARCHAR(32),
    "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "client_credentials_scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "user_id" UUID,
    "name" VARCHAR(255),
    "uri" TEXT,
    "icon" TEXT,
    "contacts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "tos" TEXT,
    "policy" TEXT,
    "software_id" TEXT,
    "software_version" TEXT,
    "software_statement" TEXT,
    "redirect_uris" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "post_logout_redirect_uris" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "backchannel_logout_uri" TEXT,
    "backchannel_logout_session_required" BOOLEAN,
    "token_endpoint_auth_method" VARCHAR(64),
    "application_type" VARCHAR(32),
    "jwks" TEXT,
    "jwks_uri" TEXT,
    "grant_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "response_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "require_pkce" BOOLEAN,
    "dpop_bound_access_tokens" BOOLEAN NOT NULL DEFAULT false,
    "reference_id" TEXT,
    "metadata" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_oauth_clients_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customer_oauth_clients_client_id_key" ON "customer_oauth_clients"("client_id");
CREATE INDEX "customer_oauth_clients_tenant_id_idx" ON "customer_oauth_clients"("tenant_id");
CREATE INDEX "customer_oauth_clients_user_id_idx" ON "customer_oauth_clients"("user_id");
ALTER TABLE "customer_oauth_clients" ADD CONSTRAINT "customer_oauth_clients_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_oauth_clients" ADD CONSTRAINT "customer_oauth_clients_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "customer_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── customer_oauth_resources ──────────────────────────────────────────────
CREATE TABLE "customer_oauth_resources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL DEFAULT current_tenant_id(),
    "identifier" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "access_token_ttl" INTEGER,
    "refresh_token_ttl" INTEGER,
    "signing_algorithm" VARCHAR(32),
    "signing_key_id" TEXT,
    "allowed_scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "custom_claims" TEXT,
    "dpop_bound_access_tokens_required" BOOLEAN NOT NULL DEFAULT false,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "policy_version" INTEGER NOT NULL DEFAULT 1,
    "metadata" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_oauth_resources_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customer_oauth_resources_identifier_key" ON "customer_oauth_resources"("identifier");
CREATE INDEX "customer_oauth_resources_tenant_id_idx" ON "customer_oauth_resources"("tenant_id");
ALTER TABLE "customer_oauth_resources" ADD CONSTRAINT "customer_oauth_resources_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── customer_oauth_client_resources ───────────────────────────────────────
CREATE TABLE "customer_oauth_client_resources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL DEFAULT current_tenant_id(),
    "client_id" VARCHAR(255) NOT NULL,
    "resource_id" TEXT NOT NULL,
    "metadata" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_oauth_client_resources_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customer_oauth_client_resources_client_id_resource_id_key" ON "customer_oauth_client_resources"("client_id", "resource_id");
CREATE INDEX "customer_oauth_client_resources_tenant_id_idx" ON "customer_oauth_client_resources"("tenant_id");
CREATE INDEX "customer_oauth_client_resources_resource_id_idx" ON "customer_oauth_client_resources"("resource_id");
ALTER TABLE "customer_oauth_client_resources" ADD CONSTRAINT "customer_oauth_client_resources_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_oauth_client_resources" ADD CONSTRAINT "customer_oauth_client_resources_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "customer_oauth_clients"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_oauth_client_resources" ADD CONSTRAINT "customer_oauth_client_resources_resource_id_fkey"
    FOREIGN KEY ("resource_id") REFERENCES "customer_oauth_resources"("identifier") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── customer_oauth_refresh_tokens ─────────────────────────────────────────
CREATE TABLE "customer_oauth_refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL DEFAULT current_tenant_id(),
    "token" TEXT NOT NULL,
    "client_id" VARCHAR(255) NOT NULL,
    "session_id" UUID,
    "user_id" UUID NOT NULL,
    "reference_id" TEXT,
    "authorization_code_id" TEXT,
    "resources" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "requested_user_info_claims" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "revoked" TIMESTAMPTZ,
    "rotated_at" TIMESTAMPTZ,
    "rotation_replay_response" TEXT,
    "rotation_replay_expires_at" TIMESTAMPTZ,
    "auth_time" TIMESTAMPTZ,
    "confirmation" TEXT,

    CONSTRAINT "customer_oauth_refresh_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customer_oauth_refresh_tokens_token_key" ON "customer_oauth_refresh_tokens"("token");
CREATE INDEX "customer_oauth_refresh_tokens_tenant_id_idx" ON "customer_oauth_refresh_tokens"("tenant_id");
CREATE INDEX "customer_oauth_refresh_tokens_client_id_idx" ON "customer_oauth_refresh_tokens"("client_id");
CREATE INDEX "customer_oauth_refresh_tokens_session_id_idx" ON "customer_oauth_refresh_tokens"("session_id");
CREATE INDEX "customer_oauth_refresh_tokens_user_id_idx" ON "customer_oauth_refresh_tokens"("user_id");
CREATE INDEX "customer_oauth_refresh_tokens_authorization_code_id_idx" ON "customer_oauth_refresh_tokens"("authorization_code_id");
ALTER TABLE "customer_oauth_refresh_tokens" ADD CONSTRAINT "customer_oauth_refresh_tokens_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_oauth_refresh_tokens" ADD CONSTRAINT "customer_oauth_refresh_tokens_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "customer_oauth_clients"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_oauth_refresh_tokens" ADD CONSTRAINT "customer_oauth_refresh_tokens_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "customer_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_oauth_refresh_tokens" ADD CONSTRAINT "customer_oauth_refresh_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "customer_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── customer_oauth_access_tokens ──────────────────────────────────────────
CREATE TABLE "customer_oauth_access_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL DEFAULT current_tenant_id(),
    "token" TEXT,
    "client_id" VARCHAR(255) NOT NULL,
    "session_id" UUID,
    "user_id" UUID,
    "reference_id" TEXT,
    "authorization_code_id" TEXT,
    "resources" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "requested_user_info_claims" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "refresh_id" UUID,
    "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "revoked" TIMESTAMPTZ,
    "confirmation" TEXT,

    CONSTRAINT "customer_oauth_access_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customer_oauth_access_tokens_token_key" ON "customer_oauth_access_tokens"("token");
CREATE INDEX "customer_oauth_access_tokens_tenant_id_idx" ON "customer_oauth_access_tokens"("tenant_id");
CREATE INDEX "customer_oauth_access_tokens_client_id_idx" ON "customer_oauth_access_tokens"("client_id");
CREATE INDEX "customer_oauth_access_tokens_session_id_idx" ON "customer_oauth_access_tokens"("session_id");
CREATE INDEX "customer_oauth_access_tokens_user_id_idx" ON "customer_oauth_access_tokens"("user_id");
CREATE INDEX "customer_oauth_access_tokens_authorization_code_id_idx" ON "customer_oauth_access_tokens"("authorization_code_id");
CREATE INDEX "customer_oauth_access_tokens_refresh_id_idx" ON "customer_oauth_access_tokens"("refresh_id");
ALTER TABLE "customer_oauth_access_tokens" ADD CONSTRAINT "customer_oauth_access_tokens_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_oauth_access_tokens" ADD CONSTRAINT "customer_oauth_access_tokens_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "customer_oauth_clients"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_oauth_access_tokens" ADD CONSTRAINT "customer_oauth_access_tokens_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "customer_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_oauth_access_tokens" ADD CONSTRAINT "customer_oauth_access_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "customer_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_oauth_access_tokens" ADD CONSTRAINT "customer_oauth_access_tokens_refresh_id_fkey"
    FOREIGN KEY ("refresh_id") REFERENCES "customer_oauth_refresh_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── customer_oauth_consents ───────────────────────────────────────────────
CREATE TABLE "customer_oauth_consents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL DEFAULT current_tenant_id(),
    "client_id" VARCHAR(255) NOT NULL,
    "user_id" UUID,
    "reference_id" TEXT,
    "resources" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "requested_user_info_claims" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_oauth_consents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "customer_oauth_consents_tenant_id_idx" ON "customer_oauth_consents"("tenant_id");
CREATE INDEX "customer_oauth_consents_client_id_idx" ON "customer_oauth_consents"("client_id");
CREATE INDEX "customer_oauth_consents_user_id_idx" ON "customer_oauth_consents"("user_id");
ALTER TABLE "customer_oauth_consents" ADD CONSTRAINT "customer_oauth_consents_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_oauth_consents" ADD CONSTRAINT "customer_oauth_consents_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "customer_oauth_clients"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_oauth_consents" ADD CONSTRAINT "customer_oauth_consents_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "customer_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── customer_oauth_client_assertions ──────────────────────────────────────
CREATE TABLE "customer_oauth_client_assertions" (
    "id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT current_tenant_id(),
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "customer_oauth_client_assertions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "customer_oauth_client_assertions_tenant_id_idx" ON "customer_oauth_client_assertions"("tenant_id");
CREATE INDEX "customer_oauth_client_assertions_expires_at_idx" ON "customer_oauth_client_assertions"("expires_at");
ALTER TABLE "customer_oauth_client_assertions" ADD CONSTRAINT "customer_oauth_client_assertions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── CUSTOMER RLS: ENABLE + FORCE + tenant_isolation ───────────────────────

ALTER TABLE "customer_jwks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_jwks" FORCE ROW LEVEL SECURITY;
CREATE POLICY "customer_jwks_tenant_isolation" ON "customer_jwks"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());

ALTER TABLE "customer_oauth_clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_oauth_clients" FORCE ROW LEVEL SECURITY;
CREATE POLICY "customer_oauth_clients_tenant_isolation" ON "customer_oauth_clients"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());

ALTER TABLE "customer_oauth_resources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_oauth_resources" FORCE ROW LEVEL SECURITY;
CREATE POLICY "customer_oauth_resources_tenant_isolation" ON "customer_oauth_resources"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());

ALTER TABLE "customer_oauth_client_resources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_oauth_client_resources" FORCE ROW LEVEL SECURITY;
CREATE POLICY "customer_oauth_client_resources_tenant_isolation" ON "customer_oauth_client_resources"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());

ALTER TABLE "customer_oauth_refresh_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_oauth_refresh_tokens" FORCE ROW LEVEL SECURITY;
CREATE POLICY "customer_oauth_refresh_tokens_tenant_isolation" ON "customer_oauth_refresh_tokens"
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

ALTER TABLE "customer_oauth_client_assertions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_oauth_client_assertions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "customer_oauth_client_assertions_tenant_isolation" ON "customer_oauth_client_assertions"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());
