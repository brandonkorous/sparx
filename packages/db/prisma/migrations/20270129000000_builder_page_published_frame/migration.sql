-- Put the per-page frame choice inside the publish lifecycle
-- (builder-audit roadmap slice 17 / doc 139 §5).
--
-- THE PROBLEM, and it only became reachable now. `frame_id` shipped in
-- 20270125000000_builder_page_frame as a single column read live by the storefront:
-- `getPublishedFrame` resolves the chrome for a path straight off the page row, with no
-- stage. That was invisible while nothing could WRITE the column — MCP has no frame
-- argument, and the editor had no picker — so every row held NULL and every page took
-- the site default. The editor's frame picker changes that, and it would have shipped
-- this behaviour with it:
--
--   an author sets a page to "no header or footer", presses Save, and the LIVE site
--   drops the header on that page — while the page BODY visitors see is still the last
--   published one, and the Publish button reports nothing to publish.
--
-- Every other visible thing in this editor is drafted until Publish. Chrome is the most
-- visible thing on a page, so a pointer at it cannot be the exception, and "the editor
-- silently changed production" is a worse failure than any staleness.
--
-- THE FIX is the pair the tree columns already use — `silica_draft_tree` /
-- `silica_published_tree` — applied to the pointer: `frame_id` is what the author is
-- editing, `published_frame_id` is what visitors are served. The CHECK is the same one
-- `frame_id` carries, because the column holds the same three states (NULL = the site
-- default, 'none' = bare, a uuid = that layout) and a sentinel that can drift into a
-- typo silently reads as a dangling id.
--
-- NO BACKFILL, and that is a decision rather than an omission. Copying
-- `frame_id` -> `published_frame_id` would preserve today's live-on-save behaviour for
-- any row that already had a value; leaving it NULL declares those choices UNPUBLISHED,
-- which is what they are — nobody ever published them, because there was no way to.
-- Every such page keeps rendering in the site default until its owner presses Publish,
-- which is exactly what they see in the editor. It also sidesteps the FORCE-RLS backfill
-- footgun (packages/db/CLAUDE.md): no UPDATE, so nothing to loop tenants for.
--
-- NO INDEX. `frame_id` carries a partial index because it answers "which pages break if
-- this layout is deleted" across the property. This column is only ever read from a page
-- row the storefront has already located by slug, so an index would carry rows for no
-- query.
--
-- ADDITIVE. A new column on an already-protected table inherits the table's RLS policy
-- untouched; `builder_pages` keeps ENABLE + FORCE.

ALTER TABLE "builder_pages"
    ADD COLUMN "published_frame_id" TEXT;

ALTER TABLE "builder_pages"
    ADD CONSTRAINT "builder_pages_published_frame_id_check"
    CHECK (
        "published_frame_id" IS NULL
        OR "published_frame_id" = 'none'
        OR "published_frame_id" ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    );
