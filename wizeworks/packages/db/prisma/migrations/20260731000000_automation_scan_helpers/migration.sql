-- Automation engine cross-tenant scan helpers (docs/81 §7, docs/84 Slice D).
--
-- The automation-worker tick (services/automation-worker) runs as `sparx_app`,
-- which is FORCE RLS-bound on `automations` / `automation_runs`. To DISCOVER
-- work across ALL tenants on each scheduler tick without granting the app role
-- wholesale RLS bypass, we expose two SECURITY DEFINER functions — the same
-- pattern as find_due_scheduled_entries (20260601100000) and
-- find_pending_webhook_deliveries (20260601100100).
--
-- Each is OWNED BY sparx_owner (the migration role) and EXECUTEs under that
-- role at call time, so the SELECT inside bypasses RLS — but only the column
-- subset declared in the RETURNS clause crosses the boundary. The worker then
-- DRIVES each discovered run/automation through `withTenant` (GUC set), so every
-- subsequent read/write is RLS-scoped under the app role. Discovery is the only
-- cross-tenant step; execution stays tenant-isolated.
--
-- `pg_try_advisory_lock` / `pg_advisory_unlock` are builtins available to every
-- role — the worker's cross-pod singleton lock needs no grant.

-- ── due runs (the advance tick) ───────────────────────────────────────────
-- A run is "due" when it is actively running, or it parked on a wait/defer and
-- its resume_at has passed. Mirrors the OR predicate the tick used to express
-- as a Prisma findMany. Ordered oldest-first for fair progress.

CREATE OR REPLACE FUNCTION find_due_automation_runs(p_limit int DEFAULT 100)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  automation_id uuid,
  cause_depth smallint,
  cursor_index int,
  trigger_event jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT id, tenant_id, automation_id, cause_depth, cursor_index, trigger_event
  FROM automation_runs
  WHERE status = 'running'
     OR (status = 'waiting' AND resume_at IS NOT NULL AND resume_at <= NOW())
  ORDER BY started_at ASC
  LIMIT p_limit;
$$;

REVOKE EXECUTE ON FUNCTION find_due_automation_runs(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_due_automation_runs(int) TO sparx_app;

COMMENT ON FUNCTION find_due_automation_runs IS
  'Returns up to p_limit automation_runs that are due (status=running, or status=waiting with resume_at <= NOW()). SECURITY DEFINER (sparx_owner) so the worker tick can scan across tenants without sparx_app holding RLS bypass; the worker drives each run under withTenant.';

-- ── active scheduled automations (the schedule tick) ──────────────────────
-- The (schedule, predicate) automations the schedule tick fans out: every
-- active automation whose trigger is a `schedule.*` cadence. The tick then,
-- per automation, runs the predicate scanner under withTenant and enqueues one
-- run per matched row.

CREATE OR REPLACE FUNCTION find_active_scheduled_automations()
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  trigger_type varchar(100),
  trigger_config jsonb,
  conditions jsonb,
  actions jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT id, tenant_id, trigger_type, trigger_config, conditions, actions
  FROM automations
  WHERE status = 'active'
    AND trigger_type LIKE 'schedule.%'
  ORDER BY created_at ASC;
$$;

REVOKE EXECUTE ON FUNCTION find_active_scheduled_automations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_active_scheduled_automations() TO sparx_app;

COMMENT ON FUNCTION find_active_scheduled_automations IS
  'Returns all active automations whose trigger_type is a schedule.* cadence. SECURITY DEFINER (sparx_owner) so the worker schedule tick can scan across tenants without sparx_app holding RLS bypass; the worker runs each predicate + enqueue under withTenant.';
