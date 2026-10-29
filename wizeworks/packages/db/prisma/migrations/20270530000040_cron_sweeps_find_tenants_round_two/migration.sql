-- Three more cron sweeps walk only the tenants that have something due.
--
-- The same shape WW-9 (20270530000036) fixed for the SLA sweep and the reaper,
-- on the three it left on the full walk: every run opened a withTenant
-- transaction per commerce tenant and asked it a question whose answer was
-- almost always "nothing".
--
--   POST /internal/channels/poll                 8 ChannelConnection.findMany a run, 532 runs
--   POST /internal/commerce/subscription-tick   16 Subscription.findMany + 8 repeat-start scans a run
--   POST /internal/commerce/cart-abandonment-sweep  8 Cart.findMany a run, 248 runs
--
-- Each scan below is the per-tenant selector it stands in front of, run once
-- across the fleet with the tenant filter dropped. None of them is narrower than
-- the query the sweep runs per tenant: a scan that says "no work" for a tenant
-- that had work is a renewal that never bills, so where one could be tighter it
-- is left as wide as the per-tenant query, and the sweep still re-checks under
-- withTenant.
--
-- SECURITY DEFINER, owned by sparx_owner, which does NOT bypass the FORCE RLS on
-- these tables (decision F3), so each scanned table gets the read-only owner
-- policy 20270117000000_dispatch_scan_owner_rls gave the other dispatch scans.
-- They return tenant ids only; each sweep still writes per tenant as sparx_app,
-- which this opens nothing for.

CREATE POLICY channel_connections_owner_read ON "channel_connections"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

CREATE POLICY commerce_subscriptions_owner_read ON "commerce_subscriptions"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

CREATE POLICY orders_owner_read ON "orders"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

CREATE POLICY order_items_owner_read ON "order_items"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

CREATE POLICY commerce_carts_owner_read ON "commerce_carts"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

CREATE POLICY commerce_cart_items_owner_read ON "commerce_cart_items"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

CREATE POLICY commerce_checkout_sessions_owner_read ON "commerce_checkout_sessions"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

-- Channel order poll. listPollableConnections reads every `active` connection
-- and then drops the ones whose adapter cannot be polled; the scan stops at the
-- status, so a webhook-only connection still counts as work (one cheap read).
CREATE OR REPLACE FUNCTION find_tenants_with_active_channels()
RETURNS TABLE(tenant_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT DISTINCT c.tenant_id
  FROM channel_connections c
  WHERE c.status = 'active';
$$;

REVOKE EXECUTE ON FUNCTION find_tenants_with_active_channels() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_tenants_with_active_channels() TO sparx_app;

COMMENT ON FUNCTION find_tenants_with_active_channels IS
  'Tenant ids with an active channel connection, the rows the channel order poll reads per tenant.';

-- Subscription tick. runSubscriptionTick does three things, and a tenant with
-- any one of them due is returned:
--   1. findDueOccurrences: active or trialing, next_occurrence_at <= as-of.
--   2. findDueRetries: past_due. The tick then keeps only those whose newest
--      dunning attempt's retry has arrived; the scan keeps every past_due one,
--      wider on purpose, so a ladder is never skipped on a reading of its tail.
--   3. findOrdersAwaitingRepeat: a paid order in the lookback window with a line
--      asking for a repeat order that has not been started or skipped. The same
--      predicate, the same now(), the lookback passed in from the service's
--      constant so the two cannot drift.
-- `p_as_of` is the tick's own clock, so an operator's `?asOf=` dry-run scans
-- against the date it bills against.
CREATE OR REPLACE FUNCTION find_tenants_with_due_subscription_work(
  p_as_of timestamptz,
  p_repeat_lookback_days int
)
RETURNS TABLE(tenant_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT s.tenant_id
  FROM commerce_subscriptions s
  WHERE (s.status IN ('active', 'trialing') AND s.next_occurrence_at <= p_as_of)
     OR s.status = 'past_due'
  UNION
  SELECT o.tenant_id
  FROM orders o
  JOIN order_items i ON i.order_id = o.id
  WHERE o.payment_status = 'paid'
    AND o.status NOT IN ('cancelled', 'refunded')
    AND o.paid_at >= now() - make_interval(days => p_repeat_lookback_days)
    AND i.metadata ? 'repeat'
    AND NOT (i.metadata -> 'repeat' ? 'subscriptionId')
    AND NOT (i.metadata -> 'repeat' ? 'skipped');
$$;

REVOKE EXECUTE ON FUNCTION find_tenants_with_due_subscription_work(timestamptz, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_tenants_with_due_subscription_work(timestamptz, int) TO sparx_app;

COMMENT ON FUNCTION find_tenants_with_due_subscription_work IS
  'Tenant ids with a renewal due by p_as_of, any past_due subscription, or a paid order still waiting for its repeat order to start. A superset of what the subscription tick bills; the tick re-checks per tenant under withTenant.';

-- Cart abandonment. listCartSiteScopes is the sweep's first read and nothing
-- after it runs for a tenant it returns no site for: a basket not yet marked,
-- with something in it, that no completed checkout bought. That predicate,
-- unchanged. The per-site idle threshold is applied after, per tenant, which is
-- why the scan does not try to.
CREATE OR REPLACE FUNCTION find_tenants_with_open_carts()
RETURNS TABLE(tenant_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT DISTINCT c.tenant_id
  FROM commerce_carts c
  WHERE c.abandoned_at IS NULL
    AND EXISTS (SELECT 1 FROM commerce_cart_items i WHERE i.cart_id = c.id)
    AND NOT EXISTS (
      SELECT 1 FROM commerce_checkout_sessions cs
      WHERE cs.cart_id = c.id AND cs.step = 'completed'
    );
$$;

REVOKE EXECUTE ON FUNCTION find_tenants_with_open_carts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_tenants_with_open_carts() TO sparx_app;

COMMENT ON FUNCTION find_tenants_with_open_carts IS
  'Tenant ids holding an unmarked, non-empty basket no completed checkout bought, the carts listCartSiteScopes reads per tenant before the abandonment sweep applies each site''s idle threshold.';
