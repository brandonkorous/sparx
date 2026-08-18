-- ─────────────────────────────────────────────────────────────────────────
-- Record detail pages get a real address.
--
-- A page that renders ONE record — a product at /products/brake-kit, a post at
-- /blog/x — was identified by `kind='collection'` + `record_type`, with `slug`
-- left NULL. That is a second addressing system living beside slugs, and it cost
-- more than it looks: the editor's page switcher is a list of ADDRESSED pages, so
-- a page without one never appeared in it and no tenant could ever open, edit or
-- restyle their product page. The pages rendered fine — the platform ships a
-- code-authored template per record type — but they were unreachable to their
-- owner.
--
-- This gives each one the address it already has in the router:
--
--     commerce.product     →  /products/:handle
--     commerce.collection  →  /collections/:handle
--     commerce.category    →  /category/:handle
--     cms.blog_post        →  /blog/:slug
--     scheduling.service   →  /book/:serviceId
--
-- The five strings are a CLOSED SET, authored in
-- `packages/silica-catalog/src/record-templates.ts` (`RECORD_ADDRESSES`) and
-- mirrored here. They are the only slugs on the platform that contain a `:`, and
-- nothing else may create one — `siteService.sync` rejects any other colon slug.
-- That is what keeps every lookup an exact string comparison instead of forcing a
-- route matcher into the sitemap, the link checker, the frame resolver and the
-- storefront read.
--
-- `kind` and `record_type` are deliberately LEFT IN PLACE and kept in step. A
-- half-dozen consumers still read them (the sitemap's `kind='singleton'` filter,
-- the Pages report's prefix rollup, the link checker's relative-path rule, the
-- storefront's legacy per-record tier). Dropping them belongs in the same change
-- that migrates the blueprint baseline natural key off `type:<recordType>`, not
-- ahead of it.
--
-- ── DUPLICATES ────────────────────────────────────────────────────────────
-- `(tenant_id, property_id, slug)` is UNIQUE, and nothing ever stopped a property
-- from holding SEVERAL templates for one record type — `builder_page_assignments`
-- exists precisely so a specific product could be pinned to a different one. Two
-- of those given the same address would abort this migration and therefore the
-- release. So exactly one row per (property, record_type) is addressed — the
-- `is_default` winner, else the lowest `position` — and the rest are demoted to
-- ordinary unrouted pages the tenant can keep, edit or delete. Nothing is
-- deleted here.
--
-- Run `pnpm --filter @sparx/db db:report:record-pages` BEFORE this ships: it
-- names every property this would demote a page on.
--
-- ── RLS (packages/db/CLAUDE.md) ───────────────────────────────────────────
-- `builder_pages` is ENABLE + FORCE ROW LEVEL SECURITY and `sparx_owner` is a
-- NON-SUPERUSER in production, so an unscoped UPDATE here sees ZERO rows and
-- succeeds silently — passing locally (superuser) and doing nothing in prod. The
-- loop below sets `app.tenant_id` per tenant, the same shape as
-- 20260628000000_builder_per_property.
-- ─────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
    v_tenant UUID;
    v_addr   RECORD;
BEGIN
    FOR v_tenant IN SELECT "id" FROM "tenants" LOOP
        PERFORM set_config('app.tenant_id', v_tenant::text, true);

        FOR v_addr IN
            SELECT * FROM (VALUES
                ('commerce.product',    '/products/:handle'),
                ('commerce.collection', '/collections/:handle'),
                ('commerce.category',   '/category/:handle'),
                ('cms.blog_post',       '/blog/:slug'),
                ('scheduling.service',  '/book/:serviceId')
            ) AS t(record_type, slug)
        LOOP
            -- ONE winner per (property, record_type). `is_default` first — that is
            -- the flag the storefront's own resolver preferred, so the page being
            -- addressed is the one visitors were already being served.
            WITH ranked AS (
                SELECT "id",
                       ROW_NUMBER() OVER (
                           PARTITION BY "property_id"
                           ORDER BY "is_default" DESC, "position" ASC, "created_at" ASC
                       ) AS rn
                  FROM "builder_pages"
                 WHERE "kind" = 'collection'
                   AND "record_type" = v_addr.record_type
                   -- Idempotent: a property whose row already carries the address
                   -- (the code seeds one on load) is skipped rather than fought over.
                   AND ("slug" IS NULL OR "slug" NOT LIKE '%:%')
            )
            UPDATE "builder_pages" p
               SET "slug" = v_addr.slug
              FROM ranked
             WHERE p."id" = ranked."id"
               AND ranked.rn = 1
               -- Never steal an address a page in this property already holds.
               AND NOT EXISTS (
                   SELECT 1 FROM "builder_pages" q
                    WHERE q."property_id" = p."property_id"
                      AND q."slug" = v_addr.slug
               );

            -- The runners-up become ordinary pages. They keep their name, their
            -- tree and their SEO — only their claim on the record route goes, which
            -- is the claim that cannot be honoured by two pages at once.
            UPDATE "builder_pages"
               SET "kind" = 'singleton',
                   "record_type" = NULL,
                   "is_default" = FALSE
             WHERE "kind" = 'collection'
               AND "record_type" = v_addr.record_type
               AND ("slug" IS NULL OR "slug" NOT LIKE '%:%');
        END LOOP;
    END LOOP;
END
$$;

-- Every row that DID get an address is a record page, so restate the two derived
-- columns from it. Same rule `siteService.sync` applies on every later write, so
-- the database and the service agree about what an address implies.
DO $$
DECLARE
    v_tenant UUID;
BEGIN
    FOR v_tenant IN SELECT "id" FROM "tenants" LOOP
        PERFORM set_config('app.tenant_id', v_tenant::text, true);
        UPDATE "builder_pages"
           SET "kind" = 'collection',
               "record_type" = CASE "slug"
                   WHEN '/products/:handle'    THEN 'commerce.product'
                   WHEN '/collections/:handle' THEN 'commerce.collection'
                   WHEN '/category/:handle'    THEN 'commerce.category'
                   WHEN '/blog/:slug'          THEN 'cms.blog_post'
                   WHEN '/book/:serviceId'     THEN 'scheduling.service'
               END
         WHERE "slug" IN (
             '/products/:handle', '/collections/:handle', '/category/:handle',
             '/blog/:slug', '/book/:serviceId'
         );
    END LOOP;
END
$$;
