-- Issue 120 — her two stylists are staff in Bookings and nobody in My Team.
--
-- `scheduling_resources` (kind='staff') and `staff_members` are two tables
-- holding one fact, and nothing ever wrote both. A salon set two stylists up
-- under Bookings, saw them on every booking form and every calendar column, and
-- was then told by the till's "who sold this" panel that nobody was on her team.
--
-- The model always said they were one person: `staff_members.resource_id` has
-- pointed at the bookable resource since the module was designed. Only the write
-- path was missing, so every staff resource created before this has no person.
--
-- SITE LINKS ARE PART OF THE BACKFILL, not an extra. The two tables read an
-- empty list in OPPOSITE directions: a resource with no links works every site,
-- while a person with no links matches no site-scoped roster at all. Copying
-- "nothing" across would create people the roster still could not see.
--
-- Per-tenant, with `app.tenant_id` set on each pass. `sparx_owner` is NOT a
-- superuser in production, so an unscoped write under FORCE RLS touches zero
-- rows there while passing locally as superuser — a silent no-op that looks
-- exactly like success.
DO $$
DECLARE
    t         RECORD;
    r         RECORD;
    gap       INTEGER;
    made      INTEGER := 0;
    linked    INTEGER := 0;
    first_nm  TEXT;
    last_nm   TEXT;
    person_id UUID;
    n         INTEGER;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        FOR r IN
            SELECT sr.id, sr.name, sr.color
            FROM scheduling_resources sr
            WHERE sr.tenant_id = t.id
              AND sr.kind = 'staff'
              AND sr.deleted_at IS NULL
              AND btrim(sr.name) <> ''
              AND NOT EXISTS (
                  SELECT 1 FROM staff_members sm
                  WHERE sm.tenant_id = t.id AND sm.resource_id = sr.id
              )
            ORDER BY sr.created_at
        LOOP
            -- First token is the given name, the remainder the family name. A
            -- single word goes entirely in first_name rather than being invented
            -- a surname — the same convention the service layer uses.
            gap := position(' ' IN btrim(r.name));
            IF gap = 0 THEN
                first_nm := btrim(r.name);
                last_nm  := NULL;
            ELSE
                first_nm := substr(btrim(r.name), 1, gap - 1);
                last_nm  := nullif(btrim(substr(btrim(r.name), gap + 1)), '');
            END IF;

            INSERT INTO staff_members
                (tenant_id, first_name, last_name, resource_id, color, updated_at)
            VALUES (t.id, first_nm, last_nm, r.id, r.color, CURRENT_TIMESTAMP)
            RETURNING id INTO person_id;
            made := made + 1;

            -- The sites the resource serves, or every site when it serves them all.
            INSERT INTO staff_member_sites (tenant_id, staff_member_id, property_id, is_primary)
            SELECT t.id, person_id, srp.property_id, false
            FROM scheduling_resource_properties srp
            WHERE srp.resource_id = r.id
            ON CONFLICT (staff_member_id, property_id) DO NOTHING;
            GET DIAGNOSTICS n = ROW_COUNT;

            IF n = 0 THEN
                INSERT INTO staff_member_sites (tenant_id, staff_member_id, property_id, is_primary)
                SELECT t.id, person_id, p.id, false
                FROM properties p
                WHERE p.tenant_id = t.id
                ON CONFLICT (staff_member_id, property_id) DO NOTHING;
            END IF;

            -- Somewhere their cost lands when a time entry names no site of its own.
            UPDATE staff_member_sites
            SET is_primary = true
            WHERE id = (
                SELECT sms.id
                FROM staff_member_sites sms
                JOIN properties p ON p.id = sms.property_id
                WHERE sms.staff_member_id = person_id
                ORDER BY p.is_primary DESC, p.created_at ASC
                LIMIT 1
            );
            GET DIAGNOSTICS n = ROW_COUNT;
            linked := linked + n;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'issue 120: % bookable person(s) joined the roster, % with a home site',
        made, linked;
END $$;
