-- Inventory transfers (docs/100 P4): move stock between warehouses through an
-- in-transit holding location. A transfer is composed as a draft (lines), shipped
-- (`transfer_out` source + `transfer_in` to the system in-transit warehouse), then
-- received (in-transit → destination); cancelling an in-transit transfer returns
-- the goods to source. Every leg funnels through the movement ledger so
-- `onHand == Σ(movements.delta)` holds across all three locations.
--
-- Also adds `is_system` to inventory_warehouses to flag the per-tenant in-transit
-- location so it stays out of the ordinary warehouse pickers/list.
-- Both new tables are tenant-scoped, FORCE RLS with the canonical
-- `tenant_id = current_tenant_id()` policy; a CHECK pins the status vocabulary.

-- ── System-warehouse flag ─────────────────────────────────────────────────────────
ALTER TABLE inventory_warehouses
  ADD COLUMN is_system boolean NOT NULL DEFAULT false;

-- ── Transfers ─────────────────────────────────────────────────────────────────────
CREATE TABLE inventory_transfers (
  id                uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  number            varchar(20)  NOT NULL,
  from_warehouse_id uuid         NOT NULL REFERENCES inventory_warehouses(id) ON DELETE CASCADE,
  to_warehouse_id   uuid         NOT NULL REFERENCES inventory_warehouses(id) ON DELETE CASCADE,
  status            varchar(12)  NOT NULL DEFAULT 'draft',
  note              text,
  shipped_at        timestamptz,
  shipped_by        varchar(127),
  received_at       timestamptz,
  received_by       varchar(127),
  cancelled_at      timestamptz,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT inventory_transfers_tenant_number_unique UNIQUE (tenant_id, number),
  CONSTRAINT inventory_transfers_status_check
    CHECK (status IN ('draft', 'in_transit', 'received', 'cancelled'))
);

CREATE INDEX ON inventory_transfers (tenant_id, status);
CREATE INDEX ON inventory_transfers (tenant_id, from_warehouse_id);
CREATE INDEX ON inventory_transfers (tenant_id, to_warehouse_id);

ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfers FORCE  ROW LEVEL SECURITY;
CREATE POLICY inventory_transfers_tenant_isolation ON inventory_transfers
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ── Transfer lines ────────────────────────────────────────────────────────────────
CREATE TABLE inventory_transfer_lines (
  id                  uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transfer_id         uuid         NOT NULL REFERENCES inventory_transfers(id) ON DELETE CASCADE,
  variant_id          uuid         NOT NULL REFERENCES commerce_product_variants(id) ON DELETE CASCADE,
  quantity            int          NOT NULL,
  received_quantity   int,
  ship_movement_id    uuid,
  receive_movement_id uuid,
  note                text,
  created_at          timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT inventory_transfer_lines_transfer_variant_unique UNIQUE (transfer_id, variant_id)
);

CREATE INDEX ON inventory_transfer_lines (tenant_id, transfer_id);
CREATE INDEX ON inventory_transfer_lines (tenant_id, variant_id);

ALTER TABLE inventory_transfer_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfer_lines FORCE  ROW LEVEL SECURITY;
CREATE POLICY inventory_transfer_lines_tenant_isolation ON inventory_transfer_lines
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
