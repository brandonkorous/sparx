-- Channels framework (docs/106 P0) — external sales-channel + sparx.market
-- integration spine. Two new tenant-scoped tables (channel_connections,
-- channel_product_mappings, both FORCE RLS with the canonical tenant_isolation
-- policy) + additive `orders` columns for channel-order linkage + a `shape`
-- discriminator on marketplace_integrations so a channel listing routes to
-- "Add channel" instead of the provider "Connect" flow (docs/88 §3).
--
-- No backfill — new tables + additive ALTERs. The order columns are NULL for
-- existing rows; `shape` defaults `provider_adapter` for existing listings.

-- ── channel_connections ─────────────────────────────────────────────────────────
CREATE TABLE channel_connections (
  id                uuid          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         uuid          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel           varchar(40)   NOT NULL,
  status            varchar(20)   NOT NULL DEFAULT 'active',
  external_id       varchar(255),
  shop_name         varchar(255),
  access_token_ref  varchar(512),
  refresh_token_ref varchar(512),
  token_expires_at  timestamptz,
  scopes            varchar(80)[] NOT NULL DEFAULT '{}',
  last_synced_at    timestamptz,
  sync_errors       jsonb         NOT NULL DEFAULT '[]',
  metadata          jsonb         NOT NULL DEFAULT '{}',
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT channel_connections_tenant_channel_unique UNIQUE (tenant_id, channel)
);

CREATE INDEX ON channel_connections (tenant_id, status);

ALTER TABLE channel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_connections FORCE  ROW LEVEL SECURITY;
CREATE POLICY channel_connections_tenant_isolation ON channel_connections
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ── channel_product_mappings ────────────────────────────────────────────────────
CREATE TABLE channel_product_mappings (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id       uuid        NOT NULL REFERENCES channel_connections(id) ON DELETE CASCADE,
  channel             varchar(40) NOT NULL,
  product_id          uuid        NOT NULL REFERENCES commerce_products(id) ON DELETE CASCADE,
  variant_id          uuid        NOT NULL REFERENCES commerce_product_variants(id) ON DELETE CASCADE,
  external_product_id varchar(255),
  external_variant_id varchar(255),
  external_sku        varchar(255),
  sync_enabled        boolean     NOT NULL DEFAULT true,
  last_synced_at      timestamptz,
  sync_error          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT channel_product_mappings_connection_variant_unique UNIQUE (connection_id, variant_id)
);

CREATE INDEX ON channel_product_mappings (tenant_id, channel, product_id);
CREATE INDEX ON channel_product_mappings (tenant_id, channel, external_sku);
CREATE INDEX ON channel_product_mappings (connection_id);

ALTER TABLE channel_product_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_product_mappings FORCE  ROW LEVEL SECURITY;
CREATE POLICY channel_product_mappings_tenant_isolation ON channel_product_mappings
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ── orders: channel-order linkage (additive, NULL for existing rows) ────────────
ALTER TABLE orders ADD COLUMN external_id       varchar(255);
ALTER TABLE orders ADD COLUMN external_status   varchar(50);
ALTER TABLE orders ADD COLUMN channel_fee_cents int;

CREATE INDEX ON orders (tenant_id, channel, external_id);

-- ── marketplace_integrations: shape discriminator (docs/88 §3) ──────────────────
ALTER TABLE marketplace_integrations
  ADD COLUMN shape varchar(40) NOT NULL DEFAULT 'provider_adapter';
