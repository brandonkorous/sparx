-- Three names the shipping presets wrote into tenant accounts.
--
-- A preset runs once, when someone applies it, and there is no update path
-- afterwards: whatever it wrote stays written. So rewording a preset in source
-- reaches new tenants only, and every account that already applied it keeps the
-- old wording on screen for good. These three are text we wrote, not text the
-- business wrote, which is why they are refreshed here rather than left.
--
--     'Worldwide — free over $75'      ->  'Worldwide: free over $75'     (zone)
--     'Worldwide — standard goods'     ->  'Worldwide: standard goods'    (profile)
--     'US domestic — standard goods'   ->  'US domestic: standard goods'  (profile)
--
-- Each UPDATE matches the FULL old string exactly. A business that renamed its
-- own zone no longer matches, so nothing of theirs is touched. Re-running the
-- migration matches nothing the second time.
--
-- The duplicate that this same rename would otherwise have caused is handled in
-- code, not here: `presets/shipping.ts` decides "already installed?" by looking
-- for the zone BY NAME, so the reworded marker would have missed an existing
-- install, offered the preset again, and laid a second worldwide zone over the
-- first. That marker now accepts both spellings, permanently.
--
-- Loops tenants and sets app.tenant_id per tenant: both tables are FORCE RLS and
-- sparx_owner is a non-superuser in production, so an un-scoped pass would
-- update zero rows there while passing locally as superuser.
DO $$
DECLARE
    t        RECORD;
    n        INTEGER;
    zones    INTEGER := 0;
    profiles INTEGER := 0;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        UPDATE "commerce_shipping_zones"
        SET "name" = 'Worldwide: free over $75', "updated_at" = now()
        WHERE "tenant_id" = t.id
          AND "name" = 'Worldwide ' || U&'\2014' || ' free over $75';
        GET DIAGNOSTICS n = ROW_COUNT;
        zones := zones + n;

        UPDATE "commerce_shipping_profiles"
        SET "name" = 'Worldwide: standard goods', "updated_at" = now()
        WHERE "tenant_id" = t.id
          AND "name" = 'Worldwide ' || U&'\2014' || ' standard goods';
        GET DIAGNOSTICS n = ROW_COUNT;
        profiles := profiles + n;

        UPDATE "commerce_shipping_profiles"
        SET "name" = 'US domestic: standard goods', "updated_at" = now()
        WHERE "tenant_id" = t.id
          AND "name" = 'US domestic ' || U&'\2014' || ' standard goods';
        GET DIAGNOSTICS n = ROW_COUNT;
        profiles := profiles + n;
    END LOOP;

    RAISE NOTICE 'issue 516: % shipping zone(s) and % profile(s) refreshed', zones, profiles;
END $$;
