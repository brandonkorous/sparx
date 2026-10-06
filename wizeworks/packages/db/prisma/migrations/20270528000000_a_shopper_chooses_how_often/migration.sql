-- A shopper can ask for a product on repeat (issue 739).
--
-- Two facts the platform had nowhere to keep:
--
--   1. Which cadences the OWNER offers on a product. `fulfillment_type =
--      'subscription'` is a label nothing in commerce reads, and it says nothing
--      about how often. An empty array is "bought once only", which is almost
--      every product, so it is the default and no row needs a backfill.
--   2. Which cadence the SHOPPER chose on a cart line. Both columns null means
--      bought once; both set means deliver it again on that schedule. Half of
--      one is a line that cannot be placed, so the database refuses it.
--
-- Columns only. Both tables already carry tenant_id under FORCE RLS, and a new
-- column inherits the row's policy.

ALTER TABLE "commerce_products"
    ADD COLUMN "repeat_options" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "commerce_cart_items"
    ADD COLUMN "repeat_interval_unit"  VARCHAR(10),
    ADD COLUMN "repeat_interval_count" INTEGER;

ALTER TABLE "commerce_cart_items"
    ADD CONSTRAINT "commerce_cart_items_repeat_whole"
    CHECK (("repeat_interval_unit" IS NULL) = ("repeat_interval_count" IS NULL));

ALTER TABLE "commerce_cart_items"
    ADD CONSTRAINT "commerce_cart_items_repeat_unit"
    CHECK ("repeat_interval_unit" IS NULL OR "repeat_interval_unit" IN ('week', 'month'));

ALTER TABLE "commerce_cart_items"
    ADD CONSTRAINT "commerce_cart_items_repeat_count"
    CHECK ("repeat_interval_count" IS NULL OR "repeat_interval_count" BETWEEN 1 AND 12);
