-- Email builder → silica adoption (docs/120, Stage 2) — the parallel-run storage
-- for a silica-native email. silicaui 0.17's email editor hands back an
-- `EmailDocument` (subject + preheader + a closed `body` node tree) the same way
-- the site builder hands back a `Site`; this stores it ALONGSIDE the existing
-- sparx `BuilderNode` `draft_tree`/`published_tree`, which stay as the FALLBACK
-- until each email is re-authored on silica (docs/120 D1). A row that carries a
-- silica document renders through `renderSilicaEmail`; a row that doesn't renders
-- through the legacy `renderEmailTree` — so no email breaks mid-migration.
--
-- Additive + non-destructive: two nullable columns on the existing per-(tenant,
-- property?, key?) `builder_emails` row. NULL until the author saves/publishes a
-- silica document. The whole override + keyed-default machinery is untouched — a
-- silica email is the SAME row, just carrying a silica document. RLS is already
-- ENABLE+FORCE on the table with a tenant_isolation policy — new columns inherit
-- it, no policy change needed.

ALTER TABLE "builder_emails"
  ADD COLUMN "silica_draft_document"     JSONB,
  ADD COLUMN "silica_published_document" JSONB;
