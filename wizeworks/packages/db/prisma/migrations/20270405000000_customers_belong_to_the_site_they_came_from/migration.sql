-- Customers belong to the site they came from (issue 152).
--
-- `customers.property_id` is the site a customer belongs to, and NULL means
-- "belongs to the business, not to any one site". The public booking form never
-- set it, so every customer created by somebody booking through a website came
-- out site-less. That reads identically to a correct value until something joins
-- on it — and the per-site membership lookup does, so the first time one of them
-- made an account she was silently duplicated: one row holding her appointments,
-- one holding her login, and "You have no upcoming bookings" in front of her.
--
-- The write path is fixed. This repairs what it already wrote.
--
-- ONLY WHERE THERE IS NOTHING TO GUESS. A tenant with exactly one site has one
-- possible answer, so the site is filled in. A tenant with two or more sites is
-- LEFT ALONE — there the absence might be the truth (a customer who belongs to
-- the business rather than to one of its shops), and choosing one for her would
-- move her records between two businesses. Those rows complete themselves when
-- the person next signs in, on the site she signs in from.
--
-- LOOPS TENANTS AND SETS `app.tenant_id` PER TENANT. `customers` and
-- `properties` are both FORCE RLS and `sparx_owner` is a NON-SUPERUSER in
-- production, so a single un-scoped pass updates zero rows there while passing
-- locally, where the migration runs as a superuser. A backfill that quietly does
-- nothing is worse than one that fails.
--
-- Idempotent: a re-run matches nothing, because every row it would touch now has
-- a property_id.
DO $$
DECLARE
    t         RECORD;
    only_site UUID;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        SELECT MIN(p.id) INTO only_site
        FROM properties p
        WHERE p.tenant_id = t.id
        HAVING COUNT(*) = 1;

        IF only_site IS NOT NULL THEN
            UPDATE customers c
            SET property_id = only_site
            WHERE c.tenant_id = t.id
              AND c.property_id IS NULL;
        END IF;

        only_site := NULL;
    END LOOP;

    PERFORM set_config('app.tenant_id', '', true);
END $$;
