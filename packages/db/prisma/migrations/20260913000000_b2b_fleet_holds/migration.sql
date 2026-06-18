-- B2B inventory consumer (docs/100 P6d): fleet / work-order holds + per-account
-- order-quantity limits. A hold reserves stock against the MASTER inventory for an
-- account's work order before an order exists; the actual allocation is an
-- InventoryReservation (holder_type 'work_order'), so this table is the B2B-specific
-- scoping (account + work-order ref) layered on top. Tenant-scoped, FORCE RLS with
-- the canonical `tenant_id = current_tenant_id()` policy; a CHECK pins the status.

CREATE TABLE b2b_fleet_holds (
  id                  uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  b2b_account_id      uuid         NOT NULL REFERENCES b2b_accounts(id) ON DELETE CASCADE,
  variant_id          uuid         NOT NULL REFERENCES commerce_product_variants(id) ON DELETE CASCADE,
  warehouse_id        uuid         NOT NULL REFERENCES inventory_warehouses(id) ON DELETE CASCADE,
  quantity            int          NOT NULL,
  work_order_ref      varchar(127) NOT NULL,
  note                text,
  status              varchar(20)  NOT NULL DEFAULT 'active',
  reservation_id      uuid,
  held_by_customer_id uuid,
  created_at          timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now(),
  released_at         timestamptz,
  CONSTRAINT b2b_fleet_holds_status_check
    CHECK (status IN ('active', 'released', 'consumed'))
);

CREATE INDEX ON b2b_fleet_holds (tenant_id, b2b_account_id, status);
CREATE INDEX ON b2b_fleet_holds (tenant_id, variant_id, status);

ALTER TABLE b2b_fleet_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_fleet_holds FORCE  ROW LEVEL SECURITY;
CREATE POLICY b2b_fleet_holds_tenant_isolation ON b2b_fleet_holds
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Per-account purchasing limits (additive — null = no limit).
ALTER TABLE b2b_account_product_overrides
  ADD COLUMN min_order_qty int,
  ADD COLUMN max_order_qty int;
