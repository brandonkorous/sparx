-- Channels shop directory (docs/106 §4.4, P2) — a GLOBAL shop_id → tenant routing
-- table so an order channel's app-level webhook (ONE callback URL shared by every
-- tenant, e.g. TikTok Shop) can resolve which tenant + connection a payload's
-- shop_id belongs to, with no session.
--
-- The secret-bearing channel_connections table stays strictly tenant-isolated
-- (FORCE RLS, tenant_isolation). This directory carries NO secrets, so it is
-- global-READ (the unauthenticated webhook reads any row) but tenant-scoped WRITE
-- (a tenant may only insert/update/delete its own rows). This mirrors how the
-- Stripe webhook resolves the tenant via the global tenants.stripe_account_id.
--
-- New table only — no backfill.

CREATE TABLE channel_shop_links (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel       varchar(40) NOT NULL,
  external_id   varchar(255) NOT NULL,
  tenant_id     uuid        NOT NULL,
  connection_id uuid        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT channel_shop_links_channel_external_unique UNIQUE (channel, external_id)
);

CREATE INDEX ON channel_shop_links (tenant_id);

-- Global-read / tenant-write RLS. SELECT is unconditional (the webhook resolves
-- the tenant before any tenant GUC is set); writes are pinned to the caller's
-- tenant so one tenant can never claim/clobber another's shop routing.
ALTER TABLE channel_shop_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_shop_links FORCE  ROW LEVEL SECURITY;

CREATE POLICY channel_shop_links_read ON channel_shop_links
    AS PERMISSIVE FOR SELECT
    USING (true);

CREATE POLICY channel_shop_links_insert ON channel_shop_links
    AS PERMISSIVE FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY channel_shop_links_update ON channel_shop_links
    AS PERMISSIVE FOR UPDATE
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY channel_shop_links_delete ON channel_shop_links
    AS PERMISSIVE FOR DELETE
    USING (tenant_id = current_tenant_id());
