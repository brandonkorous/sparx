-- Saved pieces become silica-native (builder-audit roadmap slice 7).
--
-- THE PROBLEM. `builder_component_versions.tree` holds a node in the RETIRED `.bx-*`
-- builder's format — `{id, type, props, children}`. The silica `<Builder>` speaks a
-- different shape entirely (`{kind, tag, class, children}`) and cannot render, insert,
-- or edit one. So the tenant-wide "Saved pieces" library, which the workbench still
-- lists and whose detail pane offers an "Edit design" button, points at trees the only
-- surviving editor cannot open. The button deep-links to `builder.studio` with a
-- `componentId` the studio has always ignored, because there was nothing it could do
-- with it.
--
-- WHY A NEW COLUMN RATHER THAN A CONVERSION. Legacy pages were RE-SEEDED at the silica
-- cutover (docs/118 Stage 4), never migrated — there is no BuilderNode→silica converter
-- anywhere in the tree, and writing one would mean re-implementing the retired renderer
-- to resurrect a format we are deleting. A legacy piece therefore stays listed and
-- readable but is not placeable, and says so; anything authored from the silica studio
-- writes `silica_tree`.
--
-- `tree` DROPS NOT NULL for the same reason: a silica-authored piece has no legacy tree
-- to put there, and writing a junk one to satisfy a constraint would put a lie in the
-- column. The service enforces the real rule — a version carries at least one of the
-- two — because "exactly one of these is present" is not a constraint Postgres should
-- be asked to describe when the answer changes as the legacy half is retired.
--
-- ADDITIVE, NO BACKFILL. Existing rows keep their legacy tree and gain a NULL
-- `silica_tree`; nothing is rewritten, so none of the FORCE-RLS backfill footgun
-- (packages/db/CLAUDE.md). Inherits the table's existing RLS policy untouched — a new
-- column on an already-protected table needs no policy change.

ALTER TABLE "builder_component_versions"
    ADD COLUMN "silica_tree" JSONB;

ALTER TABLE "builder_component_versions"
    ALTER COLUMN "tree" DROP NOT NULL;
