-- Dropship connector framework: suppliers, products, product links, orders
-- docs/14, docs/64 Dropship Ph1

-- ── dropship_suppliers ────────────────────────────────────────────────────────

CREATE TABLE dropship_suppliers (
  id           UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  type         VARCHAR(20)  NOT NULL,   -- csv | dsers | spocket | faire | autods | custom
  credentials  JSONB        NOT NULL DEFAULT '{}',
  status       VARCHAR(20)  NOT NULL DEFAULT 'connecting',
  last_sync_at TIMESTAMPTZ,
  pricing_rule JSONB,
  notes        TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);

CREATE INDEX dropship_suppliers_tenant_status_idx ON dropship_suppliers (tenant_id, status);

ALTER TABLE dropship_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE dropship_suppliers FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON dropship_suppliers
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- ── dropship_products ─────────────────────────────────────────────────────────

CREATE TABLE dropship_products (
  id                  UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id         UUID         NOT NULL REFERENCES dropship_suppliers(id) ON DELETE CASCADE,
  supplier_product_id VARCHAR(255) NOT NULL,

  title               VARCHAR(255) NOT NULL,
  description         TEXT,
  images              JSONB        NOT NULL DEFAULT '[]',
  variants            JSONB        NOT NULL DEFAULT '[]',

  cost_price_cents    INT          NOT NULL,
  msrp_cents          INT,

  raw                 JSONB        NOT NULL DEFAULT '{}',
  imported_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, supplier_id, supplier_product_id)
);

CREATE INDEX dropship_products_tenant_supplier_idx ON dropship_products (tenant_id, supplier_id);

ALTER TABLE dropship_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE dropship_products FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON dropship_products
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- ── dropship_product_links ────────────────────────────────────────────────────

CREATE TABLE dropship_product_links (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id          UUID        NOT NULL REFERENCES commerce_products(id) ON DELETE CASCADE,
  dropship_product_id UUID        NOT NULL REFERENCES dropship_products(id) ON DELETE CASCADE,
  supplier_sku        VARCHAR(255) NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, product_id, dropship_product_id)
);

CREATE INDEX dropship_product_links_tenant_product_idx  ON dropship_product_links (tenant_id, product_id);
CREATE INDEX dropship_product_links_tenant_dsproduct_idx ON dropship_product_links (tenant_id, dropship_product_id);

ALTER TABLE dropship_product_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE dropship_product_links FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON dropship_product_links
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- ── dropship_orders ───────────────────────────────────────────────────────────

CREATE TABLE dropship_orders (
  id                UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id          UUID         NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  supplier_id       UUID         NOT NULL REFERENCES dropship_suppliers(id),
  supplier_order_id VARCHAR(255),

  status            VARCHAR(20)  NOT NULL DEFAULT 'pending',
  tracking_number   VARCHAR(255),
  tracking_url      VARCHAR(2048),
  error_message     TEXT,
  line_items        JSONB        NOT NULL DEFAULT '[]',

  submitted_at      TIMESTAMPTZ,
  shipped_at        TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,

  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX dropship_orders_tenant_status_idx ON dropship_orders (tenant_id, status);
CREATE INDEX dropship_orders_tenant_order_idx  ON dropship_orders (tenant_id, order_id);

ALTER TABLE dropship_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE dropship_orders FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON dropship_orders
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
