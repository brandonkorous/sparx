-- ─────────────────────────────────────────────────────────────────────────
-- Make the background dispatch scans actually work in prod.
--
-- Every background tick (booking notifications, scheduled/broadcast email,
-- automations, recurring booking series, calendar sync, scheduled CMS + site
-- publishes, social posts, webhook delivery, waitlist offers) finds its due
-- rows across ALL tenants via a `find_due_*` / `find_*` SECURITY DEFINER
-- function owned by `sparx_owner` (migrations 20260601100000, 20260609000000,
-- 20260731000000, 20260916000000, 20260918000000, 20260920000000,
-- 20260919000000, 20260608000000, 20270112000000, …). Each function does a
-- cross-tenant SELECT with NO `app.tenant_id` set — that is the whole point of
-- a cross-tenant scan.
--
-- The functions were written assuming the definer (`sparx_owner`) BYPASSES RLS.
-- It does not. Decision F3 (migration 20260527000100) deliberately set FORCE
-- ROW LEVEL SECURITY on every tenant table SPECIFICALLY so that `sparx_owner`
-- cannot bypass — closing the BYPASSRLS hole. So in prod (where `sparx_owner`
-- is a non-superuser, non-BYPASSRLS role) every one of these scans is subject
-- to the table's `tenant_isolation` policy (`tenant_id = current_tenant_id()`),
-- and with no tenant context set it matches ZERO rows on every tick. The result
-- is that these features silently never fire in prod — confirmed by finding
-- `scheduling_booking_notifications` rows piling up `status='pending'`,
-- `sent_at IS NULL`, for hours while `find_due_booking_notifications()` returned
-- nothing. (It passes locally only because docker's `sparx_owner` is a
-- superuser and bypasses RLS.)
--
-- Fix: give `sparx_owner` a PERMISSIVE, read-only (`FOR SELECT`) RLS policy on
-- exactly the tables these scans read. This is the controlled per-table owner
-- exception already sanctioned for the global `platform_components` catalog
-- (migration 20260901000000, `platform_components_owner_all`), narrowed to
-- SELECT here because the scan only READS: the per-row send/claim/UPDATE work
-- still runs back under `withTenant({tenantId})` as `sparx_app` and stays fully
-- tenant-isolated. FORCE RLS / F3 remains intact for every other query — this
-- opens nothing for `sparx_app` and grants no cross-tenant WRITE.
--
-- Tables (one per scanned relation; webhook delivery joins two):
--   scheduling_booking_notifications  — find_due_booking_notifications
--   email_scheduled_sends             — find_due_scheduled_sends
--   automations                       — find_active_scheduled_automations
--   automation_runs                   — find_due_automation_runs
--   scheduling_booking_series         — find_due_booking_series
--   scheduling_calendar_connections   — find_due_calendar_connections
--   content_entries                   — find_due_scheduled_entries
--   sitebuilder_publish_schedules     — find_due_site_publishes
--   social_posts                      — find_due_social_posts
--   webhook_deliveries + webhook_subscriptions — find_pending_webhook_deliveries
--   scheduling_waitlist_entries       — find_tenants_with_waitlist_work
-- ─────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS scheduling_booking_notifications_owner_read ON "scheduling_booking_notifications";
CREATE POLICY scheduling_booking_notifications_owner_read ON "scheduling_booking_notifications"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

DROP POLICY IF EXISTS email_scheduled_sends_owner_read ON "email_scheduled_sends";
CREATE POLICY email_scheduled_sends_owner_read ON "email_scheduled_sends"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

DROP POLICY IF EXISTS automations_owner_read ON "automations";
CREATE POLICY automations_owner_read ON "automations"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

DROP POLICY IF EXISTS automation_runs_owner_read ON "automation_runs";
CREATE POLICY automation_runs_owner_read ON "automation_runs"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

DROP POLICY IF EXISTS scheduling_booking_series_owner_read ON "scheduling_booking_series";
CREATE POLICY scheduling_booking_series_owner_read ON "scheduling_booking_series"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

DROP POLICY IF EXISTS scheduling_calendar_connections_owner_read ON "scheduling_calendar_connections";
CREATE POLICY scheduling_calendar_connections_owner_read ON "scheduling_calendar_connections"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

DROP POLICY IF EXISTS content_entries_owner_read ON "content_entries";
CREATE POLICY content_entries_owner_read ON "content_entries"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

DROP POLICY IF EXISTS sitebuilder_publish_schedules_owner_read ON "sitebuilder_publish_schedules";
CREATE POLICY sitebuilder_publish_schedules_owner_read ON "sitebuilder_publish_schedules"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

DROP POLICY IF EXISTS social_posts_owner_read ON "social_posts";
CREATE POLICY social_posts_owner_read ON "social_posts"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

DROP POLICY IF EXISTS webhook_deliveries_owner_read ON "webhook_deliveries";
CREATE POLICY webhook_deliveries_owner_read ON "webhook_deliveries"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

DROP POLICY IF EXISTS webhook_subscriptions_owner_read ON "webhook_subscriptions";
CREATE POLICY webhook_subscriptions_owner_read ON "webhook_subscriptions"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

DROP POLICY IF EXISTS scheduling_waitlist_entries_owner_read ON "scheduling_waitlist_entries";
CREATE POLICY scheduling_waitlist_entries_owner_read ON "scheduling_waitlist_entries"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);
