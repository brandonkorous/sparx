-- Builder — the silica saved-theme LIBRARY (silicaui 0.16). silica's `<Builder>`
-- now round-trips a `Site.savedThemes: Theme[]` — the "This site" theme presets an
-- author snapshots in the Themes panel — through `onChange`, exactly like the
-- document/theme/symbols. It is AUTHORING state: the storefront renders only the
-- active `theme`, so this needs a DRAFT column only (no published copy, unlike
-- theme/symbols on this table).
--
-- Additive + non-destructive: one nullable column on the existing per-property
-- builder_sites record (added by 20261012000000_builder_site_theme_symbols). NULL
-- until the author saves their first theme (silica seeds the library with the
-- current theme on load). RLS is already ENABLE+FORCE on the table with a
-- tenant_isolation policy — a new column inherits it, no policy change needed.

ALTER TABLE "builder_sites" ADD COLUMN "silica_draft_saved_themes" JSONB;
