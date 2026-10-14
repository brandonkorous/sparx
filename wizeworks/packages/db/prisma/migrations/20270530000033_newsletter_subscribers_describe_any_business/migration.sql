-- "Newsletter Subscribers" describes any business, not a shop (Piggles persona P09).
--
-- The built-in group read "Everyone who opted into marketing email (storefront
-- signup, checkout opt-in)." A journal with no shop and no checkout met it as the
-- first answer when she typed "import subscribers", in the platform's retired word
-- for a website. The template now says "Everyone who has said yes to email from you,
-- wherever they signed up." (crm-schemas `builtins/segments.ts`), but each business
-- holds its own copy, seeded once, so the copies are refreshed here.
--
-- Only a copy still carrying the platform's old sentence is touched: a business that
-- wrote its own description keeps it. In dev: 33 businesses.
--
-- Loops tenants and sets app.tenant_id per tenant: segments is FORCE RLS, and the
-- owner role in production is not a superuser, so an unscoped UPDATE would see no rows.

DO $$
DECLARE
    t         RECORD;
    n         INTEGER;
    refreshed INTEGER := 0;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        UPDATE segments
        SET description = 'Everyone who has said yes to email from you, wherever they signed up.'
        WHERE tenant_id = t.id
          AND slug = 'newsletter-subscribers'
          AND is_built_in
          AND description = 'Everyone who opted into marketing email (storefront signup, checkout opt-in).';
        GET DIAGNOSTICS n = ROW_COUNT;
        refreshed := refreshed + n;
    END LOOP;

    RAISE NOTICE 'refreshed % Newsletter Subscribers descriptions', refreshed;
END
$$;
