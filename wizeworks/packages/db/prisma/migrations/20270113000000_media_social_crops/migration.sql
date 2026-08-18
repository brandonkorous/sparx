-- Media social aspect crops (docs/133 §8, docs/134 Slice 6).
--
-- Adds the `aspect` discriminator to media_variants so the media worker can store
-- focal-point-aware cover crops (1:1 / 4:5 / 9:16 / 16:9) alongside the ordinary
-- scale-to-width variants (aspect IS NULL). The composer previews these + exposes the
-- draggable focal point; the social-worker picks the crop nearest each target
-- platform's required ratio at publish time.

ALTER TABLE "media_variants" ADD COLUMN "aspect" varchar(12);

-- Swap the (asset_id, format, width) unique for one that also keys on the crop
-- aspect, so a 1:1 and a 4:5 at the same width coexist. NULLS NOT DISTINCT keeps the
-- ordinary scale-to-width variants (aspect IS NULL) uniquely constrained per
-- (asset_id, format, width) — a plain unique treats every NULL as distinct and would
-- let duplicate base variants through (mirrors social_connections' NULLS NOT DISTINCT
-- index, migration 20270111000000).
DROP INDEX "media_variants_asset_id_format_width_key";
CREATE UNIQUE INDEX "media_variants_asset_format_width_aspect_unique"
  ON "media_variants" ("asset_id", "format", "width", "aspect") NULLS NOT DISTINCT;
