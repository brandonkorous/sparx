-- Cron sweeps walk only the tenants that have something due (WW-9).
--
-- POST /internal/crm/sla-sweep opened a withTenant transaction per CRM tenant
-- per run and ran four ticket queries in each, whether or not the tenant had a
-- single open ticket: 33 Ticket.findMany per run, 477 runs, 63 s in a week. The
-- reservation reaper did the same every minute for every commerce tenant.
--
-- These two scans answer "which tenants have work" in ONE statement across the
-- fleet. SECURITY DEFINER, owned by sparx_owner, which does NOT bypass the FORCE
-- RLS on these tables (decision F3), so each scanned table gets the same read-only
-- owner policy 20270117000000_dispatch_scan_owner_rls gave the other dispatch
-- scans. They return tenant ids only; each sweep still writes per tenant under
-- withTenant as sparx_app, which this opens nothing for.

CREATE POLICY crm_tickets_owner_read ON "crm_tickets"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

CREATE POLICY billing_document_signatures_owner_read ON "billing_document_signatures"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

CREATE POLICY inventory_reservations_owner_read ON "inventory_reservations"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

CREATE OR REPLACE FUNCTION find_tenants_with_due_crm_sweep(p_now timestamptz)
RETURNS TABLE(tenant_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT DISTINCT t.tenant_id
  FROM crm_tickets t
  WHERE t.deleted_at IS NULL
    AND t.closed_at IS NULL
    AND (
      (t.first_responded_at IS NULL AND t.first_response_breached_at IS NULL AND (
        (t.first_response_due_at <= p_now)
        OR (t.first_response_warn_at <= p_now AND t.first_response_warned_at IS NULL)
      ))
      OR
      (t.resolved_at IS NULL AND t.resolution_breached_at IS NULL AND (
        (t.resolution_due_at <= p_now)
        OR (t.resolution_warn_at <= p_now AND t.resolution_warned_at IS NULL)
      ))
    )
  UNION
  SELECT DISTINCT s.tenant_id
  FROM billing_document_signatures s
  WHERE s.status = 'pending' AND s.expires_at < p_now;
$$;

REVOKE EXECUTE ON FUNCTION find_tenants_with_due_crm_sweep(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_tenants_with_due_crm_sweep(timestamptz) TO sparx_app;

COMMENT ON FUNCTION find_tenants_with_due_crm_sweep IS
  'Tenant ids with a request past an SLA warn or due mark not yet stamped, or a pending signing link past expiry. A superset of what the SLA sweep marks; the sweep re-checks per tenant under withTenant.';

CREATE OR REPLACE FUNCTION find_tenants_with_due_reservations(p_now timestamptz)
RETURNS TABLE(tenant_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT DISTINCT r.tenant_id
  FROM inventory_reservations r
  WHERE r.status = 'active' AND r.expires_at <= p_now;
$$;

REVOKE EXECUTE ON FUNCTION find_tenants_with_due_reservations(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_tenants_with_due_reservations(timestamptz) TO sparx_app;

COMMENT ON FUNCTION find_tenants_with_due_reservations IS
  'Tenant ids holding an active cart reservation past its expiry. Uses the (status, expires_at) index; the reaper releases them per tenant under withTenant.';

-- The same pre-filter for two more sweeps of the same shape.

CREATE POLICY crm_mailbox_connections_owner_read ON "crm_mailbox_connections"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

CREATE POLICY order_payments_owner_read ON "order_payments"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

CREATE OR REPLACE FUNCTION find_tenants_with_syncable_mailboxes()
RETURNS TABLE(tenant_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT DISTINCT m.tenant_id
  FROM crm_mailbox_connections m
  WHERE m.status IN ('active', 'error');
$$;

REVOKE EXECUTE ON FUNCTION find_tenants_with_syncable_mailboxes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_tenants_with_syncable_mailboxes() TO sparx_app;

COMMENT ON FUNCTION find_tenants_with_syncable_mailboxes IS
  'Tenant ids with a mailbox the sync polls (status active or error), the same rows mailboxService.listSyncable reads per tenant.';

CREATE OR REPLACE FUNCTION find_tenants_with_open_payments(p_cutoff timestamptz)
RETURNS TABLE(tenant_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT DISTINCT p.tenant_id
  FROM order_payments p
  WHERE p.status IN ('pending', 'authorized')
    AND p.processor_ref IS NOT NULL
    AND p.created_at < p_cutoff;
$$;

REVOKE EXECUTE ON FUNCTION find_tenants_with_open_payments(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_tenants_with_open_payments(timestamptz) TO sparx_app;

COMMENT ON FUNCTION find_tenants_with_open_payments IS
  'Tenant ids with a gateway payment still pending or authorized past p_cutoff, the rows sweepStrandedCheckoutPayments reconciles per tenant.';
