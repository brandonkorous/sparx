-- Four starter units that were seeded with British spellings.
--
-- `STARTER_UNITS` in `commerce-schemas/src/uom.ts` is written into a tenant's
-- account once, the first time anybody opens "Units", and there is no update
-- path afterwards: whatever it wrote stays written. So respelling the source
-- reaches new tenants only, and every account seeded before today keeps reading
--
--     1 litre  . 2 litres          1 metre       . 2 metres
--     1 millilitre . 2 millilitres 1 millimetre  . 2 millimetres
--
-- on the Units screen, on every document line that names one, and in every
-- quantity sentence `describeQuantity` builds from the pair.
--
--     'litre'      -> 'liter'        'litres'      -> 'liters'
--     'millilitre' -> 'milliliter'   'millilitres' -> 'milliliters'
--     'metre'      -> 'meter'        'metres'      -> 'meters'
--     'millimetre' -> 'millimeter'   'millimetres' -> 'millimeters'
--
-- This is text WE wrote, not text the business wrote, which is why it is
-- refreshed here rather than left alone.
--
-- Two guards keep it off anything a business owns:
--
--   * `is_system = true`. A unit the tenant added themselves is theirs, even if
--     they happened to name it "litre", and is never touched.
--   * The FULL old string, on both columns at once. A tenant who renamed the
--     seeded row to "litre (UK)" no longer matches and keeps their wording.
--
-- The CODE is the identity and does not move: `L`, `ML`, `M`, `MM` are what a
-- document line snapshots, what `resolveLineUom` matches on, and what the
-- per-tenant unique index is built from. Nothing here can orphan a conversion
-- or a historical line. [[feedback_copy_edit_breaks_identity_lookups]]
--
-- Re-running matches nothing the second time.
--
-- Loops tenants and sets app.tenant_id per tenant: the table is FORCE RLS and
-- sparx_owner is a non-superuser in production, so an un-scoped pass would
-- update zero rows there while passing locally as superuser.
DO $$
DECLARE
    t       RECORD;
    n       INTEGER;
    renamed INTEGER := 0;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        UPDATE "inventory_units_of_measure"
        SET "name" = 'liter', "plural_name" = 'liters', "updated_at" = now()
        WHERE "tenant_id" = t.id
          AND "is_system" = true
          AND "name" = 'litre'
          AND "plural_name" = 'litres';
        GET DIAGNOSTICS n = ROW_COUNT;
        renamed := renamed + n;

        UPDATE "inventory_units_of_measure"
        SET "name" = 'milliliter', "plural_name" = 'milliliters', "updated_at" = now()
        WHERE "tenant_id" = t.id
          AND "is_system" = true
          AND "name" = 'millilitre'
          AND "plural_name" = 'millilitres';
        GET DIAGNOSTICS n = ROW_COUNT;
        renamed := renamed + n;

        UPDATE "inventory_units_of_measure"
        SET "name" = 'meter', "plural_name" = 'meters', "updated_at" = now()
        WHERE "tenant_id" = t.id
          AND "is_system" = true
          AND "name" = 'metre'
          AND "plural_name" = 'metres';
        GET DIAGNOSTICS n = ROW_COUNT;
        renamed := renamed + n;

        UPDATE "inventory_units_of_measure"
        SET "name" = 'millimeter', "plural_name" = 'millimeters', "updated_at" = now()
        WHERE "tenant_id" = t.id
          AND "is_system" = true
          AND "name" = 'millimetre'
          AND "plural_name" = 'millimetres';
        GET DIAGNOSTICS n = ROW_COUNT;
        renamed := renamed + n;
    END LOOP;

    RAISE NOTICE 'issue 710: % starter unit name(s) respelled', renamed;
END $$;
