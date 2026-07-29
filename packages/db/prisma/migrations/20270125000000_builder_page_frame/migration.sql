-- Per-page frame selection (builder-audit roadmap slice 17 / doc 139 §5).
--
-- THE PROBLEM. Every page of a site wore the same chrome, because the storefront asked
-- for "the frame" — the one `builder_layouts` row with `is_active` — and wrapped every
-- page in it. A chrome-off landing page was therefore unrepresentable: an author could
-- build the page, but not stop the header and footer from appearing around it. So was a
-- second shell for one section of the site (a docs layout with a sidebar, a checkout
-- layout with a stripped header), even though `builder_layouts` has ALWAYS been a
-- per-property CATALOG of many layouts with exactly one active. The shells existed; only
-- the per-page pointer at them was missing.
--
-- THREE STATES IN ONE COLUMN, and the distinction between the two empty-looking ones is
-- the entire feature:
--
--   NULL     → the site default (whichever layout is `is_active`). What every page does
--              unless told otherwise, and — because the column is added NULL — exactly
--              what every page authored before this migration keeps doing.
--   'none'   → NO frame. The page renders bare. This is the campaign/landing page.
--   a uuid   → the `builder_layouts` row with that id.
--
-- WHY A SENTINEL RATHER THAN A SECOND `frameless` BOOLEAN. "Which frame" and "whether a
-- frame" are ONE decision. Two columns make `{frame_id: <uuid>, frameless: true}`
-- representable — a state with no meaning that every reader would then have to decide
-- about, forever. One column with three states cannot express nonsense. The CHECK below
-- is what keeps the sentinel honest: the value is either the literal 'none' or a real
-- uuid, never a typo that silently reads as a dangling id.
--
-- WHY TEXT AND NOT A UUID FK. A uuid column cannot hold 'none', and a foreign key would
-- make deleting a layout either fail or cascade — neither of which is what should happen
-- when an author deletes a shell that pages still point at. A dangling id resolves to NO
-- frame and is REPORTED (silica's `frameDiagnostic`), because quietly restoring the
-- default would put back the header the author deliberately moved this page away from.
--
-- ADDITIVE, NO BACKFILL. Existing rows gain a NULL and keep rendering in the active
-- layout, so none of the FORCE-RLS backfill footgun (packages/db/CLAUDE.md). A new
-- column on an already-protected table inherits the table's RLS policy untouched.

ALTER TABLE "builder_pages"
    ADD COLUMN "frame_id" TEXT;

ALTER TABLE "builder_pages"
    ADD CONSTRAINT "builder_pages_frame_id_check"
    CHECK (
        "frame_id" IS NULL
        OR "frame_id" = 'none'
        OR "frame_id" ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    );

-- Pages that name a specific shell are the minority, so the index is partial: it serves
-- "which pages break if this layout is deleted" without carrying a row for every page
-- that simply takes the default.
CREATE INDEX "builder_pages_frame_id_idx"
    ON "builder_pages" ("tenant_id", "frame_id")
    WHERE "frame_id" IS NOT NULL;
