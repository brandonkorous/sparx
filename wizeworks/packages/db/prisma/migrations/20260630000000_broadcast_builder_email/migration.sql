-- Broadcast → Builder email body (docs/52-email-builder.md §6).
--
-- A broadcast can use a published Builder email (the node-tree body) instead of a
-- legacy authored section-list template. `builder_email_id` is a SOFT reference
-- (no FK, like segment_id / customer_id) — the Builder module owns builder_emails;
-- the body source is exactly one of template_id or builder_email_id.
--
-- ADDITIVE + non-destructive: one nullable column on an existing table. No
-- backfill, no RLS change (email_broadcasts already has tenant_isolation).

ALTER TABLE "email_broadcasts" ADD COLUMN "builder_email_id" UUID;
