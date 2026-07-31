-- ─────────────────────────────────────────────────────────────────────────
-- Every SITE owns its brand. Data-only — no schema change.
--
-- THE BUG
-- Brand identity had two homes and a rule that picked between them: the PRIMARY
-- site wrote to `tenant_brands`, every other site to its own
-- `properties.brand_override`, and the read path merged the override over the
-- base. But `tenant_brands` is also the DEFAULT that a site with no override of
-- its own inherits. So the primary site's brand was simultaneously "the primary
-- site's brand" and "the fallback for every sibling site" — and branding the
-- primary silently rebranded every sibling that had not overridden that field.
--
-- Confirmed in prod on 2026-07-31 against the WizeWorks tenant. A logo, dark
-- logo and favicon attached to the `wize.works` site alone came back on
-- `silicaui.wizeworks.sparx.zone` too — same three media ids — along with the
-- primary's freshly-applied theme colour and heading font. Two unrelated web
-- properties, one wearing the other's wordmark.
--
-- The code fix (this migration's companion) makes every site — the primary
-- included — read and write its own `brand_override`. That alone does not repair
-- existing data: the primary's identity is still sitting in `tenant_brands`
-- where the siblings keep inheriting it. This migration moves it.
--
-- WHAT IT DOES, per tenant
--   1. Copies every identity column from `tenant_brands` onto the PRIMARY
--      property's `brand_override`. Keys already present in that override WIN —
--      a site that had explicitly chosen a value keeps it.
--   2. Clears those columns on `tenant_brands`, so the base stops being anything
--      other than a neutral fallback for a site that has never been branded.
--
-- Step 2 is the half that actually closes the leak, and it is deliberately
-- VISIBLE: a non-primary site that was only ever showing the primary's brand by
-- inheritance now falls back to its own theme preset until it is branded. That
-- is the intended outcome — those sites were displaying another site's identity.
-- Sites with their own override (brandonkorous, Template) are untouched.
--
-- Skipped for a tenant with no primary property: nothing to copy onto, so the
-- base is left intact rather than dropped on the floor.
--
-- RLS
-- `tenant_brands` and `properties` are both FORCE ROW LEVEL SECURITY (Decision
-- F3, 20260527000100) and `sparx_owner` is a NON-SUPERUSER in prod, so an
-- unscoped backfill matches `tenant_id = current_tenant_id()` against NULL and
-- touches ZERO rows — silently, and only in prod, because docker's `sparx_owner`
-- is a superuser. Hence the per-tenant `set_config('app.tenant_id', …)` loop.
-- ─────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
    t RECORD;
    moved INTEGER;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, false);

        -- 1. Tenant base identity → the primary site's own override.
        --    `built || existing` puts the EXISTING override on the right of the
        --    jsonb concatenation, so its keys win on collision.
        UPDATE "properties" p
           SET "brand_override" =
                   jsonb_strip_nulls(
                       jsonb_build_object(
                           'businessName',             b."business_name",
                           'tagline',                  b."tagline",
                           'logoLightMediaId',         b."logo_light_media_id",
                           'logoDarkMediaId',          b."logo_dark_media_id",
                           'faviconMediaId',           b."favicon_media_id",
                           'colorPrimary',             b."color_primary",
                           'colorPrimaryForeground',   b."color_primary_foreground",
                           'colorSecondary',           b."color_secondary",
                           'colorSecondaryForeground', b."color_secondary_foreground",
                           'colorAccent',              b."color_accent",
                           'colorAccentForeground',    b."color_accent_foreground",
                           'fontHeading',              b."font_heading",
                           'fontBody',                 b."font_body",
                           'tokens',                   b."tokens"
                       )
                   )
                   || COALESCE(p."brand_override", '{}'::jsonb),
               "updated_at" = now()
          FROM "tenant_brands" b
         WHERE b."tenant_id" = t.id
           AND p."tenant_id" = t.id
           AND p."is_primary";

        GET DIAGNOSTICS moved = ROW_COUNT;

        -- 2. Clear the moved columns — ONLY when step 1 landed somewhere. A
        --    tenant with no primary property keeps its base brand untouched.
        IF moved > 0 THEN
            UPDATE "tenant_brands"
               SET "business_name"              = NULL,
                   "tagline"                    = NULL,
                   "logo_light_media_id"        = NULL,
                   "logo_dark_media_id"         = NULL,
                   "favicon_media_id"           = NULL,
                   "color_primary"              = NULL,
                   "color_primary_foreground"   = NULL,
                   "color_secondary"            = NULL,
                   "color_secondary_foreground" = NULL,
                   "color_accent"               = NULL,
                   "color_accent_foreground"    = NULL,
                   "font_heading"               = NULL,
                   "font_body"                  = NULL,
                   "tokens"                     = NULL,
                   "updated_at"                 = now()
             WHERE "tenant_id" = t.id;
        END IF;
    END LOOP;

    -- Leave no tenant scope set for whatever runs next in this session.
    PERFORM set_config('app.tenant_id', '', false);
END $$;
