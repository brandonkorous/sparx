-- One seeded rule per name per tenant, enforced by the database.
--
-- `upsertSystemAutomation` looks for (origin='system', name) and creates the row
-- when it finds none. That is check-then-insert with nothing underneath it, so
-- two seed runs that overlap both look, both find nothing, and both create. The
-- tenant ends up with two ACTIVE copies of one rule, and since most seeded rules
-- send an email, the customer is sent it twice.
--
-- It is not hypothetical. One tenant carries two "Handle form submissions" rows
-- created 2026-07-14 22:16:29.537 and .538 — one millisecond apart, which is a
-- race at provisioning and not a person.
--
-- A partial unique index is the fix: it covers only the seeded rows, so a
-- business may still name its own automations whatever it likes, including the
-- same thing twice. The loser of a race now fails its INSERT instead of
-- succeeding, and `upsertSystemAutomation` catches that and re-reads.
--
-- ── THE DEDUPE ──────────────────────────────────────────────────────────────
--
-- The index cannot be created while a duplicate exists. Duplicates are resolved
-- by keeping the OLDEST row, which is the one anything else would have been
-- wired to, and moving every reference onto it before the younger rows go. The
-- three tables that can point at an automation are handled explicitly rather
-- than left to a cascade, so a row is never deleted while something still names
-- it. `funnels.automation_id` is re-pointed too: a funnel is a tenant's own
-- object and must not lose its rule.
--
-- Loops tenants and sets app.tenant_id per tenant: automations, automation_runs,
-- automation_versions and funnels are all FORCE RLS, and sparx_owner is a
-- non-superuser in production. An un-scoped pass would find no duplicates there,
-- report success, and then fail on CREATE INDEX — or worse, succeed against a
-- database it could not actually see.
DO $$
DECLARE
    t       RECORD;
    n       INTEGER;
    removed INTEGER := 0;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        WITH ranked AS (
            SELECT
                id,
                first_value(id) OVER (
                    PARTITION BY name ORDER BY created_at, id
                ) AS keeper
            FROM automations
            WHERE tenant_id = t.id AND origin = 'system'
        ),
        losers AS (
            SELECT id, keeper FROM ranked WHERE id <> keeper
        ),
        moved_runs AS (
            UPDATE automation_runs r SET automation_id = l.keeper
            FROM losers l WHERE r.automation_id = l.id
            RETURNING 1
        ),
        moved_versions AS (
            UPDATE automation_versions v SET automation_id = l.keeper
            FROM losers l WHERE v.automation_id = l.id
            RETURNING 1
        ),
        moved_funnels AS (
            UPDATE funnels f SET automation_id = l.keeper
            FROM losers l WHERE f.automation_id = l.id
            RETURNING 1
        ),
        moved_clones AS (
            UPDATE automations a SET cloned_from = l.keeper
            FROM losers l WHERE a.cloned_from = l.id
            RETURNING 1
        )
        DELETE FROM automations a
        USING losers l
        WHERE a.id = l.id;

        GET DIAGNOSTICS n = ROW_COUNT;
        removed := removed + n;
    END LOOP;

    RAISE NOTICE 'issue 516: % duplicate seeded rule(s) merged into the original', removed;
END $$;

CREATE UNIQUE INDEX "automations_system_name_key"
  ON "automations" ("tenant_id", "name")
  WHERE "origin" = 'system';
