-- Builder: SEO metadata for published SINGLETON pages (docs/50).
-- Additive: four nullable columns + one boolean default. No backfill — every
-- existing row keeps SEO = NULL / noindex = false, so the storefront falls back
-- to titling the page from its `name` exactly as before. RLS is already
-- ENABLE+FORCE on builder_pages; a column add needs no policy change.

ALTER TABLE "builder_pages"
  ADD COLUMN "seo_title" VARCHAR(255),
  ADD COLUMN "seo_description" VARCHAR(500),
  ADD COLUMN "canonical" VARCHAR(2048),
  ADD COLUMN "og_image" VARCHAR(2048),
  ADD COLUMN "noindex" BOOLEAN NOT NULL DEFAULT false;
