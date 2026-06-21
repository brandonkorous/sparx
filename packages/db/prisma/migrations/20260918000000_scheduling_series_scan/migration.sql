-- ─────────────────────────────────────────────────────────────────────────
-- Recurring booking series (docs/79 §7.6) — the rolling-horizon scan.
--
-- A BookingSeries materializes into child bookings up to a horizon; the api-rest
-- series tick rolls that horizon forward so unbounded series keep generating
-- occurrences over time. This function lets the in-process tick (sparx_app,
-- FORCE RLS-bound) find active series due for top-up across tenants WITHOUT
-- sparx_app gaining RLS bypass — the per-series materialize work then runs back
-- under withTenant({tenantId}). Mirrors find_due_calendar_connections /
-- find_due_booking_notifications. No table change; the BookingSeries table + its
-- RLS (ENABLE + FORCE + tenant_isolation) shipped in 20260915000000.
--
-- "Due" = an active series whose materialized_through is null (never run) or
-- within p_lead_seconds of now, so we extend it before it runs dry.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION find_due_booking_series(
  p_lead_seconds int DEFAULT 2592000, -- 30 days
  p_limit int DEFAULT 100
)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  materialized_through timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT id, tenant_id, materialized_through
  FROM scheduling_booking_series
  WHERE status = 'active'
    AND (materialized_through IS NULL
         OR materialized_through <= NOW() + make_interval(secs => p_lead_seconds))
  ORDER BY materialized_through ASC NULLS FIRST
  LIMIT p_limit;
$$;

REVOKE EXECUTE ON FUNCTION find_due_booking_series(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_due_booking_series(int, int) TO sparx_app;

COMMENT ON FUNCTION find_due_booking_series IS
  'Returns up to p_limit active booking series whose materialized_through is null or within p_lead_seconds of now (due to extend). SECURITY DEFINER (sparx_owner) so the scheduling series tick scans across tenants without sparx_app having RLS bypass.';
