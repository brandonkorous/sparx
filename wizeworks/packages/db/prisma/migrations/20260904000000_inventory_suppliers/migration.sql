-- Inventory supply path (docs/100 P3a): Suppliers + per-variant purchasing detail.
-- The inbound counterpart to warehouses — who stock is purchased FROM. Purchase
-- orders (P3b) and receiving (P3c) build on these. Both tenant-scoped, FORCE RLS
-- with the canonical `tenant_id = current_tenant_id()` policy (current_tenant_id()
-- reads the `app.tenant_id` GUC that withTenant sets). Standalone-usable (no
-- commerce dependency). No backfill — new tables.

-- ── Suppliers ──────────────────────────────────────────────────────────────────
CREATE TABLE inventory_suppliers (
  id            uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          varchar(160) NOT NULL,
  code          varchar(32)  NOT NULL,
  contact_name  varchar(160),
  email         varchar(255),
  phone         varchar(50),
  website       varchar(255),
  line1         varchar(255),
  line2         varchar(255),
  city          varchar(120),
  region        varchar(120),
  postal_code   varchar(32),
  country       varchar(2),
  payment_terms varchar(20),
  lead_time_days int,
  currency      varchar(3)   NOT NULL DEFAULT 'USD',
  notes         text,
  is_active     boolean      NOT NULL DEFAULT true,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  CONSTRAINT inventory_suppliers_tenant_code_unique UNIQUE (tenant_id, code)
);

CREATE INDEX ON inventory_suppliers (tenant_id, is_active);

ALTER TABLE inventory_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_suppliers FORCE  ROW LEVEL SECURITY;
CREATE POLICY inventory_suppliers_tenant_isolation ON inventory_suppliers
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ── Per-variant purchasing detail ──────────────────────────────────────────────
CREATE TABLE inventory_supplier_variants (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id     uuid        NOT NULL REFERENCES inventory_suppliers(id) ON DELETE CASCADE,
  variant_id      uuid        NOT NULL REFERENCES commerce_product_variants(id) ON DELETE CASCADE,
  supplier_sku    varchar(127),
  unit_cost_cents int,
  min_order_qty   int,
  lead_time_days  int,
  is_preferred    boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_supplier_variants_supplier_variant_unique UNIQUE (supplier_id, variant_id)
);

CREATE INDEX ON inventory_supplier_variants (tenant_id, variant_id);
CREATE INDEX ON inventory_supplier_variants (tenant_id, is_preferred);

ALTER TABLE inventory_supplier_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_supplier_variants FORCE  ROW LEVEL SECURITY;
CREATE POLICY inventory_supplier_variants_tenant_isolation ON inventory_supplier_variants
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
