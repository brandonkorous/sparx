-- A booking's `timezone` is the zone its times are READ in — the owner's diary,
-- the confirmation email, the reminder. Nothing ever set it on a booking made
-- from a website, and the engine fell straight through to 'UTC', so a 2pm
-- appointment in Sacramento was filed as 2pm UTC and every one of those surfaces
-- showed 9pm (issue 108). The engine now takes the zone from the place the
-- booking happens; this repairs the rows written before it did.
--
-- Only rows still sitting on the default are touched, and only where the place
-- says something else — a business genuinely running on UTC is left alone,
-- because for them the stored value was right and still is.
--
-- LOOPS TENANTS AND SETS `app.tenant_id` PER TENANT. `bookings` and
-- `scheduling_locations` are both FORCE RLS and `sparx_owner` is a NON-SUPERUSER
-- in production, so a single un-scoped pass updates zero rows there while passing
-- locally, where the migration runs as a superuser. A backfill that quietly does
-- nothing is worse than one that fails.
DO $$
DECLARE
    t        RECORD;
    tz       TEXT;
    only_one TEXT;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        -- The business's ONLY active place. With two or more we cannot say which
        -- one a booking meant, so those bookings keep what they have rather than
        -- being moved to a guess.
        SELECT MIN(l.timezone) INTO only_one
        FROM scheduling_locations l
        WHERE l.tenant_id = t.id AND l.is_active
        HAVING COUNT(*) = 1;

        UPDATE bookings b
        SET timezone = place.tz
        FROM (
            SELECT
                bk.id AS booking_id,
                COALESCE(own.timezone, via_service.timezone, only_one) AS tz
            FROM bookings bk
            LEFT JOIN scheduling_locations own ON own.id = bk.location_id
            LEFT JOIN scheduling_services svc ON svc.id = bk.service_id
            LEFT JOIN scheduling_locations via_service ON via_service.id = svc.location_id
            WHERE bk.tenant_id = t.id AND bk.timezone = 'UTC'
        ) AS place
        WHERE b.id = place.booking_id
          AND place.tz IS NOT NULL
          AND place.tz <> 'UTC';

        tz := NULL;
        only_one := NULL;
    END LOOP;

    PERFORM set_config('app.tenant_id', '', true);
END $$;
