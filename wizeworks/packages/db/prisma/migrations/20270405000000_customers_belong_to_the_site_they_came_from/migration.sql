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
    filled    INTEGER;
    total     INTEGER := 0;
    skipped   INTEGER := 0;
    n         INTEGER;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        -- `array_agg(...)[1]` rather than `MIN(...)`: Postgres has no `min()`
        -- aggregate for uuid. The HAVING carries the meaning anyway — there is
        -- exactly one row, so which element is taken cannot matter.
        SELECT (array_agg(p.id))[1] INTO only_site
        FROM properties p
        WHERE p.tenant_id = t.id
        HAVING COUNT(*) = 1;

        IF only_site IS NOT NULL THEN
            -- NOT EVERY SITE-LESS ROW CAN BE FILLED IN, and the ones that cannot
            -- are precisely the duplicates this issue is about.
            --
            -- `customers_tenant_property_email_unique` is (tenant_id,
            -- property_id, email). NULL property_id never collides, which is why
            -- these rows could pile up in the first place — stamp the site on and
            -- they collide with the row the same person's ACCOUNT created. A
            -- straight UPDATE therefore aborts the whole migration on the first
            -- tenant that has such a pair, which is most of them.
            --
            -- So the pairs are LEFT ALONE. Merging them is a real decision with
            -- bookings and orders hanging off both halves, and a migration is the
            -- wrong place to make it silently; `merge_customers` is the right one.
            -- Two site-less rows sharing an email are skipped for the same reason
            -- — they would collide with each other, and which one is hers is not
            -- knowable from here.
            --
            -- Emails compare with `=`, matching the index's own semantics: it is
            -- case-sensitive, and a NULL email never collides with anything.
            UPDATE customers c
            SET property_id = only_site
            WHERE c.tenant_id = t.id
              AND c.property_id IS NULL
              AND (
                  c.email IS NULL
                  OR NOT EXISTS (
                      SELECT 1
                      FROM customers d
                      WHERE d.tenant_id = t.id
                        AND d.id <> c.id
                        AND (d.property_id = only_site OR d.property_id IS NULL)
                        AND d.email = c.email
                  )
              );
            GET DIAGNOSTICS filled = ROW_COUNT;
            total := total + filled;

            SELECT COUNT(*) INTO n
            FROM customers c
            WHERE c.tenant_id = t.id AND c.property_id IS NULL;
            skipped := skipped + n;
        END IF;

        only_site := NULL;
    END LOOP;

    PERFORM set_config('app.tenant_id', '', true);

    -- Say what landed. A backfill that reports nothing is indistinguishable from
    -- one that did nothing.
    RAISE NOTICE 'customers given the site they came from: % filled, % left for a merge', total, skipped;
END $$;
