-- ─────────────────────────────────────────────────────────────────────────
-- Waitlist auto-offer scan (docs/79 §7) — the cross-tenant tick lookup.
--
-- The api-rest waitlist tick (sparx_app, FORCE RLS-bound) needs to find tenants
-- with waitlist work to do — entries still `waiting`, or `offered` entries whose
-- hold TTL has passed — WITHOUT sparx_app gaining RLS bypass. It then processes
-- each tenant back under withTenant({tenantId}) (expire stale + offer freed slots),
-- so every write still passes tenant_isolation. Mirrors find_due_calendar_connections
-- / find_due_booking_series. No table change; WaitlistEntry + its RLS shipped in
-- 20260915000000.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION find_tenants_with_waitlist_work(p_limit int DEFAULT 200)
RETURNS TABLE(tenant_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT DISTINCT tenant_id
  FROM scheduling_waitlist_entries
  WHERE status = 'waiting'
     OR (status = 'offered' AND offer_expires_at IS NOT NULL AND offer_expires_at < NOW())
     OR (status = 'waiting' AND desired_to < NOW())
  LIMIT p_limit;
$$;

REVOKE EXECUTE ON FUNCTION find_tenants_with_waitlist_work(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_tenants_with_waitlist_work(int) TO sparx_app;

COMMENT ON FUNCTION find_tenants_with_waitlist_work IS
  'Returns up to p_limit tenant_ids that have waitlist entries needing attention (waiting, or offered-and-expired). SECURITY DEFINER (sparx_owner) so the scheduling waitlist tick scans across tenants without sparx_app having RLS bypass.';
