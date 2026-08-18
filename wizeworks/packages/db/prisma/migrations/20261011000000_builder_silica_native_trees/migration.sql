-- Builder engine adoption (docs/118): silica-native tree storage, parallel-run.
--
-- The silica `<Builder>` stores its documents in `@wizeworks/silicaui-html`'s
-- `Node`/`Site` shape, distinct from the legacy sparx `BuilderNode`. Rather than
-- rewrite the live columns in place (which would break the still-sparx storefront
-- mid-cutover), the silica trees land in NEW nullable columns that run alongside
-- the sparx ones: the silica editor reads/writes these, the storefront keeps
-- rendering the sparx `published_tree` until `apps/site` switches to the silica
-- renderer, after which the sparx columns are dropped.
--
-- Purely additive + nullable — no backfill, no RLS change (the builder_* tables
-- already ENABLE + FORCE RLS with a tenant_isolation policy that covers every
-- column of the row). Existing rows keep their sparx trees and get NULL silica
-- trees until a page is materialized silica-native on first load (a lazy re-seed).

-- Page bodies (one silica `Node` per page, mirroring draft/published).
ALTER TABLE "builder_pages"
  ADD COLUMN "silica_draft_tree" JSONB,
  ADD COLUMN "silica_published_tree" JSONB;

-- The shared frame (one silica `Node` with the single Outlet) + the site-global
-- saved-component masters (silica `Site.symbols`), which live with the frame
-- record because they're shared across every page and the frame.
ALTER TABLE "builder_layouts"
  ADD COLUMN "silica_draft_tree" JSONB,
  ADD COLUMN "silica_published_tree" JSONB,
  ADD COLUMN "silica_symbols" JSONB;
