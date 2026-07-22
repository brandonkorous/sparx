-- Per-SITE CRM tasks (docs/131 §5).
--
-- A task is a work-queue item, and its value here is completing the MEMBER
-- SITE-ACCESS story from §3.3: a staff member scoped to one business should see
-- only that business's task queue. Tasks are already about a customer or deal
-- (both now per-site), so the site is denormalized from whichever it is about at
-- creation; a task tied to neither is a general to-do and stays null (tenant-
-- wide). SetNull — a task is a work record and outlives its site.
--
-- Nullable, no backfill, no FORCE-RLS loop — NULL = tenant-wide, matching today.

ALTER TABLE "tasks" ADD COLUMN "property_id" UUID;

ALTER TABLE "tasks"
    ADD CONSTRAINT "tasks_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL;

CREATE INDEX "tasks_tenant_property_status_due_idx"
    ON "tasks"("tenant_id", "property_id", "status", "due_at");
