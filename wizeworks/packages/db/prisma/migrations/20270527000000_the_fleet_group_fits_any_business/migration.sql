-- The built-in fleet group, reworded for every business that has it.
--
-- It was written for one kind of customer: "B2B Fleet", described as "primary
-- target for parts cross-sell", and it is seeded into every account. A linen
-- shop read that in its own list of groups (issue 915). The source now says
-- (crm-schemas/src/builtins/segments.ts):
--
--     name         'Wholesale customers with vehicles'
--     description  'Active wholesale customers with a fleet size of at least 1.
--                   If you do not sell to businesses that run vehicles, this
--                   group stays empty.'
--
-- A built-in is seeded once, so existing accounts keep the old words unless
-- they are refreshed here. These are words we wrote, not words the business
-- wrote. The rule itself is unchanged.
--
-- Name and description are matched SEPARATELY and EXACTLY, and only on the
-- built-in's slug. A business that renamed the group keeps its name; one that
-- rewrote the description keeps its description. The description matches both
-- old spellings: the one with an em dash (refreshed by 20270526000000 just
-- before this) and the one with a colon. Re-running matches nothing.
--
-- Loops tenants and sets app.tenant_id per tenant: `segments` is FORCE RLS and
-- sparx_owner is a non-superuser in production, so an un-scoped pass would
-- update zero rows there while passing locally as superuser.
DO $$
DECLARE
    t            RECORD;
    n            INTEGER;
    names        INTEGER := 0;
    descriptions INTEGER := 0;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        UPDATE "segments"
        SET "name" = 'Wholesale customers with vehicles', "updated_at" = now()
        WHERE "tenant_id" = t.id
          AND "slug" = 'b2b-fleet'
          AND "name" = 'B2B Fleet';
        GET DIAGNOSTICS n = ROW_COUNT;
        names := names + n;

        UPDATE "segments"
        SET "description" = 'Active wholesale customers with a fleet size of at least 1. If you do not sell to businesses that run vehicles, this group stays empty.',
            "updated_at" = now()
        WHERE "tenant_id" = t.id
          AND "slug" = 'b2b-fleet'
          AND "description" IN (
              'B2B accounts with a fleet: primary target for parts cross-sell.',
              'B2B accounts with a fleet ' || U&'\2014' || ' primary target for parts cross-sell.'
          );
        GET DIAGNOSTICS n = ROW_COUNT;
        descriptions := descriptions + n;
    END LOOP;

    RAISE NOTICE 'issue 915: % fleet group name(s) and % description(s) refreshed', names, descriptions;
END $$;
