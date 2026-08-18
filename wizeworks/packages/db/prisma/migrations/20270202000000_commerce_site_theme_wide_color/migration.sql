-- commerce_site_themes: widen the two color columns from VarChar(7) to VarChar(32).
--
-- WHY. These were sized for `#RRGGBB` when every sparx theme token was a hex triplet.
-- The first-party theme catalog is authored in OKLCH — `oklch(99.5% 0.003 200)` is 22
-- characters — so the publish write-through
-- (sitebuilder/services/publish-internals.ts `writeThrough`) hit
--
--     value too long for type character varying(7)
--
-- and, because the write-through runs INSIDE the publish transaction, the entire
-- publish rolled back. The practical effect was that a tenant on any shipped theme
-- could not publish their site at all; only the hex-valued platform base (`sparx`)
-- fitted, which is why this stayed invisible until the catalog was rewritten.
--
-- Widening only. No data is rewritten: every existing value is a 7-character hex
-- string that remains valid in the wider type, and Postgres performs a varchar length
-- INCREASE without a table rewrite (no ACCESS EXCLUSIVE scan, no downtime).
--
-- radius_base is left at VarChar(15) — it carries a CSS length (`0.875rem`) and has
-- not changed value space.

ALTER TABLE "commerce_site_themes"
  ALTER COLUMN "color_background" TYPE VARCHAR(32),
  ALTER COLUMN "color_muted" TYPE VARCHAR(32);
