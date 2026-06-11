-- Fix the tenant-isolation GUC reference on 8 b2b/import tables (docs/84 Slice F2).
--
-- These policies were authored with `current_setting('app.current_tenant_id')`,
-- which is WRONG twice over:
--   1. The GUC `withTenant` sets is `app.tenant_id`, not `app.current_tenant_id`,
--      so the policy compared tenant_id to a parameter that is never set.
--   2. `current_setting(name)` WITHOUT the missing_ok=true flag THROWS
--      `unrecognized configuration parameter` when the GUC is unset — so instead
--      of the intended "no rows visible", any read/write under the FORCE-RLS
--      `sparx_app` role errored outright.
--
-- It was never caught because the only consumers to date ran as `sparx_owner`
-- (the b2b-overdue-worker cron) — and prod `sparx_owner` is non-superuser +
-- FORCE-RLS-bound, so those paths would ALSO have failed once exercised. The bug
-- surfaced building the B2B dunning automation, whose worker reads b2b_invoices
-- as `sparx_app` under `withTenant` (the first such code path).
--
-- The canonical form (every other tenant table, e.g. 20260527000100_rls) is the
-- `current_tenant_id()` helper: `NULLIF(current_setting('app.tenant_id', true),
-- '')::uuid`, which returns NULL (→ no rows) on an unset GUC rather than throwing.
-- This migration drops and recreates each policy in that form, adding the missing
-- `WITH CHECK` so writes are tenant-scoped too. Pure RLS DDL — no schema/Prisma
-- drift (mirrors 20260731000000_automation_scan_helpers).

-- import jobs (20260713000000)
DROP POLICY IF EXISTS tenant_isolation ON import_jobs;
CREATE POLICY tenant_isolation ON import_jobs
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation ON import_job_rows;
CREATE POLICY tenant_isolation ON import_job_rows
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- b2b pricing (20260714000000)
DROP POLICY IF EXISTS tenant_isolation ON b2b_pricing_tiers;
CREATE POLICY tenant_isolation ON b2b_pricing_tiers
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation ON b2b_tier_product_overrides;
CREATE POLICY tenant_isolation ON b2b_tier_product_overrides
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation ON b2b_account_product_overrides;
CREATE POLICY tenant_isolation ON b2b_account_product_overrides
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- b2b invoices (20260714010000)
DROP POLICY IF EXISTS tenant_isolation ON b2b_invoices;
CREATE POLICY tenant_isolation ON b2b_invoices
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- b2b portal contacts (20260715000000)
DROP POLICY IF EXISTS tenant_isolation ON b2b_account_contacts;
CREATE POLICY tenant_isolation ON b2b_account_contacts
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- b2b approval rules (20260716000000)
DROP POLICY IF EXISTS tenant_isolation ON purchase_approval_rules;
CREATE POLICY tenant_isolation ON purchase_approval_rules
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
