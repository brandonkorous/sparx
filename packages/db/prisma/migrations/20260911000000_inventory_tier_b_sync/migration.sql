-- Tier B (SaaS API) sync — last-writer ordering (docs/100 P5c, docs/28 §6).
--
--  • inventory_source_links gains last_source_synced_at: the newest source-reported
--    observation timestamp applied to this mapping. A later feed row whose
--    source_synced_at is OLDER (out-of-order delivery / a replayed snapshot) is
--    dropped rather than clobbering a fresher value. Null for feeds that carry no
--    per-row timestamp (CSV) — ordering is simply skipped there.
--  • inventory_sync_runs gains rows_stale: how many matched rows a run dropped as
--    out-of-order, surfaced in the sync-health breakdown.
--
-- Pure additive ALTERs with defaults — no backfill, no RLS change (both tables are
-- already ENABLE+FORCE RLS with their tenant_isolation policy).

ALTER TABLE inventory_source_links
  ADD COLUMN last_source_synced_at timestamptz;

ALTER TABLE inventory_sync_runs
  ADD COLUMN rows_stale int NOT NULL DEFAULT 0;
