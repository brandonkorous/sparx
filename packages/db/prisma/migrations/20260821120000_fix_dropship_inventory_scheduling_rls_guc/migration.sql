-- Fix the tenant-isolation GUC reference on 10 dropship / inventory-sync /
-- b2b-scheduling tables — the SAME bug class already fixed once for the
-- b2b/import tables in 20260801000000_fix_b2b_import_rls_guc.
--
-- These policies were authored as:
--     USING (tenant_id = current_setting('app.tenant_id')::uuid)
-- `current_setting(name)` WITHOUT the missing_ok=true flag THROWS
-- `unrecognized configuration parameter` (SQLSTATE 42704) when the GUC is
-- unset, instead of the intended "no rows visible". It went unnoticed because
-- every read path to date ran either as a superuser (local docker, which
-- bypasses RLS) or as `sparx_owner` WITH app.tenant_id already set. In prod
-- `sparx_owner` is non-superuser + FORCE-RLS-bound, so the policy IS evaluated.
--
-- It surfaced when 20260822000000_dropship_per_site_vendors added a FOREIGN KEY
-- referencing dropship_suppliers: Postgres ran the constraint-validation scan as
-- `sparx_owner` with no app.tenant_id set, the dropship_suppliers policy fired,
-- and the deploy aborted with 42704 ("unrecognized configuration parameter
-- \"app.tenant_id\""). This migration is timestamped to run BEFORE that one so
-- the FK validation sees the corrected, missing-safe policy.
--
-- The canonical form (every other tenant table, e.g. 20260527000100_rls) is the
-- `current_tenant_id()` helper: `NULLIF(current_setting('app.tenant_id', true),
-- '')::uuid`, which returns NULL (→ no rows) on an unset GUC rather than throwing.
-- This migration drops and recreates each policy in that form, adding the missing
-- `WITH CHECK` so writes are tenant-scoped too. Pure RLS DDL — no schema/Prisma
-- drift (mirrors 20260801000000_fix_b2b_import_rls_guc).

-- dropship (20260718000000) ---------------------------------------------------
DROP POLICY IF EXISTS tenant_isolation ON dropship_suppliers;
CREATE POLICY tenant_isolation ON dropship_suppliers
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation ON dropship_products;
CREATE POLICY tenant_isolation ON dropship_products
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation ON dropship_product_links;
CREATE POLICY tenant_isolation ON dropship_product_links
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation ON dropship_orders;
CREATE POLICY tenant_isolation ON dropship_orders
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- b2b scheduling (20260717000000) ---------------------------------------------
DROP POLICY IF EXISTS tenant_isolation ON service_types;
CREATE POLICY tenant_isolation ON service_types
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation ON service_appointments;
CREATE POLICY tenant_isolation ON service_appointments
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- inventory sync (20260720000000) ---------------------------------------------
DROP POLICY IF EXISTS tenant_isolation ON inventory_sources;
CREATE POLICY tenant_isolation ON inventory_sources
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation ON stock_locations;
CREATE POLICY tenant_isolation ON stock_locations
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation ON stock_levels;
CREATE POLICY tenant_isolation ON stock_levels
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation ON inventory_source_links;
CREATE POLICY tenant_isolation ON inventory_source_links
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
