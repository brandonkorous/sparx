-- The ready-made reports count what their own words say (sparx persona issue 250)
--
-- Three of the eight reports `report-builtins.ts` ships counted things their
-- descriptions say they leave out:
--
--   deals-by-stage        "open deals"                   no filter: won and lost counted
--   open-tasks-by-owner   "everything still to do"       canceled tasks counted
--   requests-by-urgency   "nobody has answered yet"      answered-but-open counted
--
-- MEASURED 2026-10-13 on the dev database: Gillett's "Where your deals are"
-- listed a Lost stage ($15,000); 3 canceled tasks have no completion date; 6 of
-- 14 unsorted requests had already been answered.
--
-- The source file now filters deals on "Closed" not set, tasks on status
-- "open", and says "not sorted yet" for requests. The seed only installs what is
-- MISSING, so existing businesses need this, as
-- `20270518000000_the_ready_made_reports_say_what_this_file_says` explains.
--
-- MATCHED ON builtin_slug. GATED ON created_at = updated_at: a ready-made report
-- cannot be edited in place (report-service refuses it), so every row matches,
-- and the gate is kept for the same reason the earlier migration kept it.
-- `updated_at` is written back to itself. Idempotent; a no-op on a fresh
-- install, because the seed already writes the new definition.
--
-- THE TENANT LOOP: `crm_reports` carries ENABLE + FORCE row level security and
-- `sparx_owner` is a non-superuser in production, so a plain UPDATE would see no
-- rows there (wizeworks/packages/db/CLAUDE.md, "Backfilling a FORCE-RLS table").

DO $$
DECLARE
  t       RECORD;
  touched INT;
  total   INT := 0;
BEGIN
  FOR t IN SELECT id FROM "tenants" LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);

    UPDATE "crm_reports" AS r
    SET "filters" = '{"logic":"AND","conditions":[{"field":"closedAt","operator":"is_not_set"}]}'::jsonb,
        "updated_at" = r."updated_at"
    WHERE r."builtin_slug" = 'deals-by-stage'
      AND r."created_at" = r."updated_at";
    GET DIAGNOSTICS touched = ROW_COUNT;
    total := total + touched;

    UPDATE "crm_reports" AS r
    SET "filters" = '{"logic":"AND","conditions":[{"field":"status","operator":"eq","value":"open"}]}'::jsonb,
        "updated_at" = r."updated_at"
    WHERE r."builtin_slug" = 'open-tasks-by-owner'
      AND r."created_at" = r."updated_at";
    GET DIAGNOSTICS touched = ROW_COUNT;
    total := total + touched;

    UPDATE "crm_reports" AS r
    SET "description" = 'Requests not sorted yet, grouped by how urgent they are: what to pick up first.',
        "updated_at" = r."updated_at"
    WHERE r."builtin_slug" = 'requests-by-urgency'
      AND r."created_at" = r."updated_at";
    GET DIAGNOSTICS touched = ROW_COUNT;
    total := total + touched;
  END LOOP;

  RAISE NOTICE 'ready-made reports brought in line with their words: % rows', total;
END $$;
