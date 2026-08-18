-- Model B per-site scoping (docs/49 §3), extended to collections + categories —
-- the 4th and 5th instances of the same junction pattern products / content
-- entries / dropship suppliers already use. NO rows for an item = visible on ALL
-- sites (the default, backward-compatible); rows present = visible ONLY on those
-- sites. "Empty means all" → existing collections/categories stay global with
-- ZERO backfill.
--
-- These are JUNCTION tables (composite PK, NO tenant_id column) — tenant
-- isolation rides the FK parents via ON DELETE CASCADE, exactly like
-- commerce_collection_products / commerce_category_products. The RLS audit
-- (packages/db/scripts/rls-audit.ts) skips tenant_id-less junctions, so no
-- ENABLE/FORCE/POLICY clauses are needed (or correct) here.

-- ── commerce_collection_properties — collection ↔ site ────────────────────
CREATE TABLE "commerce_collection_properties" (
    "property_id"   UUID NOT NULL,
    "collection_id" UUID NOT NULL,

    CONSTRAINT "commerce_collection_properties_pkey" PRIMARY KEY ("property_id", "collection_id")
);
CREATE INDEX "commerce_collection_properties_collection_id_idx" ON "commerce_collection_properties"("collection_id");

ALTER TABLE "commerce_collection_properties"
    ADD CONSTRAINT "commerce_collection_properties_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commerce_collection_properties"
    ADD CONSTRAINT "commerce_collection_properties_collection_id_fkey"
    FOREIGN KEY ("collection_id") REFERENCES "commerce_product_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── commerce_category_properties — category ↔ site ────────────────────────
CREATE TABLE "commerce_category_properties" (
    "property_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "commerce_category_properties_pkey" PRIMARY KEY ("property_id", "category_id")
);
CREATE INDEX "commerce_category_properties_category_id_idx" ON "commerce_category_properties"("category_id");

ALTER TABLE "commerce_category_properties"
    ADD CONSTRAINT "commerce_category_properties_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commerce_category_properties"
    ADD CONSTRAINT "commerce_category_properties_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "commerce_product_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
