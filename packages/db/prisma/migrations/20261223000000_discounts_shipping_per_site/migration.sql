-- Per-SITE discounts and shipping (docs/131 §4).
--
-- Both are money a customer sees at checkout, and both leaked across businesses:
-- a "20% off donuts" promo code applied at a machine-shop checkout is money
-- given away by a business that never ran the promotion, and a donut shop's
-- 15-mile delivery rates quoted on a freight parts order is a price nobody can
-- honour.
--
-- TWO DIFFERENT PATTERNS here, and the difference is the point:
--
--   · DISCOUNTS get a JUNCTION (§2 pattern 3). A promotion genuinely can run on
--     several sites — an owner's whole-portfolio sale is ONE promotion, and
--     forcing N copies means N things to expire, amend, and get out of sync.
--   · SHIPPING ZONES/PROFILES get a nullable COLUMN (§2 pattern 1). A delivery
--     footprint belongs to one business's logistics; the shared case is a single
--     warehouse serving everything, which null expresses directly.
--
-- Neither needs a backfill or a FORCE-RLS loop. The junction is empty (= all
-- sites, the ProductProperty convention) and the columns default NULL (= all
-- sites), so every existing row keeps behaving exactly as it does today. This is
-- the whole reason those two conventions were chosen in §2.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Discounts — junction, empty means all
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE "commerce_discount_properties" (
    "property_id" UUID NOT NULL,
    "discount_id" UUID NOT NULL,
    CONSTRAINT "commerce_discount_properties_pkey" PRIMARY KEY ("property_id", "discount_id")
);

-- Cascade on BOTH sides, exactly like commerce_product_properties: this table
-- holds no facts of its own, only the association. Deleting either end deletes
-- the link and nothing else.
ALTER TABLE "commerce_discount_properties"
    ADD CONSTRAINT "commerce_discount_properties_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;
ALTER TABLE "commerce_discount_properties"
    ADD CONSTRAINT "commerce_discount_properties_discount_id_fkey"
    FOREIGN KEY ("discount_id") REFERENCES "commerce_discounts"("id") ON DELETE CASCADE;

CREATE INDEX "commerce_discount_properties_discount_id_idx"
    ON "commerce_discount_properties"("discount_id");

-- NO tenant_id and NO RLS policy on this table — deliberate, and it mirrors
-- commerce_product_properties exactly. Tenant scoping rides the FK parents: a
-- row can only exist between a property and a discount, and both of those are
-- FORCE RLS on tenant_id, so an association across tenants is unconstructible.
-- Adding tenant_id here would be a third copy of a fact the two parents already
-- agree on, with nothing keeping it honest.

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Shipping zones + profiles — nullable column, null means all
--
-- NOTE: commerce_shipping_rates gets NO column. A rate exists only at the
-- intersection of a zone and a profile, both scoped above, so it is already
-- unreachable from a site that cannot reach its zone. A column there would be a
-- second source of truth able to contradict the first — a rate claiming one site
-- while its zone claims another has no defined meaning.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE "commerce_shipping_zones"    ADD COLUMN "property_id" UUID;
ALTER TABLE "commerce_shipping_profiles" ADD COLUMN "property_id" UUID;

-- Cascade: a delivery footprint drawn for one business goes with it. SetNull
-- would PROMOTE it to every remaining site — quoting a closed business's rates
-- on live carts, which is worse than having no rate at all.
ALTER TABLE "commerce_shipping_zones"
    ADD CONSTRAINT "commerce_shipping_zones_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;
ALTER TABLE "commerce_shipping_profiles"
    ADD CONSTRAINT "commerce_shipping_profiles_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;

CREATE INDEX "commerce_shipping_zones_tenant_property_priority_idx"
    ON "commerce_shipping_zones"("tenant_id", "property_id", "priority");
CREATE INDEX "commerce_shipping_profiles_tenant_property_idx"
    ON "commerce_shipping_profiles"("tenant_id", "property_id");
