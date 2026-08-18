-- Drop the legacy email-automation system (docs/90 ADR — automation migration).
--
-- The `@sparx/email-platform` DEFAULT_AUTOMATIONS catalog + its `evaluateTrigger`
-- engine are deleted; the unified `@sparx/automation` engine now owns every
-- baked-in workflow (including email sends, via `email.send_campaign`). The
-- `email_scheduled_sends` queue STAYS (it is the shared dispatch queue the
-- unified `enqueueSend` writes to) — only its reference to the legacy automation
-- table is removed. The legacy automation rows are dropped with the table.

-- 1. Drop the FK + column from the scheduled-send queue (it references the
--    legacy automation table, so it must go before the table can be dropped).
ALTER TABLE "email_scheduled_sends" DROP CONSTRAINT IF EXISTS "email_scheduled_sends_automation_id_fkey";
ALTER TABLE "email_scheduled_sends" DROP COLUMN IF EXISTS "automation_id";

-- 2. Drop the legacy automation table. Its tenant/template FKs, indexes, and RLS
--    policies (tenant_isolation) drop with it; the rows are removed.
DROP TABLE IF EXISTS "email_automations";
