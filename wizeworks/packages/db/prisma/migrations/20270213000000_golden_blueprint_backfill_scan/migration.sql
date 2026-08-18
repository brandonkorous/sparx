-- Golden-blueprint install BACKFILL scan (theming-spine Phase 3).
--
-- The golden `sparx` blueprint is the platform's DEFAULT new site: a fresh tenant
-- should BE the golden template, not just render the base theme through a fallback.
-- api-rest installs it FORWARD on `tenant.created` (its own durable broker consumer,
-- api-rest-golden-blueprint). That path fires near-instantly but is not lossless in
-- every deployment — under a non-NATS transport there is no forward consumer at all,
-- and any event can be dropped while a pod restarts. Tenants that predate this feature
-- never got the event either.
--
-- This scan is the self-heal the reconcile pass drives: it DISCOVERS every primary
-- property that carries NO blueprint install, across the fleet, without granting the
-- app role RLS bypass. Same SECURITY DEFINER pattern as find_tenants_with_active_module
-- (20260805000000): OWNED BY sparx_owner, so the SELECT reads across tenants; only the
-- (tenant_id, property_id) pair crosses the boundary. The reconcile then installs the
-- golden blueprint per tenant under withTenant (RLS-scoped), gated on "no install yet",
-- so a redelivery or a concurrent forward install is a harmless no-op.
--
-- "No install yet" is the SAME gate the forward path uses: a primary property with ANY
-- tenant_blueprint_installs row is skipped — the onboarding wizard may have installed a
-- different pick, and that pick REPLACES golden rather than golden overwriting it.

CREATE OR REPLACE FUNCTION find_tenants_without_primary_blueprint_install()
RETURNS TABLE(tenant_id uuid, property_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT p.tenant_id, p.id
  FROM properties p
  WHERE p.is_primary = true
    AND NOT EXISTS (
      SELECT 1
      FROM tenant_blueprint_installs i
      WHERE i.property_id = p.id
    )
  ORDER BY p.created_at ASC;
$$;

REVOKE EXECUTE ON FUNCTION find_tenants_without_primary_blueprint_install() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_tenants_without_primary_blueprint_install() TO sparx_app;

COMMENT ON FUNCTION find_tenants_without_primary_blueprint_install IS
  'Returns (tenant_id, property_id) for every tenant PRIMARY property that carries no tenant_blueprint_installs row. SECURITY DEFINER (sparx_owner) so api-rest''s golden-blueprint reconcile can discover un-installed tenants across the fleet without sparx_app holding RLS bypass; the reconcile installs the golden blueprint per tenant under withTenant. Gated on "no install yet", so it never overwrites an onboarding blueprint pick and is a safe no-op once anything is installed.';

-- ── The owner READ the scan above cannot run without ─────────────────────────
--
-- SECURITY DEFINER makes the scan run as `sparx_owner`, and Decision F3
-- (20260527000100) puts FORCE ROW LEVEL SECURITY on every tenant table
-- specifically so `sparx_owner` cannot bypass RLS. A cross-tenant scan by
-- definition runs with NO `app.tenant_id` set, so `tenant_isolation` compares
-- `tenant_id = current_tenant_id()` against a NULL and the function returns
-- ZERO ROWS. No error, no log — the reconcile would simply find nothing to heal
-- forever, which is the whole failure mode 20270126000000 was written to end.
-- It passes locally only because docker's `sparx_owner` is a superuser.
--
-- Same scope as the canonical pattern (20270126000000_scan_owner_rls_backfill):
-- PERMISSIVE, FOR SELECT, TO sparx_owner only. It opens nothing for `sparx_app`
-- and grants no cross-tenant WRITE — the install itself still runs back under
-- `withTenant({tenantId})` as `sparx_app` and stays fully tenant-isolated.

DROP POLICY IF EXISTS properties_owner_read ON "properties";
CREATE POLICY properties_owner_read ON "properties"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

DROP POLICY IF EXISTS tenant_blueprint_installs_owner_read ON "tenant_blueprint_installs";
CREATE POLICY tenant_blueprint_installs_owner_read ON "tenant_blueprint_installs"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);
