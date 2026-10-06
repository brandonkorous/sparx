-- A rebuilt part carries a core deposit (sparx persona issue 051).
--
-- A core charge is a refundable deposit on a remanufactured part: the buyer pays
-- it on top of the price and gets it back when the old part (the "core") comes
-- back. It is set per variant, snapshot onto each cart line like the price, and
-- carried on the PART's own order and invoice line, so picking, stock and sales
-- figures never mistake a deposit for an item. Totals keep it apart: never in a
-- subtotal, never taxed or discounted, always in what was paid.
--
-- Columns only. Every table here already carries tenant_id under FORCE RLS, and
-- a new column inherits the row's policy. No backfill: null and 0 mean "no core".

ALTER TABLE "commerce_product_variants"
  ADD COLUMN "core_charge_cents" INTEGER,
  ADD CONSTRAINT "commerce_product_variants_core_charge_check"
    CHECK ("core_charge_cents" IS NULL OR "core_charge_cents" > 0);

ALTER TABLE "commerce_cart_items"
  ADD COLUMN "core_charge_cents" INTEGER,
  ADD CONSTRAINT "commerce_cart_items_core_charge_check"
    CHECK ("core_charge_cents" IS NULL OR "core_charge_cents" > 0);

ALTER TABLE "commerce_carts"
  ADD COLUMN "core_charge_total_cents" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "commerce_checkout_sessions"
  ADD COLUMN "core_charge_total_cents" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "orders"
  ADD COLUMN "core_charge_total" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "order_items"
  ADD COLUMN "core_charge" DECIMAL(12,2),
  ADD COLUMN "cores_returned" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "cores_kept" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "order_items_core_charge_check"
    CHECK ("core_charge" IS NULL OR "core_charge" > 0),
  -- A unit's core ends one way: the part came back, the core came back, or the
  -- deposit was kept. Together they never exceed what was bought.
  ADD CONSTRAINT "order_items_core_outcomes_check"
    CHECK ("cores_returned" >= 0 AND "cores_kept" >= 0
           AND "quantity_refunded" + "cores_returned" + "cores_kept" <= "quantity");

ALTER TABLE "billing_documents"
  ADD COLUMN "core_charge_total" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "billing_document_lines"
  ADD COLUMN "core_charge" DECIMAL(12,2),
  ADD CONSTRAINT "billing_document_lines_core_charge_check"
    CHECK ("core_charge" IS NULL OR "core_charge" > 0);

-- "Which cores are still owed?" reads open core lines across a business.
CREATE INDEX "order_items_core_owed_idx"
  ON "order_items" ("tenant_id")
  WHERE "core_charge" IS NOT NULL;
