-- ─────────────────────────────────────────────────────────────────────────
-- The SECOND half of 20270117000000_dispatch_scan_owner_rls.
--
-- That migration fixed a whole class of silent prod failure: a `find_due_*`
-- SECURITY DEFINER scan is owned by `sparx_owner`, but Decision F3
-- (20260527000100) puts FORCE ROW LEVEL SECURITY on every tenant table
-- SPECIFICALLY so `sparx_owner` cannot bypass RLS. So a cross-tenant scan —
-- which by definition runs with NO `app.tenant_id` set — matches the
-- `tenant_isolation` policy (`tenant_id = current_tenant_id()`) against a NULL
-- and returns ZERO ROWS. No error. No log. The feature simply never fires.
-- It passes locally only because docker's `sparx_owner` is a superuser.
--
-- The fix there was a PERMISSIVE, read-only `FOR SELECT TO sparx_owner` policy
-- on each scanned table, and it enumerated the tables that existed on
-- 2027-01-17. It could not cover scans that did not exist yet — and within a
-- week, SIX more were added:
--
--   20270122000000_social_health_inbox_cadence
--     find_due_social_connections     → social_connections
--     find_due_social_post_targets    → social_post_targets (+ social_posts ✓)
--     find_due_social_metric_targets  → social_post_targets, social_post_metrics
--     find_due_social_inbox_targets   → social_targets, social_connections
--     find_social_autofill_slots      → social_posting_slots
--   20270124000000_email_sequences
--     find_due_sequence_enrollments   → email_sequence_enrollments, email_sequences
--
-- Every one of them has been returning zero rows in prod since it shipped. The
-- observable damage, confirmed on 2026-07-28 against the live database:
--
--   · `social_targets.inbox_synced_at` is NULL on EVERY destination of EVERY
--     connection — the engagement inbox has never polled anything, ever. A
--     customer commenting on a tenant's post reaches nobody.
--   · Published posts' metrics froze at publish time; the decaying-cadence
--     re-read (hourly → 6-hourly → daily) never ran once.
--   · `social_connections.health_checked_at` never moves, so a grant is never
--     refreshed ahead of expiry — the exact failure the health sweep exists to
--     prevent (audit GAP 1). Tokens will start dying at ~day 58.
--   · Email-sequence enrollments sit at `status='active'` with `next_run_at` in
--     the past forever: nobody enrolled in a sequence has ever received step 2.
--
-- It also blocked the Meta App Review: seven permissions sat at "0 of 1 API
-- call(s) required" because the calls that would exercise them (comment reads,
-- post insights) are made by the worker, and the worker is only ever woken by
-- these sweeps.
--
-- `social_posts` and the twelve tables from 20270117000000 already carry the
-- policy and are deliberately not repeated here.
--
-- Why this keeps happening: nothing tied "adds a SECURITY DEFINER scan" to
-- "grant the owner read on what it scans". `pnpm --filter @sparx/db db:rls-audit`
-- now enforces exactly that pairing statically, so the next scan added without
-- its policy fails pre-push instead of silently doing nothing in prod for a week.
--
-- Scope, unchanged from 20270117000000: PERMISSIVE, FOR SELECT, TO sparx_owner
-- only. The per-row claim/UPDATE work still runs back under
-- `withTenant({tenantId})` as `sparx_app` and stays fully tenant-isolated. This
-- grants `sparx_app` nothing and grants no cross-tenant WRITE anywhere.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Social: health, inbox, metrics, per-destination schedule, autofill ────────

DROP POLICY IF EXISTS social_connections_owner_read ON "social_connections";
CREATE POLICY social_connections_owner_read ON "social_connections"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

DROP POLICY IF EXISTS social_targets_owner_read ON "social_targets";
CREATE POLICY social_targets_owner_read ON "social_targets"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

DROP POLICY IF EXISTS social_post_targets_owner_read ON "social_post_targets";
CREATE POLICY social_post_targets_owner_read ON "social_post_targets"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

DROP POLICY IF EXISTS social_post_metrics_owner_read ON "social_post_metrics";
CREATE POLICY social_post_metrics_owner_read ON "social_post_metrics"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

DROP POLICY IF EXISTS social_posting_slots_owner_read ON "social_posting_slots";
CREATE POLICY social_posting_slots_owner_read ON "social_posting_slots"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

-- ── Email sequences: the enrollment drain ────────────────────────────────────

DROP POLICY IF EXISTS email_sequence_enrollments_owner_read ON "email_sequence_enrollments";
CREATE POLICY email_sequence_enrollments_owner_read ON "email_sequence_enrollments"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);

DROP POLICY IF EXISTS email_sequences_owner_read ON "email_sequences";
CREATE POLICY email_sequences_owner_read ON "email_sequences"
    AS PERMISSIVE FOR SELECT
    TO sparx_owner
    USING (true);
