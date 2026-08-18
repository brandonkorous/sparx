-- sparx.market — the first-party marketplace (docs/106 §4.7, docs/72). Five new
-- tables in two RLS classes + additive product-graph opt-in columns on
-- commerce_products. No backfill — new tables + additive ALTERs (the product
-- columns default for existing rows).
--
--   GLOBAL projections (market_listings, market_merchants): cross-tenant SELECT
--   (the public marketplace reads every tenant) + tenant-scoped write — mirrors
--   channel_shop_links (docs/106 §4.4). No FK relations (a global table + FORCE-RLS
--   cascade interact awkwardly); the channel-sync-worker keeps them consistent.
--
--   TENANT truth (market_merchant_profiles, market_payout_accounts,
--   market_settlements, market_settlement_runs): canonical ENABLE+FORCE RLS +
--   tenant_isolation.

-- ── commerce_products: product-graph opt-in (additive, defaults for existing) ───
ALTER TABLE commerce_products ADD COLUMN market_listed   boolean     NOT NULL DEFAULT false;
ALTER TABLE commerce_products ADD COLUMN market_category varchar(50);
ALTER TABLE commerce_products ADD COLUMN market_featured boolean     NOT NULL DEFAULT false;
ALTER TABLE commerce_products ADD COLUMN market_approved boolean     NOT NULL DEFAULT true;

-- Partial index: the worker + reporting only ever scan opted-in products.
CREATE INDEX commerce_products_market_listed_idx
  ON commerce_products (tenant_id, market_category)
  WHERE market_listed;

-- ── market_listings (GLOBAL projection — the public catalog) ─────────────────────
CREATE TABLE market_listings (
  id                  uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           uuid         NOT NULL,
  product_id          uuid         NOT NULL,
  merchant_slug       varchar(63)  NOT NULL,
  merchant_name       varchar(255) NOT NULL,
  merchant_logo_url   text,
  title               varchar(255) NOT NULL,
  handle              varchar(127) NOT NULL,
  slug                varchar(160) NOT NULL,
  description_snippet varchar(512),
  image_url           text,
  category            varchar(50)  NOT NULL,
  price_min_cents     int,
  price_max_cents     int,
  currency            varchar(3)   NOT NULL DEFAULT 'USD',
  in_stock            boolean      NOT NULL DEFAULT false,
  average_rating      double precision,
  review_count        int          NOT NULL DEFAULT 0,
  featured            boolean      NOT NULL DEFAULT false,
  product_url         text,
  search_text         text,
  published_at        timestamptz,
  created_at          timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT market_listings_product_unique UNIQUE (product_id),
  CONSTRAINT market_listings_slug_unique    UNIQUE (slug)
);

CREATE INDEX market_listings_category_featured_idx ON market_listings (category, featured);
CREATE INDEX market_listings_tenant_idx           ON market_listings (tenant_id);

-- Postgres full-text search (Phase-1 infra rule — no Typesense). A generated
-- tsvector over the denormalized search_text + a GIN index; the marketplace search
-- query is `search_tsv @@ websearch_to_tsquery('english', :q)`.
ALTER TABLE market_listings
  ADD COLUMN search_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(search_text, ''))) STORED;
CREATE INDEX market_listings_search_tsv_idx ON market_listings USING gin (search_tsv);

-- Global-read / tenant-write RLS (mirrors channel_shop_links). SELECT is
-- unconditional (the unauthenticated marketplace reads with no tenant GUC set);
-- writes are pinned to the caller's tenant so one tenant can never clobber
-- another's listing.
ALTER TABLE market_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_listings FORCE  ROW LEVEL SECURITY;

CREATE POLICY market_listings_read ON market_listings
    AS PERMISSIVE FOR SELECT
    USING (true);
CREATE POLICY market_listings_insert ON market_listings
    AS PERMISSIVE FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY market_listings_update ON market_listings
    AS PERMISSIVE FOR UPDATE
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY market_listings_delete ON market_listings
    AS PERMISSIVE FOR DELETE
    USING (tenant_id = current_tenant_id());

-- ── market_merchants (GLOBAL projection — the merchant directory) ────────────────
CREATE TABLE market_merchants (
  id            uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     uuid         NOT NULL,
  slug          varchar(63)  NOT NULL,
  name          varchar(255) NOT NULL,
  logo_url      text,
  banner_url    text,
  bio           varchar(2000),
  location      varchar(160),
  headline      varchar(255),
  site_url      text,
  socials       jsonb        NOT NULL DEFAULT '[]',
  listing_count int          NOT NULL DEFAULT 0,
  featured      boolean      NOT NULL DEFAULT false,
  approved      boolean      NOT NULL DEFAULT true,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT market_merchants_tenant_unique UNIQUE (tenant_id),
  CONSTRAINT market_merchants_slug_unique   UNIQUE (slug)
);

CREATE INDEX market_merchants_featured_idx ON market_merchants (featured);

ALTER TABLE market_merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_merchants FORCE  ROW LEVEL SECURITY;

CREATE POLICY market_merchants_read ON market_merchants
    AS PERMISSIVE FOR SELECT
    USING (true);
CREATE POLICY market_merchants_insert ON market_merchants
    AS PERMISSIVE FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY market_merchants_update ON market_merchants
    AS PERMISSIVE FOR UPDATE
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY market_merchants_delete ON market_merchants
    AS PERMISSIVE FOR DELETE
    USING (tenant_id = current_tenant_id());

-- ── market_merchant_profiles (TENANT truth — editable profile + enable flag) ─────
CREATE TABLE market_merchant_profiles (
  id                      uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id               uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  enabled                 boolean      NOT NULL DEFAULT false,
  bio                     varchar(2000),
  location                varchar(160),
  headline                varchar(255),
  banner_media_id         uuid,
  default_category        varchar(50),
  commission_bps_override int,
  created_at              timestamptz  NOT NULL DEFAULT now(),
  updated_at              timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT market_merchant_profiles_tenant_unique UNIQUE (tenant_id)
);

ALTER TABLE market_merchant_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_merchant_profiles FORCE  ROW LEVEL SECURITY;
CREATE POLICY market_merchant_profiles_tenant_isolation ON market_merchant_profiles
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ── market_payout_accounts (TENANT truth — encrypted ACH bank account) ───────────
CREATE TABLE market_payout_accounts (
  id                  uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_holder_name varchar(255) NOT NULL,
  bank_name           varchar(255),
  routing_number_enc  text         NOT NULL,
  account_number_enc  text         NOT NULL,
  account_last4       varchar(4),
  account_type        varchar(20)  NOT NULL DEFAULT 'checking',
  status              varchar(20)  NOT NULL DEFAULT 'pending',
  created_at          timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT market_payout_accounts_tenant_unique UNIQUE (tenant_id)
);

ALTER TABLE market_payout_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_payout_accounts FORCE  ROW LEVEL SECURITY;
CREATE POLICY market_payout_accounts_tenant_isolation ON market_payout_accounts
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ── market_settlements (TENANT truth — per-order accrual) ────────────────────────
CREATE TABLE market_settlements (
  id               uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id         uuid         NOT NULL,
  -- FK to market_settlement_runs added after that table is created (below).
  run_id           uuid,
  gross_cents      int          NOT NULL,
  commission_bps   int          NOT NULL,
  commission_cents int          NOT NULL,
  refunded_cents   int          NOT NULL DEFAULT 0,
  net_cents        int          NOT NULL,
  currency         varchar(3)   NOT NULL DEFAULT 'USD',
  status           varchar(20)  NOT NULL DEFAULT 'accrued',
  payment_ref      varchar(255),
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT market_settlements_order_unique UNIQUE (order_id)
);

CREATE INDEX market_settlements_tenant_status_idx ON market_settlements (tenant_id, status);
CREATE INDEX market_settlements_run_idx           ON market_settlements (run_id);

ALTER TABLE market_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_settlements FORCE  ROW LEVEL SECURITY;
CREATE POLICY market_settlements_tenant_isolation ON market_settlements
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ── market_settlement_runs (TENANT truth — the weekly ACH batch) ─────────────────
CREATE TABLE market_settlement_runs (
  id                   uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id            uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_start         timestamptz  NOT NULL,
  period_end           timestamptz  NOT NULL,
  gross_cents          int          NOT NULL,
  commission_cents     int          NOT NULL,
  refund_cents         int          NOT NULL DEFAULT 0,
  net_cents            int          NOT NULL,
  order_count          int          NOT NULL DEFAULT 0,
  currency             varchar(3)   NOT NULL DEFAULT 'USD',
  status               varchar(20)  NOT NULL DEFAULT 'pending',
  disbursement_provider varchar(40),
  disbursement_ref     varchar(255),
  failure_reason       text,
  report_email_sent_at timestamptz,
  paid_at              timestamptz,
  created_at           timestamptz  NOT NULL DEFAULT now(),
  updated_at           timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX market_settlement_runs_tenant_status_idx ON market_settlement_runs (tenant_id, status);
CREATE INDEX market_settlement_runs_tenant_period_idx ON market_settlement_runs (tenant_id, period_end);

ALTER TABLE market_settlement_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_settlement_runs FORCE  ROW LEVEL SECURITY;
CREATE POLICY market_settlement_runs_tenant_isolation ON market_settlement_runs
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- market_settlements.run_id → market_settlement_runs (deferred: the accrual table
-- is created first, but each accrual points back at the weekly run once settled).
ALTER TABLE market_settlements
  ADD CONSTRAINT market_settlements_run_id_fkey
  FOREIGN KEY (run_id) REFERENCES market_settlement_runs(id) ON DELETE SET NULL;
