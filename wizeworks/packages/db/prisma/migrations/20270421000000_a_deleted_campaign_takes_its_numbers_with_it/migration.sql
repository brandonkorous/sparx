-- Cascade `rollup_funnel_daily` from the funnel it counts (docs/152 B2).
--
-- ── WHAT WENT WRONG, AND HOW IT WAS FOUND ───────────────────────────────────
--
-- `rollup_funnel_daily` shipped one migration ago with foreign keys to `tenants`
-- and `properties` but none to `funnels`, matching the other rollups. Deleting a
-- funnel therefore left its daily counts standing, and every all-funnels total
-- would keep adding in a campaign that no longer exists.
--
-- Found by running the service end to end rather than by reading it: a probe
-- funnel was created, reconciled and deleted, and its two rollup rows were still
-- there afterwards with the funnel gone.
--
-- ── WHY THIS ROLLUP DIFFERS FROM THE OTHERS ─────────────────────────────────
--
-- `rollup_commerce_daily_revenue` and `rollup_automation_daily_runs` genuinely
-- should not cascade from their source: they aggregate a STREAM (orders, runs)
-- that outlives any single rule, so a source row disappearing is ordinary and
-- the numbers remain true. This table is keyed BY the campaign. Its rows are not
-- history once the campaign is gone; they are garbage.
--
-- The nightly reconcile is delete-then-insert over a trailing window, so orphans
-- inside that window disappear on the next run. Anything older never gets
-- recomputed and would sit there permanently — which is the half that made this
-- worth a constraint rather than a cleanup job.
--
-- ── WHY A SECOND MIGRATION RATHER THAN AMENDING THE FIRST ───────────────────
--
-- The name of a migration is its primary key in `_prisma_migrations` on every
-- database that has applied it, and editing an applied file changes its checksum
-- and makes the next `migrate deploy` refuse. Reverse a migration with a new
-- migration — see wizeworks/packages/db/CLAUDE.md.

-- Orphans first: the constraint cannot be added while rows violate it, and any
-- that exist are by definition counts for campaigns that are gone.
DELETE FROM "rollup_funnel_daily" r
WHERE NOT EXISTS (SELECT 1 FROM "funnels" f WHERE f.id = r.funnel_id);

ALTER TABLE "rollup_funnel_daily"
    ADD CONSTRAINT "rollup_funnel_daily_funnel_fk"
        FOREIGN KEY ("funnel_id") REFERENCES "funnels"("id") ON DELETE CASCADE;
