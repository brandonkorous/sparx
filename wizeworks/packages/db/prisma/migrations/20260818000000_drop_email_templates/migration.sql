-- docs/93 — collapse to one tenant-email system.
--
-- The legacy `email_templates` table backed two retired surfaces: the built-in
-- transactional override page (`source='builtin'`) and the authored section-list
-- marketing body (`source='authored'`). Both are gone: every tenant→customer email
-- is now a Builder-authored node tree (BuilderEmail, rendered by key at dispatch),
-- and platform/auth emails are coded @sparx/email components.
--
-- `email_broadcasts.template_id` and `email_scheduled_sends.template_id` are dead
-- legacy FK columns — never written by current code (a broadcast references its
-- Builder email via `builder_email_id`). Drop the columns (which also drops their
-- FK constraints), then drop the table (its RLS policy + indexes go with it).

ALTER TABLE "email_broadcasts" DROP COLUMN "template_id";

ALTER TABLE "email_scheduled_sends" DROP COLUMN "template_id";

DROP TABLE "email_templates";
