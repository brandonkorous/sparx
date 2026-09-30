-- Stage names a shop owner would use
--
-- The starter sales pipeline shipped its stages as Lead / Qualified /
-- Proposal Sent / Negotiation / Closed Won / Closed Lost. That is the
-- vocabulary of somebody who has worked in sales, on the first CRM screen a
-- person who makes clothes ever opens (issue 808).
--
-- DEFAULT_PIPELINE_TEMPLATE now reads New inquiry / Worth pursuing / Quote
-- sent / Agreeing terms / Won / Lost, and the pipeline itself is called Sales
-- rather than Sales Pipeline. That fixes every tenant created from here on.
-- This is the rows it already stamped.
--
-- MEASURED 2026-09-25: 43 pipelines in the dev database, and every single one
-- had created_at = updated_at. Nobody has ever edited one, so nobody has
-- renamed a stage either; these are all still the installer's words.
--
-- MATCHED BY sort_order AND stage_type, never by the old name. That is the
-- point of the issue: a stage's identity is its position and its type, and the
-- name is display. Matching on 'Closed Won' here would repeat the mistake this
-- migration exists to undo, and would also miss a pipeline whose stage somebody
-- had half-renamed.
--
-- GUARDED THREE WAYS. Only the default sales pipeline (slug 'sales'), only
-- where the PIPELINE has never been edited, and only where the stage still
-- carries the exact old name. A tenant who has touched their board keeps every
-- word of it. Idempotent, and a no-op on a fresh install.
--
-- ── WHY THE TENANT LOOP ─────────────────────────────────────────────────────
--
-- `pipelines` and `pipeline_stages` both carry ENABLE + FORCE row level
-- security, and `sparx_owner` is a NON-SUPERUSER in production. A plain UPDATE
-- here sees zero rows there and reports success, so the release goes green
-- while nothing is renamed. It passes locally only because the local owner IS a
-- superuser, which is exactly how this kind of migration ships broken.
-- Every statement below runs inside a per-tenant `app.tenant_id`.
-- (wizeworks/packages/db/CLAUDE.md, "Backfilling a FORCE-RLS table")

DO $$
DECLARE
  t       RECORD;
  stages  INT;
  boards  INT;
  total_s INT := 0;
  total_b INT := 0;
BEGIN
  FOR t IN SELECT id FROM "tenants" LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);

    UPDATE "pipeline_stages" AS s
    SET "name" = c."new_name", "updated_at" = s."updated_at"
    FROM (VALUES
      (0, 'open', 'Lead',          'New inquiry'),
      (1, 'open', 'Qualified',     'Worth pursuing'),
      (2, 'open', 'Proposal Sent', 'Quote sent'),
      (3, 'open', 'Negotiation',   'Agreeing terms'),
      (4, 'won',  'Closed Won',    'Won'),
      (5, 'lost', 'Closed Lost',   'Lost')
    ) AS c("sort_order", "stage_type", "old_name", "new_name")
    WHERE s."sort_order" = c."sort_order"
      AND s."stage_type" = c."stage_type"
      AND s."name" = c."old_name"
      AND EXISTS (
        SELECT 1 FROM "pipelines" p
        WHERE p."id" = s."pipeline_id"
          AND p."slug" = 'sales'
          AND p."created_at" = p."updated_at"
      );
    GET DIAGNOSTICS stages = ROW_COUNT;
    total_s := total_s + stages;

    -- The pipeline's own name, under the same guard. "Pipeline" is the word
    -- this console spells out as "how a deal moves"; it has no business being
    -- half of the name on a picker.
    UPDATE "pipelines"
    SET "name" = 'Sales', "updated_at" = "updated_at"
    WHERE "slug" = 'sales'
      AND "name" = 'Sales Pipeline'
      AND "created_at" = "updated_at";
    GET DIAGNOSTICS boards = ROW_COUNT;
    total_b := total_b + boards;
  END LOOP;

  -- Says what LANDED, so a run that renames nothing is visible in the release
  -- log rather than indistinguishable from a run with nothing to do.
  RAISE NOTICE 'stage names: % stage(s) and % board(s) renamed', total_s, total_b;
END $$;
