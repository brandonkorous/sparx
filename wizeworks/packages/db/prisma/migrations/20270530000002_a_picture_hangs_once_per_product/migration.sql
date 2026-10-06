-- A picture hangs once per product (sparx persona issue 055).
--
-- Importing the same products file twice added every picture again: the move-in
-- importer re-attached each gallery image without asking what the product
-- already had. Gillett Diesel's 643 products each showed their photo twice. The
-- importer now skips a picture already in place; this removes the copies it
-- already made.
--
-- One placement is a (product, version or none, picture) triple. The copy kept is
-- the main picture if one of them is, then the lowest position, then the oldest.
-- Option-value links on a removed copy go with it (ON DELETE CASCADE).
--
-- Loops tenants and sets app.tenant_id per tenant: the table is FORCE RLS, and the
-- owner role in production is not a superuser.
DO $$
DECLARE
    t       RECORD;
    n       INTEGER;
    removed INTEGER := 0;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        DELETE FROM "commerce_variant_images" i
        USING (
            SELECT "id",
                   row_number() OVER (
                       PARTITION BY "product_id", COALESCE("variant_id"::text, '-'), "media_asset_id"
                       ORDER BY "is_primary" DESC, "position" ASC, "created_at" ASC, "id" ASC
                   ) AS rn
            FROM "commerce_variant_images"
            WHERE "tenant_id" = t.id
        ) ranked
        WHERE i."id" = ranked."id" AND ranked.rn > 1;
        GET DIAGNOSTICS n = ROW_COUNT;
        removed := removed + n;
    END LOOP;
    RAISE NOTICE 'duplicate product pictures removed: %', removed;
END $$;
