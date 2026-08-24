-- A place can say its clock is the business's — issue 178.
--
-- `scheduling_locations.timezone` was NOT NULL DEFAULT 'UTC', so a place had no
-- way to say nobody had chosen. Every tenant that ever switched Scheduling on
-- got a seeded 'Main location' asserting it was in UTC, on a screen whose own
-- description reads "The zone this place is in" — while Business details, two
-- clicks away, correctly said "Nothing set". Issue 108 then made a booking
-- follow its place, which turned that unchosen default into the thing deciding
-- what time an appointment happens.
--
-- NULL now means "follow the business" (tenant_businesses.timezone), matching
-- how that column already expresses the same absence.

ALTER TABLE scheduling_locations
    ALTER COLUMN timezone DROP NOT NULL,
    ALTER COLUMN timezone DROP DEFAULT;

-- Clear the rows that were provably never chosen, and only those.
--
-- 'UTC' alone is not evidence: a business genuinely running on UTC would look
-- identical. The guard is the full fingerprint of the seeder's own write
-- (provisioning.ts) — its exact name, its exact value, no site links, and a row
-- never saved since it was created. Prisma's @updatedAt sets updated_at on
-- create, so equality holds until the first save and never again. A place
-- somebody has opened and saved is left alone even if it still says UTC.
--
-- Loops tenants and sets app.tenant_id per tenant: scheduling_locations is FORCE
-- RLS and sparx_owner is a non-superuser in production, so an un-scoped pass
-- updates zero rows there while passing locally as superuser.
DO $$
DECLARE
    t       RECORD;
    n       INTEGER;
    cleared INTEGER := 0;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        UPDATE scheduling_locations l
        SET timezone = NULL
        WHERE l.tenant_id = t.id
          AND l.timezone = 'UTC'
          AND l.name = 'Main location'
          AND l.updated_at = l.created_at
          AND NOT EXISTS (
              SELECT 1 FROM scheduling_location_properties p
              WHERE p.location_id = l.id
          );

        GET DIAGNOSTICS n = ROW_COUNT;
        cleared := cleared + n;
    END LOOP;

    RAISE NOTICE 'issue 178: % seeded place(s) now follow the business clock', cleared;
END $$;
