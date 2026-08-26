-- An abandoned multi-step form is still a lead (docs/151 §7, docs/152 C2).
--
-- Somebody who types an address on step 1 and never reaches the end is the most
-- common outcome of any form longer than one screen, and until now it produced
-- nothing at all. A `partial` submission is that person.
--
-- Two things here:
--
--  1. `partial_step` — how far they got, 1-based. A column rather than a key in
--     the `fields` bag because "most people give up on step 3" is a question the
--     tenant should be able to ask, and a JSON key is not answerable at scale.
--
--  2. A PARTIAL UNIQUE INDEX. As somebody works forward through the steps, each
--     Next must UPDATE their one unfinished row rather than adding another, so
--     the identity of an unfinished form is (tenant, form, email). It is scoped
--     `WHERE status = 'partial'` because completed submissions may legitimately
--     repeat — the same person may contact a business twice — and a plain unique
--     index would forbid that. Prisma cannot express a `WHERE` on an index, so
--     this is hand-authored SQL like the RLS policies, and the service does
--     find-then-write with this index as the backstop against a race.

ALTER TABLE "form_submissions"
    ADD COLUMN "partial_step" INTEGER,
    ADD CONSTRAINT "form_submissions_partial_step_check"
        CHECK ("partial_step" IS NULL OR "partial_step" > 0);

CREATE UNIQUE INDEX "form_submissions_partial_identity_uniq"
    ON "form_submissions" ("tenant_id", "form_node_id", "email")
    WHERE "status" = 'partial' AND "email" IS NOT NULL;

-- The inbox's "who started and stopped" view, newest first. Without it that
-- filter sequential-scans a table whose whole point is that it grows forever.
CREATE INDEX "form_submissions_partial_recent_idx"
    ON "form_submissions" ("tenant_id", "created_at" DESC)
    WHERE "status" = 'partial';
