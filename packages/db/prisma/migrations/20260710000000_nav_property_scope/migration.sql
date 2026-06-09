-- Navigation menus: add per-site scoping (docs/49).
--
-- property_id = NULL  → tenant-wide fallback menu (serves all sites)
-- property_id = <id>  → site-specific override (wins over the tenant-wide menu)
--
-- The old @@unique([tenant_id, location]) assumed one menu per location per
-- tenant. We replace it with two PARTIAL unique indexes that Prisma cannot
-- express natively:
--   one for the tenant-wide row (property_id IS NULL)
--   one for the per-site row     (property_id IS NOT NULL)
-- Both can coexist for the same (tenant_id, location), which is exactly the
-- fallback behavior we want.

ALTER TABLE navigation_menus
  ADD COLUMN property_id uuid REFERENCES properties(id) ON DELETE CASCADE;

-- Replace the old single unique with two partial uniques.
-- DROP INDEX (not DROP CONSTRAINT): the original was created with CREATE UNIQUE INDEX,
-- not ADD CONSTRAINT, so ALTER TABLE ... DROP CONSTRAINT does not apply.
DROP INDEX IF EXISTS navigation_menus_tenant_id_location_key;

-- One tenant-wide menu per location.
CREATE UNIQUE INDEX navigation_menus_tenant_location_global
  ON navigation_menus (tenant_id, location)
  WHERE property_id IS NULL;

-- One per-site menu per location per property.
CREATE UNIQUE INDEX navigation_menus_tenant_property_location
  ON navigation_menus (tenant_id, property_id, location)
  WHERE property_id IS NOT NULL;

-- General-purpose lookup index (list menus for a site).
CREATE INDEX navigation_menus_tenant_property_idx
  ON navigation_menus (tenant_id, property_id);
