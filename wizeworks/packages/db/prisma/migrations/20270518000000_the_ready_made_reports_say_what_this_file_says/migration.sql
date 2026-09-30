-- The ready-made reports say what their source file says
--
-- `report-builtins.ts` ships eight worked-example reports, seeded per tenant
-- when the CRM is switched on. `seedBuiltinReports` installs what is MISSING
-- and leaves existing rows alone, which is right — a business may have shared
-- one or hung it on a dashboard, and rewriting it underneath them would be the
-- platform quietly editing their board.
--
-- The cost is that the file is a template for NEW tenants and nothing else. A
-- wording fix in it never reaches anybody who already has the report.
--
-- MEASURED 2026-09-25 on the dev database:
--
--     built-in report rows  ..........................  56  (8 slugs x 7 tenants)
--     still carrying an em dash the file dropped .....  35
--     with created_at = updated_at  ..................  56
--     distinct descriptions per slug  ................   1
--
-- Every one of the 56 was untouched by the business it belonged to, and all
-- seven tenants read the same stale sentence. An em dash had been replaced
-- with a colon in the source months ago and not one shop had seen it.
-- [[feedback_data_is_a_deploy_stage]]
--
-- This act also rewrote the wording itself, because those descriptions were
-- written for somebody who works in sales: "Closed-won value", "leads",
-- "Open support requests", "what your team should pick up first" on a console
-- whose owner has no team, and "whether your support load is growing".
--
-- Three NAMES changed with them. "Deals by stage" and "Customers by stage" both
-- said "stage" while the report's own summary line underneath now says "step"
-- and "how far along", which is one card disagreeing with itself. A seeded name
-- is one string for both consoles and neither can rename a database row, so
-- these are words that read plainly for a shop owner and correctly for an
-- operator: "Where your deals are", "How far along your customers are", "Who is
-- carrying what". The last one was already the first sentence of its own
-- description, which is now the rest of it.
--
-- MATCHED ON builtin_slug, which is the row's identity and is never displayed.
-- GATED ON created_at = updated_at, so a business that has edited its copy of a
-- report keeps every word of it. `updated_at` is written back to itself, so a
-- refreshed row still reads as never edited to whatever needs to know next.
-- There are no triggers on `crm_reports`. Idempotent, and a no-op on a fresh
-- install because the seed already writes the new text.
--
-- ── WHY THE TENANT LOOP ─────────────────────────────────────────────────────
--
-- `crm_reports` carries ENABLE + FORCE row level security and `sparx_owner` is
-- a NON-SUPERUSER in production, so a plain UPDATE would see zero rows there
-- and report success. It would pass locally, where the owner is a superuser.
-- (wizeworks/packages/db/CLAUDE.md, "Backfilling a FORCE-RLS table")

DO $$
DECLARE
  t       RECORD;
  touched INT;
  total   INT := 0;
BEGIN
  FOR t IN SELECT id FROM "tenants" LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);

    UPDATE "crm_reports" AS r
    SET "name" = c."name", "description" = c."description", "updated_at" = r."updated_at"
    FROM (VALUES
      ('deals-by-stage',
       'Where your deals are',
       'How many open deals are sitting at each step of your process, and what they are worth. The classic “where is everything?” view.'),
      ('deals-won-by-month',
       'Deals won each month',
       'What you won, month by month, over the last year: whether you are growing, and by how much.'),
      ('new-customers-by-month',
       'New customers each month',
       'How many people you took on each month over the last year.'),
      ('customers-by-stage',
       'How far along your customers are',
       'Everybody you hold a record for, grouped by how far along they are: the ones you are still talking to, the ones who bought, the ones who went quiet.'),
      ('spend-by-company',
       'Spend by company',
       'Everything each company has spent with you, added up: where your money actually comes from.'),
      ('requests-by-urgency',
       'Requests by urgency',
       'Requests nobody has answered yet, grouped by how urgent they are: what to pick up first.'),
      ('requests-opened-by-week',
       'Requests opened each week',
       'How many requests came in week by week over the last quarter: whether more is arriving than before.'),
      ('open-tasks-by-owner',
       'Who is carrying what',
       'Everything still to do, grouped by the person it belongs to.')
    ) AS c("slug", "name", "description")
    WHERE r."builtin_slug" = c."slug"
      AND r."created_at" = r."updated_at"
      AND (r."name", r."description") IS DISTINCT FROM (c."name", c."description");
    GET DIAGNOSTICS touched = ROW_COUNT;
    total := total + touched;
  END LOOP;

  -- Says what LANDED, so a run that refreshes nothing is visible in the release
  -- log rather than indistinguishable from a run with nothing to do.
  RAISE NOTICE 'ready-made reports: % row(s) refreshed', total;
END $$;
