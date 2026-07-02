-- MCP OAuth authorization server (docs/07 §5).
--
-- Backs Better Auth's mcp()/oidcProvider plugin so Claude/ChatGPT can connect
-- to mcp.sparx.works via OAuth 2.1 (Dynamic Client Registration + Auth-Code +
-- PKCE). Three tables: registered clients, issued token pairs, recorded
-- consents.
--
-- RLS posture — DELIBERATELY the tightest of any auth table:
--   These rows hold client secrets and bearer access/refresh tokens, and are
--   NOT tenant-scoped (no tenant_id — a client self-registers before any tenant
--   is known; tokens key on user_id). They are touched EXCLUSIVELY by the auth
--   service, which connects as sparx_owner (the table owner) via @sparx/auth's
--   authPrisma. So we ENABLE RLS but do NOT FORCE it and add NO policy: the
--   owner bypasses (non-forced) and can read/write, while sparx_app — the
--   request-handler role — is subject to RLS with no permissive policy and
--   therefore sees ZERO rows. A business-tier bug can never leak an OAuth
--   secret or token. Tenant scope is resolved transitively (user_id →
--   users.tenant_id) in verifyMcpOAuthToken. Mirrors the users/sessions/
--   accounts NO-FORCE decision (20260527162200) but strictly tighter (no policy
--   at all). See packages/db/CLAUDE.md.

-- ─── oauth_applications ────────────────────────────────────────────────────

CREATE TABLE "oauth_applications" (
    "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
    "name"          VARCHAR(255),
    "icon"          TEXT,
    "metadata"      TEXT,
    "client_id"     VARCHAR(255) NOT NULL,
    "client_secret" TEXT,
    "redirect_urls" TEXT         NOT NULL,
    "type"          VARCHAR(32)  NOT NULL,
    "disabled"      BOOLEAN      NOT NULL DEFAULT false,
    "user_id"       UUID,
    "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "oauth_applications_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "oauth_applications" ALTER COLUMN "updated_at" DROP DEFAULT;

CREATE UNIQUE INDEX "oauth_applications_client_id_key" ON "oauth_applications" ("client_id");
CREATE        INDEX "oauth_applications_user_id_idx"   ON "oauth_applications" ("user_id");

ALTER TABLE "oauth_applications" ADD CONSTRAINT "oauth_applications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── oauth_access_tokens ───────────────────────────────────────────────────

CREATE TABLE "oauth_access_tokens" (
    "id"                        UUID        NOT NULL DEFAULT gen_random_uuid(),
    "access_token"              TEXT        NOT NULL,
    "refresh_token"             TEXT        NOT NULL,
    "access_token_expires_at"   TIMESTAMPTZ NOT NULL,
    "refresh_token_expires_at"  TIMESTAMPTZ NOT NULL,
    "client_id"                 VARCHAR(255) NOT NULL,
    "user_id"                   UUID,
    "scopes"                    TEXT        NOT NULL,
    "created_at"                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "oauth_access_tokens_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "oauth_access_tokens" ALTER COLUMN "updated_at" DROP DEFAULT;

CREATE UNIQUE INDEX "oauth_access_tokens_access_token_key"  ON "oauth_access_tokens" ("access_token");
CREATE UNIQUE INDEX "oauth_access_tokens_refresh_token_key" ON "oauth_access_tokens" ("refresh_token");
CREATE        INDEX "oauth_access_tokens_client_id_idx"     ON "oauth_access_tokens" ("client_id");
CREATE        INDEX "oauth_access_tokens_user_id_idx"       ON "oauth_access_tokens" ("user_id");
CREATE        INDEX "oauth_access_tokens_access_token_expires_at_idx"
    ON "oauth_access_tokens" ("access_token_expires_at");

ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "oauth_applications"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── oauth_consents ────────────────────────────────────────────────────────

CREATE TABLE "oauth_consents" (
    "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
    "client_id"     VARCHAR(255) NOT NULL,
    "user_id"       UUID         NOT NULL,
    "scopes"        TEXT         NOT NULL,
    "consent_given" BOOLEAN      NOT NULL,
    "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "oauth_consents_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "oauth_consents" ALTER COLUMN "updated_at" DROP DEFAULT;

CREATE INDEX "oauth_consents_client_id_idx" ON "oauth_consents" ("client_id");
CREATE INDEX "oauth_consents_user_id_idx"   ON "oauth_consents" ("user_id");

ALTER TABLE "oauth_consents" ADD CONSTRAINT "oauth_consents_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "oauth_applications"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_consents" ADD CONSTRAINT "oauth_consents_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── RLS: ENABLE, do NOT FORCE, NO policy ──────────────────────────────────
-- Owner (auth service) bypasses; sparx_app is fenced out completely.

ALTER TABLE "oauth_applications"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "oauth_access_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "oauth_consents"      ENABLE ROW LEVEL SECURITY;
