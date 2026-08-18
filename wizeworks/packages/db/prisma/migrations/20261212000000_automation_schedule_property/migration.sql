-- Carry `property_id` through the scheduled-automation discovery helper
-- (docs/131 §3.1). Companion to 20261211000000_p0_site_scoping, which added the
-- column — this is the half that makes the SCHEDULED path see it.
--
-- Two entry points reach the engine and both had the same defect. The event path
-- (handleTrigger) reads automations through Prisma and picked the new column up
-- for free. The scheduled path (runScheduleTick) reads them through this
-- SECURITY DEFINER function, which enumerates its columns explicitly — so
-- without this, a site-scoped "customer inactive 45 days" sweep would still run
-- against every business in the tenant. A fix applied to one path and not the
-- other is worse than no fix, because it looks handled.
--
-- DROP then CREATE, not CREATE OR REPLACE: Postgres refuses to replace a
-- function whose RETURNS TABLE signature changes ("cannot change return type of
-- existing function"). Same shape as 20260808000000_automation_versioning, which
-- hit this when it added `version`.

DROP FUNCTION IF EXISTS find_active_scheduled_automations();

CREATE FUNCTION find_active_scheduled_automations()
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  property_id uuid,
  trigger_type varchar(100),
  trigger_config jsonb,
  conditions jsonb,
  actions jsonb,
  version int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT id, tenant_id, property_id, trigger_type, trigger_config, conditions, actions, version
  FROM automations
  WHERE status = 'active'
    AND trigger_type LIKE 'schedule.%'
  ORDER BY created_at ASC;
$$;

REVOKE EXECUTE ON FUNCTION find_active_scheduled_automations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_active_scheduled_automations() TO sparx_app;

COMMENT ON FUNCTION find_active_scheduled_automations IS
  'Returns all active automations whose trigger_type is a schedule.* cadence, including the live published version and the site the rule is scoped to (NULL = tenant-wide). SECURITY DEFINER (sparx_owner) so the worker schedule tick can scan across tenants without sparx_app holding RLS bypass; the worker runs each predicate + enqueue under withTenant, and filters each scanned row against property_id.';
