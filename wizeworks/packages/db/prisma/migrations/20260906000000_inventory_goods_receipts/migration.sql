-- Inventory supply path (docs/100 P3c): Goods receipts + lines. Booking goods
-- against a submitted PO — each line writes a `receive` movement through the
-- ledger (moving-average cost) and advances the PO to partial/received. Both
-- tenant-scoped, FORCE RLS with the canonical `tenant_id = current_tenant_id()`
-- policy. Standalone-usable. No backfill — new tables.

-- ── Goods receipts ──────────────────────────────────────────────────────────────
CREATE TABLE inventory_goods_receipts (
  id                uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  number            varchar(20)  NOT NULL,
  purchase_order_id uuid         NOT NULL REFERENCES inventory_purchase_orders(id) ON DELETE CASCADE,
  warehouse_id      uuid         NOT NULL REFERENCES inventory_warehouses(id) ON DELETE CASCADE,
  reference         varchar(120),
  note              text,
  received_at       timestamptz  NOT NULL DEFAULT now(),
  created_at        timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT inventory_goods_receipts_tenant_number_unique UNIQUE (tenant_id, number)
);

CREATE INDEX ON inventory_goods_receipts (tenant_id, purchase_order_id);

ALTER TABLE inventory_goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_goods_receipts FORCE  ROW LEVEL SECURITY;
CREATE POLICY inventory_goods_receipts_tenant_isolation ON inventory_goods_receipts
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ── Goods receipt lines ─────────────────────────────────────────────────────────
CREATE TABLE inventory_goods_receipt_lines (
  id                     uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id              uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  goods_receipt_id       uuid         NOT NULL REFERENCES inventory_goods_receipts(id) ON DELETE CASCADE,
  purchase_order_line_id uuid         NOT NULL REFERENCES inventory_purchase_order_lines(id) ON DELETE CASCADE,
  variant_id             uuid         NOT NULL REFERENCES commerce_product_variants(id) ON DELETE CASCADE,
  quantity_received      int          NOT NULL,
  unit_cost_cents        int          NOT NULL,
  lot_number             varchar(63),
  movement_id            uuid,
  created_at             timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX ON inventory_goods_receipt_lines (tenant_id, purchase_order_line_id);
CREATE INDEX ON inventory_goods_receipt_lines (tenant_id, variant_id);

ALTER TABLE inventory_goods_receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_goods_receipt_lines FORCE  ROW LEVEL SECURITY;
CREATE POLICY inventory_goods_receipt_lines_tenant_isolation ON inventory_goods_receipt_lines
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
