-- Per-SITE SEO scorecards (docs/131 §4).
--
-- `seo_audits` had no site dimension, so the "site-wide SEO overview" averaged
-- every page a TENANT owns. That does not merely mislabel the number — it
-- computes a DIFFERENT one. A well-optimised machine-shop site drags up a
-- neglected donut site's grade and hides the problem, which is the precise
-- opposite of what an SEO overview exists to do.
--
-- NULLABLE, and this one deserves its reasoning recorded because "required" is
-- the tempting answer and it is wrong. The four audited entity types do not
-- agree on site membership:
--
--   · builder_page  → carries property_id directly. One site's page, full stop.
--   · product       → reaches sites through commerce_product_properties, a
--                     JUNCTION. It can legitimately appear on several sites
--                     while having ONE score, because its title and description
--                     are the same wherever it shows.
--   · collection    → same, via its own junction.
--   · cms_page      → same, via content_entry_properties.
--
-- Pinning a shared product to one site would invent a fact the data does not
-- have. So the column is SET for single-site entities and NULL for shared ones,
-- and a site's overview is "audits scoped to me, UNION audits for entities I
-- expose" — resolved through the junctions that already answer that question.
--
-- No backfill loop needed for the ADD: the column defaults NULL. But existing
-- builder_page rows DO have a correct answer available, so they are filled in
-- below — and that UPDATE needs the per-tenant set_config, since seo_audits is
-- ENABLE+FORCE RLS and `sparx_owner` is a non-superuser in production.

ALTER TABLE "seo_audits" ADD COLUMN "property_id" UUID;

DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM "tenants" LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        UPDATE "seo_audits" a
           SET "property_id" = p."property_id"
          FROM "builder_pages" p
         WHERE a.tenant_id = t.id
           AND a.entity_type = 'builder_page'
           AND p.id = a.entity_id;
    END LOOP;

    PERFORM set_config('app.tenant_id', '', true);
END $$;

-- Cascade: a score is a DERIVED measurement of pages that stop existing when the
-- site does. Unlike an invoice or a consent record there is nothing here worth
-- retaining — a reindex recomputes any of it from scratch.
ALTER TABLE "seo_audits" ADD CONSTRAINT "seo_audits_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;

-- NOTE: the (tenant_id, entity_type, entity_id) unique index is UNCHANGED and
-- deliberately does NOT gain property_id. An entity has one score; adding the
-- site would let the same page hold two contradictory scores under different
-- sites. The key expresses "one score per thing" — property_id is an attribute
-- of the thing, not part of its identity.

CREATE INDEX "seo_audits_tenant_property_score_idx"
    ON "seo_audits"("tenant_id", "property_id", "score");
