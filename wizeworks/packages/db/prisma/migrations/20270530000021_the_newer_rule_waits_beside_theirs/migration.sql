-- The newer version of a seeded rule waits beside the business's own.
--
-- 20270530000020 stopped the re-sync from writing over a seeded rule the business
-- had changed, and marked the row (`platform_update_at`) when the platform has a
-- newer version it held back. The console says so, but the business could not
-- take the newer version: the only place it existed was the seed catalog in
-- @wizeworks/automation-actions, which the API process does not load (it holds
-- the action executors, and the API runs none of them).
--
-- So the re-sync, which DOES have the catalog, now writes the held-back document
-- onto the row beside the flag. The API reads it from here to show what differs
-- and to switch the rule to it when the business asks. Every re-sync refreshes it
-- (module activation, the daily reconcile, every release), so it is the platform's
-- current version, and it is cleared whenever the flag is.
--
-- Same shape as the rule's own document columns: description, triggerType,
-- triggerConfig, conditions, actions, goal, maxDepth. Null on every row with
-- nothing waiting, which is almost all of them.
--
-- No backfill: which document belongs to which seed lives in the catalog, not in
-- SQL. A row flagged before this column existed gets its document on the next
-- re-sync, and the release runs one as soon as its containers are up.
ALTER TABLE "automations" ADD COLUMN "platform_document" JSONB;

-- Only a seeded row can have a platform version waiting, and only while the flag
-- says one is waiting. A business's own rule (including a "Duplicate to edit" copy)
-- must never carry one, or the console would offer to replace it with a rule it
-- never came from.
ALTER TABLE "automations"
  ADD CONSTRAINT "automations_platform_document_only_while_pending"
  CHECK (
    "platform_document" IS NULL
    OR ("origin" = 'system' AND "platform_update_at" IS NOT NULL)
  );
