-- Inventory supply path (docs/100 P3b): Purchase Orders + lines. The inbound
-- order — a commitment to buy stock from a supplier, received into a warehouse
-- (receiving lands in P3c). Both tenant-scoped, FORCE RLS with the canonical
-- `tenant_id = current_tenant_id()` policy (current_tenant_id() reads the
-- `app.tenant_id` GUC that withTenant sets). Standalone-usable (no commerce
-- dependency). No backfill — new tables.

-- ── Purchase orders ─────────────────────────────────────────────────────────────
CREATE TABLE inventory_purchase_orders (
  id                  uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  number              varchar(20)  NOT NULL,
  supplier_id         uuid         NOT NULL REFERENCES inventory_suppliers(id) ON DELETE CASCADE,
  warehouse_id        uuid         NOT NULL REFERENCES inventory_warehouses(id) ON DELETE CASCADE,
  status              varchar(20)  NOT NULL DEFAULT 'draft',
  currency            varchar(3)   NOT NULL DEFAULT 'USD',
  payment_terms       varchar(20),
  reference           varchar(120),
  ordered_at          timestamptz,
  expected_arrival_at timestamptz,
  received_at         timestamptz,
  subtotal_cents      int          NOT NULL DEFAULT 0,
  shipping_cents      int          NOT NULL DEFAULT 0,
  total_cents         int          NOT NULL DEFAULT 0,
  notes               text,
  created_at          timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT inventory_purchase_orders_tenant_number_unique UNIQUE (tenant_id, number),
  CONSTRAINT inventory_purchase_orders_status_check
    CHECK (status IN ('draft', 'submitted', 'partial', 'received', 'closed', 'cancelled'))
);

CREATE INDEX ON inventory_purchase_orders (tenant_id, status);
CREATE INDEX ON inventory_purchase_orders (tenant_id, supplier_id);

ALTER TABLE inventory_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_purchase_orders FORCE  ROW LEVEL SECURITY;
CREATE POLICY inventory_purchase_orders_tenant_isolation ON inventory_purchase_orders
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ── Purchase order lines ────────────────────────────────────────────────────────
CREATE TABLE inventory_purchase_order_lines (
  id                uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  purchase_order_id uuid         NOT NULL REFERENCES inventory_purchase_orders(id) ON DELETE CASCADE,
  variant_id        uuid         NOT NULL REFERENCES commerce_product_variants(id) ON DELETE CASCADE,
  description       varchar(255),
  supplier_sku      varchar(127),
  quantity_ordered  int          NOT NULL,
  quantity_received int          NOT NULL DEFAULT 0,
  unit_cost_cents   int          NOT NULL,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT inventory_po_lines_po_variant_unique UNIQUE (purchase_order_id, variant_id)
);

CREATE INDEX ON inventory_purchase_order_lines (tenant_id, variant_id);

ALTER TABLE inventory_purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_purchase_order_lines FORCE  ROW LEVEL SECURITY;
CREATE POLICY inventory_po_lines_tenant_isolation ON inventory_purchase_order_lines
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
