-- The shipped "Overdue" invoice view asked the wrong question.
--
-- `saved_views` rows are seeded find-or-create by (tenant, target, name) and are
-- NEVER updated afterwards (api-rest lib/saved-view-presets: `if (existing)
-- continue`). So changing the shipped preset fixes new tenants and leaves every
-- existing one with the broken filter. This is that backfill.
--
-- What was broken: the view filtered `status = 'overdue'`. That column is
-- written by `recomputeTotals`, which runs when something is DONE to a document
-- — a line, a payment, a void. A due date passing is not something being done,
-- so nothing rewrites it, and the view returned only the late invoices that
-- happened to be touched after they went late. The B2B dunning scan re-marks its
-- own accounts, so B2B looked fine; a shop billing ordinary customers had
-- nothing doing that for it.
--
-- Measured before the change: 54 documents and $51,456.69 genuinely past due,
-- of which the filter returned 30 and $26,983.76. One shop was owed $986.50
-- across eight late invoices and its Overdue list was empty. The aging report on
-- the same platform had it right the whole time, because it derives from
-- `due_at`.
--
-- The new filter, `pastDue`, asks the due date. It is written as the STRING
-- 'true' because a saved view is a snapshot of a list's URL QUERY PARAMS, and a
-- query param is text: the console types the whole pipeline `Record<string,
-- string>` and the route's `queryBool` reads it back into a boolean at the edge.
--
-- ── SCOPE ───────────────────────────────────────────────────────────────────
--
-- ONLY rows whose config still matches what was shipped, exactly. A merchant who
-- edited their own copy of this view has a different config, does not match, and
-- is left alone — their view is theirs.
--
-- Shared views only (`owner_user_id IS NULL`). A personal view somebody saved
-- for themselves is not a preset.
--
-- Not the `/b2b/invoices` view of the same name: that one is measurably correct
-- (every late B2B invoice on the dev database is marked `overdue`, because the
-- dunning scan writes it) and it reaches a different endpoint, which does not
-- take this filter. It is a separate change and not a silent one.
--
-- ── RLS ─────────────────────────────────────────────────────────────────────
--
-- `saved_views` is FORCE RLS and `sparx_owner` is a non-superuser in production,
-- so a plain UPDATE here sees ZERO rows and reports success. It must loop the
-- tenants and set the GUC. See packages/db/CLAUDE.md.

DO $$
DECLARE
  t RECORD;
  moved INT := 0;
  total INT := 0;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);

    UPDATE saved_views
       SET config = jsonb_build_object('params', jsonb_build_object('pastDue', 'true')),
           updated_at = now()
     WHERE tenant_id = t.id
       AND owner_user_id IS NULL
       AND target = '/invoicing/documents'
       AND name = 'Overdue'
       -- Still exactly as shipped. Anything else is somebody's own edit.
       AND config = '{"params": {"status": "overdue"}}'::jsonb;

    GET DIAGNOSTICS moved = ROW_COUNT;
    total := total + moved;
  END LOOP;

  RAISE NOTICE 'Overdue view now asks the due date on % tenant(s)', total;
END $$;
