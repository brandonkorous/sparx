-- An old part can come first (sparx persona issue 057).
--
-- A rebuilt part is bought one of two ways. The buyer pays a core deposit and the
-- part ships now (issue 051), or the buyer sends the old part (the "core") FIRST,
-- pays no deposit, and the part ships when the old one arrives. Gillett Diesel
-- sells half of its 84 rebuilt parts the second way.
--
--   variant.core_first_offered    this part may be bought the second way
--   cart line / order line        core_first: this line was bought that way
--   order line                    core_hold_released_at: the business chose to ship
--                                 it before the old part arrived
--
-- A send-first line carries no deposit, by definition: the checks say so, so no
-- writer can charge one and hold the goods as well.
--
-- Columns only. Every table here already carries tenant_id under FORCE RLS, and a
-- new column inherits the row's policy. Defaults are false/null: nothing that
-- exists today was bought the second way.

ALTER TABLE "commerce_product_variants"
  ADD COLUMN "core_first_offered" BOOLEAN NOT NULL DEFAULT false,
  ADD CONSTRAINT "commerce_product_variants_core_first_check"
    CHECK (NOT "core_first_offered" OR "core_charge_cents" IS NOT NULL);

ALTER TABLE "commerce_cart_items"
  ADD COLUMN "core_first" BOOLEAN NOT NULL DEFAULT false,
  ADD CONSTRAINT "commerce_cart_items_core_first_check"
    CHECK (NOT "core_first" OR "core_charge_cents" IS NULL);

ALTER TABLE "order_items"
  ADD COLUMN "core_first" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "core_hold_released_at" TIMESTAMPTZ,
  ADD CONSTRAINT "order_items_core_first_check"
    CHECK (NOT "core_first" OR "core_charge" IS NULL),
  ADD CONSTRAINT "order_items_core_hold_release_check"
    CHECK ("core_hold_released_at" IS NULL OR "core_first");

-- "Which old parts are we waiting for?" reads send-first lines across a business,
-- beside the deposit lines the 051 index already covers.
CREATE INDEX "order_items_core_first_idx"
  ON "order_items" ("tenant_id")
  WHERE "core_first";
