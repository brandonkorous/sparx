-- A provider webhook finds the installation it was sent to (sparx persona issue 125).
--
-- POST /v1/webhooks/providers/:slug/:installationId arrives with no tenant: the
-- only key is the installation id in the URL. The route looked the installation
-- up with the bare client as sparx_app, and commerce_provider_installations
-- FORCEs row-level security with only `tenant_id = current_tenant_id()`. With no
-- tenant set that matches nothing, so the route answered "no matching
-- installation" and acknowledged with 200. Measured on the local database on
-- 2026-10-06: as sparx_app, `SELECT count(*) FROM commerce_provider_installations`
-- returns 0 while one Shippo installation exists. Every Shippo tracking update
-- (and any other provider's webhook) has been dropped for every business, with
-- nothing in a log above a warning.
--
-- The fix is the dispatch-scan pattern (20270117000000_dispatch_scan_owner_rls):
-- a SECURITY DEFINER function owned by sparx_owner answers ONE question, which
-- tenant owns this installation, and a PERMISSIVE read-only policy lets the owner
-- read the table to answer it. The route then reads the installation itself under
-- withTenant as sparx_app, fully tenant-isolated. This grants sparx_app nothing
-- beyond the tenant id of an installation whose id it already holds.

CREATE OR REPLACE FUNCTION find_provider_installation_tenant(p_installation_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT i.tenant_id
  FROM commerce_provider_installations i
  WHERE i.id = p_installation_id;
$$;

REVOKE EXECUTE ON FUNCTION find_provider_installation_tenant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_provider_installation_tenant(uuid) TO sparx_app;

COMMENT ON FUNCTION find_provider_installation_tenant IS
  'Returns the tenant_id that owns a provider installation, or NULL. SECURITY DEFINER (sparx_owner) so the public provider webhook, which arrives with only the installation id in its URL, can find the tenant without sparx_app holding RLS bypass; the route then reads the installation under withTenant.';

DROP POLICY IF EXISTS commerce_provider_installations_owner_read ON "commerce_provider_installations";
CREATE POLICY commerce_provider_installations_owner_read ON "commerce_provider_installations"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);
