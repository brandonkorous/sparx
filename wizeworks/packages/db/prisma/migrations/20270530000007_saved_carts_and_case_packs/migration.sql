-- Saved carts and case packs for trade accounts (sparx persona issue 086).
--
-- The /b2b page promised named saved carts and case packs per product per
-- account. Neither existed. A saved cart is a named list kept for the account
-- (not a second live cart, so the cart pipeline never mistakes one for the
-- shopper's open cart); it keeps no prices. A case pack is the multiple an
-- account must buy a variant in. Tenant-scoped, FORCE RLS with the canonical
-- `tenant_id = current_tenant_id()` policy.

CREATE TABLE b2b_saved_carts (
  id                     uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id              uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE,
  company_id             uuid         NOT NULL REFERENCES companies(id) ON DELETE CASCADE ON UPDATE CASCADE,
  name                   varchar(120) NOT NULL,
  created_by_customer_id uuid         REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE,
  created_at             timestamptz  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             timestamptz  NOT NULL
);

CREATE INDEX b2b_saved_carts_tenant_id_company_id_updated_at_idx
  ON b2b_saved_carts (tenant_id, company_id, updated_at DESC);

CREATE TABLE b2b_saved_cart_items (
  id            uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE,
  saved_cart_id uuid NOT NULL REFERENCES b2b_saved_carts(id) ON DELETE CASCADE ON UPDATE CASCADE,
  variant_id    uuid NOT NULL REFERENCES commerce_product_variants(id) ON DELETE CASCADE ON UPDATE CASCADE,
  quantity      int  NOT NULL,
  position      int  NOT NULL DEFAULT 0,
  CONSTRAINT b2b_saved_cart_items_quantity_check CHECK (quantity > 0)
);

CREATE UNIQUE INDEX b2b_saved_cart_items_saved_cart_id_variant_id_key
  ON b2b_saved_cart_items (saved_cart_id, variant_id);
CREATE INDEX b2b_saved_cart_items_tenant_id_saved_cart_id_idx
  ON b2b_saved_cart_items (tenant_id, saved_cart_id);

ALTER TABLE b2b_saved_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_saved_carts FORCE  ROW LEVEL SECURITY;
CREATE POLICY b2b_saved_carts_tenant_isolation ON b2b_saved_carts
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE b2b_saved_cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_saved_cart_items FORCE  ROW LEVEL SECURITY;
CREATE POLICY b2b_saved_cart_items_tenant_isolation ON b2b_saved_cart_items
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Case pack (additive; null = any quantity).
ALTER TABLE b2b_account_product_overrides
  ADD COLUMN order_multiple int,
  ADD CONSTRAINT b2b_account_product_overrides_order_multiple_check
    CHECK (order_multiple IS NULL OR order_multiple > 0);
