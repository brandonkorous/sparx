-- Per-SITE legacy CMS pages + content types (docs/131 §4).
--
-- PAGE: a page's slug is a URL, and two sites have unrelated path spaces (the
-- same reasoning as Redirect, §3.8). The `pages` table is still live — the
-- universal search projection, the chat AI's grounding, and the dashboard
-- counters all read it — so a page authored for one storefront was searchable on
-- the other and fed the wrong site's AI answers. Direct nullable column; NULL
-- reads as "every site", which is how legacy pages behave today. Uniqueness moves
-- to (tenant, property, slug) so two sites may each own `/about`.
--
-- CONTENT_TYPE: a SCHEMA ("a blog post has these fields"), so — exactly like
-- Taxonomy (§4) — the structure is generic and shared is the common case, while
-- its ENTRIES are the per-site content (ContentEntry is already scoped via the
-- content_entry_properties junction). Nullable, and its `key` uniqueness stays
-- per TENANT because `key` + `url_pattern` route entries and must be unambiguous.
--
-- Both nullable, no backfill, no FORCE-RLS loop — NULL = every site, matching
-- existing behaviour.

-- ── pages ──────────────────────────────────────────────────────────────────
ALTER TABLE "pages" ADD COLUMN "property_id" UUID;

ALTER TABLE "pages"
    ADD CONSTRAINT "pages_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;

-- Re-cut slug uniqueness to include the site. NULLS NOT DISTINCT so the
-- tenant-wide tier (property_id IS NULL) still cannot hold two pages at one slug.
-- On this table the old uniqueness is a bare unique INDEX (not a table
-- constraint — verified against the live schema), so DROP INDEX is correct;
-- the channels migration hit the constraint variant and needed DROP CONSTRAINT.
-- The distinction is per-table and worth checking, not assuming.
DROP INDEX "pages_tenant_id_slug_key";
CREATE UNIQUE INDEX "pages_tenant_id_property_id_slug_key"
    ON "pages"("tenant_id", "property_id", "slug") NULLS NOT DISTINCT;

CREATE INDEX "pages_tenant_property_status_idx"
    ON "pages"("tenant_id", "property_id", "status");

-- ── content_types ──────────────────────────────────────────────────────────
ALTER TABLE "content_types" ADD COLUMN "property_id" UUID;

ALTER TABLE "content_types"
    ADD CONSTRAINT "content_types_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;

-- key uniqueness UNCHANGED and deliberately per-tenant (see the model note).

CREATE INDEX "content_types_tenant_property_idx"
    ON "content_types"("tenant_id", "property_id");
