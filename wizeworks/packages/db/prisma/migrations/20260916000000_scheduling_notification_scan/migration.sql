-- ─────────────────────────────────────────────────────────────────────────
-- find_due_booking_notifications(int) — SECURITY DEFINER cross-tenant scan so
-- the in-process api-rest scheduling-notification dispatch tick (sparx_app,
-- FORCE RLS-bound) can find due scheduling_booking_notifications rows across
-- tenants WITHOUT sparx_app itself gaining RLS bypass. Mirrors
-- find_due_scheduled_sends (20260609000000) and the CMS/sitebuilder
-- scheduled-publish helpers.
--
-- The notification rows are written by the Scheduling engine inside the booking
-- lifecycle transaction (docs/79 §10); this function only surfaces the due ones.
-- Per-row send work runs back under withTenant({tenantId}) so the status UPDATE
-- still passes tenant_isolation — only this read scan is cross-tenant.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION find_due_booking_notifications(p_limit int DEFAULT 100)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  booking_id uuid,
  type varchar,
  channel varchar
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT id, tenant_id, booking_id, type, channel
  FROM scheduling_booking_notifications
  WHERE status = 'pending'
    AND scheduled_for <= NOW()
  ORDER BY scheduled_for ASC
  LIMIT p_limit;
$$;

REVOKE EXECUTE ON FUNCTION find_due_booking_notifications(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_due_booking_notifications(int) TO sparx_app;

COMMENT ON FUNCTION find_due_booking_notifications IS
  'Returns up to p_limit scheduling_booking_notifications with status=pending whose scheduled_for <= NOW(). SECURITY DEFINER (sparx_owner) so the scheduling-notification dispatch tick scans across tenants without sparx_app having RLS bypass.';
