-- The blueprint install ledger keys an email artifact on its NAME.
--
-- `blueprint-baseline.ts` builds each artifact's correlation key from the bundle,
-- and for `kind = 'email'` that key is the email's display name:
--
--     out.push({ kind: 'email', naturalKey: e.name, ... })
--
-- Every other kind uses something stable (a handle, a page key, typeKey:slug).
-- Email is the one that uses a sentence a person reads, so rewording that
-- sentence in the bundle silently breaks the link between the bundle entity and
-- the row it created. The updater does not see a rename; it sees one artifact
-- removed and a different one added, and on apply it CREATES A SECOND EMAIL in
-- the tenant's account. For a welcome sequence that means the same message goes
-- out twice.
--
-- The em-dash sweep reworded exactly one such name, in 22 bundles:
--
--     'Welcome — day 3'  ->  'Welcome: day 3'
--
-- so this moves the ledger key to match, ahead of the bundles shipping. Only the
-- KEY moves. The stored `baseline` still holds the old name, which is what makes
-- the rename read as an ordinary one-sided upstream change and fast-forward the
-- tenant's email through the normal update path, or raise a conflict if the
-- tenant renamed it themselves. That is the machinery working, rather than this
-- migration reaching into their content.
--
-- The uniqueness guard is (install_id, kind, natural_key). No install can hold
-- both spellings today, but the NOT EXISTS keeps the statement safe to re-run and
-- safe on any database that somehow does.
--
-- Loops tenants and sets app.tenant_id per tenant: the table is FORCE RLS and
-- sparx_owner is a non-superuser in production, so an un-scoped pass would
-- update zero rows there while passing locally as superuser.
DO $$
DECLARE
    t     RECORD;
    n     INTEGER;
    moved INTEGER := 0;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        UPDATE "tenant_blueprint_install_artifacts" a
        SET "natural_key" = 'Welcome: day 3',
            "updated_at"  = now()
        WHERE a."tenant_id" = t.id
          AND a."kind" = 'email'
          AND a."natural_key" = 'Welcome ' || U&'\2014' || ' day 3'
          AND NOT EXISTS (
              SELECT 1
              FROM "tenant_blueprint_install_artifacts" b
              WHERE b."install_id" = a."install_id"
                AND b."kind" = 'email'
                AND b."natural_key" = 'Welcome: day 3'
          );

        GET DIAGNOSTICS n = ROW_COUNT;
        moved := moved + n;
    END LOOP;

    RAISE NOTICE 'issue 516: % blueprint email artifact(s) keep their ledger key', moved;
END $$;
