-- A saved view's `target` is a SCREEN, and two shipped ones named an endpoint.
--
-- `saved-view-presets.ts` says it plainly: "`target` is the list's route path —
-- the exact `SavedView.target` the UI snapshots (`target={pathname}`)". The two
-- invoicing presets were seeded at `/invoicing/documents`, which is the API
-- route (`/v1/invoicing/documents`). The pane that shows invoices registers
-- `/invoicing/invoices`.
--
-- So both rows existed, on every tenant, on a target nothing asks for. Opening
-- the invoices list and its Views menu answered **"No saved views yet"** over
-- two rows sitting in the database. One of them was "Overdue", which is the
-- answer to the question a receivables list exists to ask.
--
-- Nothing catches this by reading either file: the preset is a string and the
-- pane is a string, in different packages, and they only have to agree at run
-- time on a screen nobody was looking at. `check:saved-view-targets` now
-- compares the two lists, so a target with no pane fails the build.
--
-- ── WHAT THIS MOVES ─────────────────────────────────────────────────────────
--
-- Only the two SHARED, seeded rows (`owner_user_id IS NULL`) at the old target,
-- and only when the tenant has no view of that name at the new one already —
-- there is no unique constraint here, so an unguarded UPDATE would leave a
-- tenant with two "Unpaid" views and no way to tell them apart.
--
-- A person's OWN saved view is never touched. Nobody can have made one at this
-- target (the pane that saves them writes `/invoicing/invoices`), but the
-- predicate says so rather than relying on that.
--
-- Loops tenants and sets `app.tenant_id`: `saved_views` is FORCE RLS and
-- `sparx_owner` is a non-superuser in production, so an unscoped UPDATE would
-- match zero rows and report success.

-- ── AND THE ONES WITH NOWHERE TO GO ─────────────────────────────────────────
--
-- Six more preset targets reached nothing, and unlike invoicing there is no
-- screen to move them to:
--
--   /crm/customers  /crm/orders  /crm/deals  /crm/b2b
--       Real screens, but they do not read this table. They mount the CRM's own
--       `<SavedViewsMenu objectKey="contact">` over `crm_saved_views`, keyed by
--       object rather than by pathname. Seeding starter views for the CRM means
--       seeding them there.
--   /crm/quotes  /b2b/appointments  /b2b/quotes
--       Not screens at all. `/b2b/quotes` came closest and still named a `stage`
--       filter that the pane, the hook and the endpoint all lack.
--
-- Measured before this ran: 328 rows on those six targets across the platform,
-- and NOT ONE of them owned by a person (`owner_user_id IS NULL` on all 328).
-- Nobody could have made one: the only way to create a saved view is the Views
-- menu on a pane, and no pane registers these. They are seed output and nothing
-- else, they have never been visible, and they cannot become visible.
--
-- The delete is still written `owner_user_id IS NULL`. The measurement says the
-- predicate is redundant today; it is there so the statement stays correct if it
-- ever is not.

DO $$
DECLARE
    t       RECORD;
    n       INTEGER;
    moved   INTEGER := 0;
    dropped INTEGER := 0;
    orphans INTEGER := 0;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        UPDATE saved_views sv
           SET "target" = '/invoicing/invoices', "updated_at" = now()
         WHERE sv.tenant_id = t.id
           AND sv."target" = '/invoicing/documents'
           AND sv.owner_user_id IS NULL
           AND NOT EXISTS (
                 SELECT 1 FROM saved_views other
                  WHERE other.tenant_id = t.id
                    AND other."target" = '/invoicing/invoices'
                    AND other.owner_user_id IS NULL
                    AND other."name" = sv."name"
               );
        GET DIAGNOSTICS n = ROW_COUNT;
        moved := moved + n;

        -- Anything still at the old target lost the race above: the tenant
        -- already had a view of that name on the real screen. The stranded copy
        -- is unreachable by construction, so it goes rather than lingering as a
        -- row nothing can open.
        DELETE FROM saved_views
         WHERE tenant_id = t.id
           AND "target" = '/invoicing/documents'
           AND owner_user_id IS NULL;
        GET DIAGNOSTICS n = ROW_COUNT;
        dropped := dropped + n;

        DELETE FROM saved_views
         WHERE tenant_id = t.id
           AND owner_user_id IS NULL
           AND "target" IN (
                 '/crm/customers',
                 '/crm/orders',
                 '/crm/deals',
                 '/crm/b2b',
                 '/crm/quotes',
                 '/b2b/appointments',
                 '/b2b/quotes'
               );
        GET DIAGNOSTICS n = ROW_COUNT;
        orphans := orphans + n;
    END LOOP;

    RAISE NOTICE 'invoicing views moved onto the screen: % moved, % stranded duplicates removed',
        moved, dropped;
    RAISE NOTICE 'seeded views on targets no pane registers: % removed', orphans;
END $$;
