-- A seeded rule keeps what its business chose.
--
-- System automations are re-synced into every tenant on module activation, by
-- the daily reconcile, and at release. The re-sync matched a tenant's copy by
-- (origin='system', name) and overwrote it with the stock rule. Measured against
-- local Postgres on 2026-10-03, for a rule the tenant can edit (`locked = false`):
--   - a published edit (description, trigger, conditions, actions) was put back;
--   - a PAUSED copy was switched back to active, every day;
--   - a RENAMED copy was not found, so a second copy was installed beside it and
--     both ran (two welcome emails to each new contact).
--
-- Three columns, all null on a tenant's own rules:
--   system_key          the seed's permanent identity, so a rename by either side
--                       is a label change and never a new rule;
--   seeded_fingerprint  sha256 of the rule document the platform last wrote, so a
--                       re-sync can tell an untouched copy (takes the platform's
--                       newer version) from an edited one (left alone);
--   platform_update_at  when a newer platform version was held back because the
--                       business had changed the rule.
--
-- No backfill here. Which name belongs to which seed lives in the seed catalog
-- (@wizeworks/automation-actions), not in SQL, so the re-sync keys an existing
-- row the first time it finds it by its current or former name
-- (`upsertSystemAutomation` → `findSeededRow`). A hand-written name→key table
-- here would be a second copy of the catalog that nothing keeps in step.
ALTER TABLE "automations"
  ADD COLUMN "system_key"         VARCHAR(100),
  ADD COLUMN "seeded_fingerprint" VARCHAR(64),
  ADD COLUMN "platform_update_at" TIMESTAMPTZ;

-- A key only means something on a seeded row. A tenant's own rule (including a
-- "Duplicate to edit" copy of a seeded one) must never carry one, or the re-sync
-- would treat it as the platform's.
ALTER TABLE "automations"
  ADD CONSTRAINT "automations_system_key_only_on_system_rows"
  CHECK ("system_key" IS NULL OR "origin" = 'system');

-- ── The duplicate-insert race, moved onto the key ──────────────────────────
--
-- `automations_system_name_key` (20270508000000) exists because the seed is
-- check-then-insert: two overlapping runs both look, both find nothing, both
-- create, and the tenant holds two ACTIVE copies of a rule that sends an email.
-- One tenant had two "Handle form submissions" rows a millisecond apart.
--
-- The lookup is now by key, so the protection has to be on the key: every
-- insert the new code makes carries one, and this index refuses the loser.
CREATE UNIQUE INDEX "automations_system_key_key"
  ON "automations" ("tenant_id", "system_key")
  WHERE "origin" = 'system' AND "system_key" IS NOT NULL;

-- The name index is NARROWED to rows that have no key yet, not dropped.
--
-- Unkeyed rows are still found by name until the re-sync keys them, and the
-- containers that are still running during a release (the old code) insert
-- unkeyed rows matched by name. Both still need one row per name.
--
-- Once a row is keyed its name is only a label, and holding it unique would be
-- wrong in two ways. A business renaming its copy to a name another seeded row
-- uses would fail to publish. And a seed whose name a business had already
-- taken for its renamed copy of a different seed could never be installed.
DROP INDEX "automations_system_name_key";
CREATE UNIQUE INDEX "automations_unkeyed_system_name_key"
  ON "automations" ("tenant_id", "name")
  WHERE "origin" = 'system' AND "system_key" IS NULL;
