-- Per-SITE CMS editorial: authors + taxonomy (docs/131 §4).
--
-- Three models, and they do NOT all scope the same way — the differences are the
-- substance of this migration rather than incidental detail.
--
-- AUTHORS are public personas, not logins (`user_id` is the separate, optional
-- link to a staff account). The same person may write as "Bob, master machinist"
-- on one site and under a plain name on another, and neither byline — nor its
-- bio and avatar — belongs in the other publication's author picker.
--
-- TAXONOMIES are a SCHEMA ("posts have categories"). That structure is generic,
-- so a shared vocabulary is the common and correct case.
--
-- TAXONOMY TERMS are CONTENT ("Diesel repair" vs "Glazed"). A term is
-- meaningless on the wrong site and would otherwise appear in its category
-- filters and archive pages.
--
-- Because of that split, taxonomy and term scope INDEPENDENTLY rather than the
-- term inheriting from its taxonomy: a shared vocabulary holding per-site terms
-- is the arrangement that is actually useful.
--
-- All nullable, no backfill, no FORCE-RLS loop — NULL means "available
-- everywhere", which is exactly how every existing row behaves today.

ALTER TABLE "authors"        ADD COLUMN "property_id" UUID;
ALTER TABLE "taxonomies"     ADD COLUMN "property_id" UUID;
ALTER TABLE "taxonomy_terms" ADD COLUMN "property_id" UUID;

-- SetNull for AUTHORS, and this is the one that is easy to get wrong. Deleting a
-- site must not delete a PERSON's byline: their published articles reference
-- this row, and cascading would strip the author off work that still exists.
ALTER TABLE "authors" ADD CONSTRAINT "authors_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL;

-- Cascade for the vocabulary and its terms: editorial vocabulary belongs to the
-- business that wrote it. SetNull would PROMOTE a closed business's terms to
-- every remaining site — putting "Diesel repair" in the donut shop's category
-- list, which is the precise defect this migration removes.
ALTER TABLE "taxonomies" ADD CONSTRAINT "taxonomies_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;
ALTER TABLE "taxonomy_terms" ADD CONSTRAINT "taxonomy_terms_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;

-- NOTE: the slug/key unique indexes are UNCHANGED and deliberately do NOT gain
-- property_id. `authors.(tenant_id, slug)`, `taxonomies.(tenant_id, key)` and
-- `taxonomy_terms.(taxonomy_id, slug)` all back URL segments
-- (`/authors/jane`, `/blog/category/specials`). Letting two sites own the same
-- slug inside one tenant reintroduces exactly the ambiguity a slug exists to
-- remove — and would collide a shared (null-site) row with a site-scoped one.

CREATE INDEX "authors_tenant_property_idx"
    ON "authors"("tenant_id", "property_id");
CREATE INDEX "taxonomies_tenant_property_idx"
    ON "taxonomies"("tenant_id", "property_id");
CREATE INDEX "taxonomy_terms_tenant_property_taxonomy_idx"
    ON "taxonomy_terms"("tenant_id", "property_id", "taxonomy_id");
