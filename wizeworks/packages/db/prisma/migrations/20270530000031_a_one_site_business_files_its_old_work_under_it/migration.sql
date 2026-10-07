-- A business with one site files its older work under that site (persona issue 925).
--
-- Orders, bookings and repeat orders made before their writers set a site carry
-- `property_id` NULL: early checkouts, early till sales, orders made from a quote,
-- and every booking made before bookings knew their site. Screens that show ONE
-- site disagree about those rows. Halo & Hem's Orders list showed all three of
-- her orders; Money's By job, scoped to her site, showed one, and its daily
-- profit left the other two out the same way. In dev: 13 orders, 68 bookings and
-- 1 repeat order, across 13 businesses.
--
-- Issue 878 decided a renewal must NOT reach for the primary site when its
-- subscription has none, because with two sites that files real money against a
-- shop that may never have taken it. That holds, and this keeps to it: a
-- business with exactly ONE site has no second shop to get wrong, so its no-site
-- rows can only be that site's. A business with two or more is left as it is.
-- In dev that is 11 of the 13; Juniper Row (7 sites) and the platform's own
-- account (14) keep their NULLs.
--
-- Also the subscriptions, so the next renewal of an old one carries the site
-- too, rather than making a new NULL order every month.
--
-- Loops tenants and sets app.tenant_id per tenant: properties, orders, bookings
-- and commerce_subscriptions are FORCE RLS, and the owner role in production is
-- not a superuser, so an unscoped UPDATE would see no rows.

DO $$
DECLARE
    t       RECORD;
    site    UUID;
    sites   INTEGER;
    n       INTEGER;
    filed   INTEGER := 0;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        SELECT count(*), min(id::text)::uuid INTO sites, site
        FROM properties WHERE tenant_id = t.id;
        CONTINUE WHEN sites <> 1;

        UPDATE orders SET property_id = site
        WHERE tenant_id = t.id AND property_id IS NULL;
        GET DIAGNOSTICS n = ROW_COUNT;
        filed := filed + n;

        UPDATE bookings SET property_id = site
        WHERE tenant_id = t.id AND property_id IS NULL;
        GET DIAGNOSTICS n = ROW_COUNT;
        filed := filed + n;

        UPDATE commerce_subscriptions SET property_id = site
        WHERE tenant_id = t.id AND property_id IS NULL;
        GET DIAGNOSTICS n = ROW_COUNT;
        filed := filed + n;
    END LOOP;

    RAISE NOTICE 'filed % orders, bookings and repeat orders under their business''s only site', filed;
END
$$;
