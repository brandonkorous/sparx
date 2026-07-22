-- Restore the "every tenant has exactly one primary site" invariant.
--
-- `provision-tenant.ts` creates one primary Property for every tenant, and a
-- partial unique index (tenant_id) WHERE is_primary enforces there is never more
-- than one. What nothing enforced is that there is at least ONE — so tenants
-- built by older TEST FIXTURES, which skipped the Property, have zero.
--
-- Measured on the dev database: six such tenants (gqlcrm-*, inv-test-*, test-*,
-- bp-update-verify-*), all abandoned test residue. In production this migration
-- is a NO-OP, because every tenant there came through provisioning.
--
-- Worth doing anyway, and separately from the migrations that exposed it:
--
--   · 20261221000000 hit this and had to repair inline before it could set
--     billing_documents.property_id NOT NULL. Every future site-scoping
--     migration with a required column would hit the same wall and grow the same
--     inline repair — six copies of one fix, each slightly different.
--   · A tenant with no site is not a real state. It cannot render a storefront,
--     send an email under its own name, or issue an invoice. Leaving it in place
--     means every reader downstream has to carry a "what if there is no primary"
--     branch for a case that should be impossible.
--
-- The fixtures themselves were fixed alongside this (services/api-rest/test/
-- helpers.ts and packages/crm/test/helpers.ts both seed a primary now), so this
-- cleans up what they already produced rather than papering over a live source.
--
-- The repaired row is exactly what provisioning would have written: slug
-- 'primary', name from the tenant, is_primary = true. Not a guess — the row that
-- was always meant to exist.

DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN
        SELECT tn.id, tn.name
          FROM "tenants" tn
         WHERE NOT EXISTS (
               SELECT 1 FROM "properties" p
                WHERE p.tenant_id = tn.id AND p.is_primary
         )
    LOOP
        -- `properties` is FORCE RLS and `sparx_owner` is a NON-SUPERUSER in
        -- production, so the INSERT needs the tenant GUC set even though the
        -- SELECT above reads a non-RLS table.
        PERFORM set_config('app.tenant_id', t.id::text, true);

        -- created_at/updated_at supplied EXPLICITLY: Prisma's @updatedAt is an
        -- application-layer behaviour, not a DB default, so raw migration SQL
        -- must write them or trip the NOT NULL. (This exact omission failed the
        -- first run of 20261221000000's inline repair.)
        INSERT INTO "properties" ("tenant_id", "slug", "name", "is_primary", "created_at", "updated_at")
        VALUES (t.id, 'primary', t.name, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT DO NOTHING;
    END LOOP;

    PERFORM set_config('app.tenant_id', '', true);
END $$;
