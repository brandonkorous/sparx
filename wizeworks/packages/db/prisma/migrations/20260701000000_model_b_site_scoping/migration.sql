-- Model B per-site scoping (docs/49 §3) — junction tables that scope a product /
-- content entry to specific web PROPERTIES (sites). NO rows for an item =
-- visible on ALL sites (the default, backward-compatible); rows present = visible
-- ONLY on those sites. "Empty means all" → existing catalogs/content stay global
-- with ZERO backfill.
--
-- These are JUNCTION tables (composite PK, NO tenant_id column) — tenant
-- isolation rides the FK parents via ON DELETE CASCADE, exactly like
-- commerce_collection_products / commerce_category_products. The RLS audit
-- (packages/db/scripts/rls-audit.ts) skips tenant_id-less junctions, so no
-- ENABLE/FORCE/POLICY clauses are needed (or correct) here.

-- ── commerce_product_properties — product ↔ site ──────────────────────────
CREATE TABLE "commerce_product_properties" (
    "property_id" UUID NOT NULL,
    "product_id"  UUID NOT NULL,

    CONSTRAINT "commerce_product_properties_pkey" PRIMARY KEY ("property_id", "product_id")
);
CREATE INDEX "commerce_product_properties_product_id_idx" ON "commerce_product_properties"("product_id");

ALTER TABLE "commerce_product_properties"
    ADD CONSTRAINT "commerce_product_properties_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commerce_product_properties"
    ADD CONSTRAINT "commerce_product_properties_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "commerce_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── content_entry_properties — content entry ↔ site ───────────────────────
CREATE TABLE "content_entry_properties" (
    "property_id" UUID NOT NULL,
    "entry_id"    UUID NOT NULL,

    CONSTRAINT "content_entry_properties_pkey" PRIMARY KEY ("property_id", "entry_id")
);
CREATE INDEX "content_entry_properties_entry_id_idx" ON "content_entry_properties"("entry_id");

ALTER TABLE "content_entry_properties"
    ADD CONSTRAINT "content_entry_properties_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_entry_properties"
    ADD CONSTRAINT "content_entry_properties_entry_id_fkey"
    FOREIGN KEY ("entry_id") REFERENCES "content_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
