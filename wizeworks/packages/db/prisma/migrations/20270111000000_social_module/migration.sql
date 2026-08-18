-- Social posting module (docs/133, build plan docs/134 Slice 1) — four new
-- tenant-scoped tables, all FORCE RLS with the canonical tenant_isolation policy.
--
--   social_connections  — the per-(tenant, site, platform) OAuth grant to one
--                         connected account. Access/refresh tokens are AES-256-GCM
--                         ciphertext (never plaintext), boxed via @sparx/social
--                         with SOCIAL_TOKEN_KEY.
--   social_targets       — a destination under a connection (a Facebook Page, GBP
--                         location, LinkedIn org). Inherits its site from the
--                         connection (no property_id).
--   social_posts         — the composed, platform-agnostic post + its
--                         draft→approve→schedule→publish lifecycle. Per-site.
--   social_post_targets  — the fan-out join (one row per target a post publishes
--                         to) carrying the per-channel override + per-target result.
--                         social_target_id is FK-LESS on purpose: the published
--                         permalink is permanent history that must survive a later
--                         account disconnect (which cascades the target away).
--
-- No backfill — new tables only. The scheduled-drain SECURITY DEFINER function
-- (find_due_social_posts) lands with Slice 5, not here.

-- ── social_connections ──────────────────────────────────────────────────────────
CREATE TABLE social_connections (
  id                 uuid           NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id          uuid           NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id        uuid           REFERENCES properties(id) ON DELETE CASCADE,
  platform           varchar(40)    NOT NULL,
  status             varchar(20)    NOT NULL DEFAULT 'active',
  external_id        varchar(255),
  display_name       varchar(255),
  avatar_url         text,
  access_token_enc   text,
  refresh_token_enc  text,
  token_expires_at   timestamptz,
  scopes             varchar(120)[] NOT NULL DEFAULT '{}',
  last_error         jsonb,
  metadata           jsonb          NOT NULL DEFAULT '{}',
  created_at         timestamptz    NOT NULL DEFAULT now(),
  updated_at         timestamptz    NOT NULL DEFAULT now()
);

-- One connection per platform per SITE. NULLS NOT DISTINCT is load-bearing: Postgres
-- treats NULLs as distinct by default, so a plain compound unique would let unlimited
-- (tenant, NULL, 'instagram') tenant-wide rows coexist. Prisma cannot express the
-- modifier, so the schema declares a plain @@unique and THIS index is the real
-- constraint (matches the channels pattern). Postgres 15+ (we are on 18).
CREATE UNIQUE INDEX "social_connections_tenant_property_platform_unique"
    ON social_connections (tenant_id, property_id, platform) NULLS NOT DISTINCT;

CREATE INDEX ON social_connections (tenant_id, status);
CREATE INDEX ON social_connections (tenant_id, property_id);

ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_connections FORCE  ROW LEVEL SECURITY;
CREATE POLICY social_connections_tenant_isolation ON social_connections
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ── social_targets ───────────────────────────────────────────────────────────────
CREATE TABLE social_targets (
  id                 uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id          uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id      uuid        NOT NULL REFERENCES social_connections(id) ON DELETE CASCADE,
  platform           varchar(40) NOT NULL,
  external_target_id varchar(255) NOT NULL,
  name               varchar(255) NOT NULL,
  avatar_url         text,
  enabled            boolean     NOT NULL DEFAULT true,
  metadata           jsonb       NOT NULL DEFAULT '{}',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_targets_connection_external_unique UNIQUE (connection_id, external_target_id)
);

CREATE INDEX ON social_targets (tenant_id, platform);
CREATE INDEX ON social_targets (connection_id);

ALTER TABLE social_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_targets FORCE  ROW LEVEL SECURITY;
CREATE POLICY social_targets_tenant_isolation ON social_targets
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ── social_posts ─────────────────────────────────────────────────────────────────
CREATE TABLE social_posts (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id     uuid        REFERENCES properties(id) ON DELETE CASCADE,
  body            text        NOT NULL,
  link            text,
  media_asset_ids uuid[]      NOT NULL DEFAULT '{}',
  status          varchar(24) NOT NULL DEFAULT 'draft',
  source          varchar(20) NOT NULL DEFAULT 'manual',
  source_ref      varchar(255),
  scheduled_at    timestamptz,
  published_at    timestamptz,
  approved_by_id  uuid,
  approved_at     timestamptz,
  created_by_id   uuid,
  metadata        jsonb       NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON social_posts (tenant_id, status);
CREATE INDEX ON social_posts (tenant_id, property_id);
-- Drives the Slice 5 scheduled drain's cross-tenant scan
-- (status = 'scheduled' AND scheduled_at <= now()).
CREATE INDEX ON social_posts (status, scheduled_at);

ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts FORCE  ROW LEVEL SECURITY;
CREATE POLICY social_posts_tenant_isolation ON social_posts
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ── social_post_targets ──────────────────────────────────────────────────────────
CREATE TABLE social_post_targets (
  id               uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  post_id          uuid        NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  -- FK-LESS on purpose (permalink history must survive target disconnect).
  social_target_id uuid        NOT NULL,
  target_name      varchar(255) NOT NULL,
  platform         varchar(40) NOT NULL,
  text_override    text,
  media_override   jsonb,
  first_comment    text,
  status           varchar(20) NOT NULL DEFAULT 'pending',
  external_id      varchar(255),
  permalink        text,
  error            text,
  attempt_count    int         NOT NULL DEFAULT 0,
  published_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_post_targets_post_target_unique UNIQUE (post_id, social_target_id)
);

CREATE INDEX ON social_post_targets (tenant_id, status);
CREATE INDEX ON social_post_targets (post_id);

ALTER TABLE social_post_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_post_targets FORCE  ROW LEVEL SECURITY;
CREATE POLICY social_post_targets_tenant_isolation ON social_post_targets
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
