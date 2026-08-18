-- System-automation seed BACKFILL scan (docs/84 Slice F2 backfill).
--
-- Slice E seeds a module's system automations only on the `module.activated`
-- event — it fires FORWARD. Tenants whose modules were ALREADY active before the
-- engine shipped (e.g. an existing B2B account on the dunning ladder) never got
-- that event, so they hold no `automations` rows. The automation-worker's
-- reconcile pass (POST /internal/cron/reconcile-seeds, daily) closes that gap and
-- self-heals any dropped activation event.
--
-- To DISCOVER which tenants have a given module active without granting the app
-- role RLS bypass, expose a SECURITY DEFINER scan — the same pattern as
-- find_active_scheduled_automations (20260731000000). It is OWNED BY sparx_owner
-- and runs under that role, so the SELECT reads across tenants; only the
-- tenant_id column crosses the boundary. The worker then drives
-- seedSystemAutomations per tenant under withTenant (RLS-scoped). Discovery is
-- the only cross-tenant step.
--
-- Module-active is read off the SAME flag the module-active gate uses:
-- settings.modules.<slug>.enabled === true (a JSON boolean → '->>'enabled'' = 'true').

CREATE OR REPLACE FUNCTION find_tenants_with_active_module(p_module text)
RETURNS TABLE(tenant_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT id AS tenant_id
  FROM tenants
  WHERE (settings -> 'modules' -> p_module ->> 'enabled') = 'true'
  ORDER BY created_at ASC;
$$;

REVOKE EXECUTE ON FUNCTION find_tenants_with_active_module(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_tenants_with_active_module(text) TO sparx_app;

COMMENT ON FUNCTION find_tenants_with_active_module IS
  'Returns the ids of every tenant whose settings.modules.<p_module>.enabled is true. SECURITY DEFINER (sparx_owner) so the automation-worker reconcile pass can discover module-active tenants across the fleet without sparx_app holding RLS bypass; the worker seeds each tenant''s system automations under withTenant. Seeding is idempotent + harmless for an inactive-at-runtime tenant — the module-active gate blocks execution regardless.';
