-- Per-site pricing (docs/131 §4). Working through the pricing family model by model,
-- only ONE of the three genuinely decomposes per-site:
--
--   · PriceList  → PER-SITE via a JUNCTION (below). A price list is a commercial
--     targeting rule an owner can run across a same-catalog portfolio (like Discount),
--     so "sites A and B but not C" must be expressible — a column can't. It is resolved
--     per (variant, site, customer) at read/cart time, so the site genuinely changes
--     the price. Empty links = every site (the ProductProperty convention, zero backfill).
--
--   · MarkupRule → TENANT-WIDE (no change). A catalog markup writes a VARIANT's single
--     shared list price; a variant can't hold two per-site prices, so per-site markup is
--     incoherent. The per-site price difference is PriceList's job.
--
--   · SurchargeRule → TENANT-WIDE (no change). A card-fee pass-through rides per-TENANT
--     payment processing (one merchant account); its paymentMethods/appliesTo axes
--     differentiate it, not the site.
--
-- Charge-critical enforcement (the only slice here that changes what a customer is
-- CHARGED) lives in resolve()'s applicable-price-list lookup (pricing-service.ts
-- pickEligiblePriceList): `propertyLinks none OR some(site)`, with `propertyId` threaded
-- from PriceResolutionRequest / resolveCart. No tenant_id on the junction — tenant
-- scoping rides the FK parents, exactly like commerce_discount_properties, so NO RLS.

CREATE TABLE "commerce_price_list_properties" (
    "property_id"   UUID NOT NULL,
    "price_list_id" UUID NOT NULL,
    CONSTRAINT "commerce_price_list_properties_pkey" PRIMARY KEY ("property_id", "price_list_id")
);
ALTER TABLE "commerce_price_list_properties"
    ADD CONSTRAINT "commerce_price_list_properties_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;
ALTER TABLE "commerce_price_list_properties"
    ADD CONSTRAINT "commerce_price_list_properties_price_list_id_fkey"
    FOREIGN KEY ("price_list_id") REFERENCES "commerce_price_lists"("id") ON DELETE CASCADE;
CREATE INDEX "commerce_price_list_properties_price_list_idx"
    ON "commerce_price_list_properties" ("price_list_id");
