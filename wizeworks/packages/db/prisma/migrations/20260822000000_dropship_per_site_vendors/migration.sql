-- Dropship per-site enablement + POD seam (docs/14, docs/49 §3)
--
-- 1. dropship_supplier_properties — a JUNCTION scoping a tenant-wide supplier
--    connection to specific sites. NO rows for a supplier = enabled on ALL of
--    the tenant's sites (the default, backward-compatible; ZERO backfill — every
--    existing connection stays tenant-wide). Composite PK, NO tenant_id column —
--    tenant isolation rides the FK parents via ON DELETE CASCADE, exactly like
--    commerce_product_properties. The RLS audit skips tenant_id-less junctions,
--    so no ENABLE/FORCE/POLICY clauses belong here.
--
-- 2. dropship_product_links.metadata — forward-compatible JSONB seam for the
--    DEFERRED print-on-demand authoring path (docs/14 §10). Nullable, unused by
--    the catalog + order-routing build; holds the design/artwork binding when
--    POD lands, so that is a code change, not a migration.

-- ── dropship_supplier_properties — supplier ↔ site ────────────────────────
CREATE TABLE "dropship_supplier_properties" (
    "supplier_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,

    CONSTRAINT "dropship_supplier_properties_pkey" PRIMARY KEY ("supplier_id", "property_id")
);
CREATE INDEX "dropship_supplier_properties_property_id_idx" ON "dropship_supplier_properties"("property_id");

ALTER TABLE "dropship_supplier_properties"
    ADD CONSTRAINT "dropship_supplier_properties_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "dropship_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dropship_supplier_properties"
    ADD CONSTRAINT "dropship_supplier_properties_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── dropship_product_links.metadata — POD design-binding seam ──────────────
ALTER TABLE "dropship_product_links" ADD COLUMN "metadata" JSONB;
