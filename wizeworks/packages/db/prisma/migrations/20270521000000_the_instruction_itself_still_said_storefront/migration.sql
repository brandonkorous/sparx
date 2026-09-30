-- The instruction itself still said "storefront"
--
-- `20270520000000_the_ready_made_instructions_stop_saying_storefront` is named
-- for a fix it did not make. It refreshed `name` and `description` on nine
-- prompt keys and never touched `body` — and `body` IS the instruction. The
-- name is the label on the row; the body is the text that gets sent to the
-- model and shown in the editor when somebody opens it.
--
-- So the pane's heading was refreshed and the paragraph underneath it was not.
--
-- MEASURED 2026-09-25, immediately after 20270520 was applied:
--
--     rows saying "storefront" in `description`  ...........  0   (fixed)
--     rows saying "storefront" in `body`  ..................  6   (missed)
--     rows with an em dash in `body`  .....................  14   (missed)
--     rows with an em dash in `name` or `description`  .....  0   (fixed)
--
-- The six are `support-persona`, whose opening line read:
--
--     You are the customer-support assistant for {{business_name}}, embedded
--     in its storefront chat.
--
-- `default-prompts.ts` has said "answering in the chat on its site" for months.
-- "storefront" is the retired word: the platform renamed it to "site"
-- everywhere except the commerce-only sales-channel VALUE, which this is not.
--
-- [[feedback_a_fix_leaves_its_neighbour_behind]] — the shape is a fix applied
-- to one of the columns a row shows, with the sibling column left carrying the
-- same wrong word. Reading the migration back against the table is what found
-- it; the migration's own RAISE NOTICE said 51 rows refreshed and was telling
-- the truth about the columns it had chosen.
--
-- ── WHY REPLACE AND NOT SET ─────────────────────────────────────────────────
--
-- `sample-support-persona` interpolates the demo pack's label into its first
-- line ("a florist & plants business", "a generic starter business"), so there
-- is no one literal body to assign. A targeted `replace()` fixes the phrase and
-- leaves every tenant's own noun alone. It is also idempotent for free: a
-- second run finds nothing to replace.
--
-- Each of the three phrases was counted before it was written, and the three
-- together account for every stale row with none left over:
--
--     ", embedded in its storefront chat."  .......  6 rows
--     "genuinely helpful — never pushy"  ..........  8 rows
--     "No emoji spam — one or two at most."  ......  6 rows
--     remaining em dash / "storefront" after all 3   0 rows
--
-- ── THE SAME GATE AND THE SAME LOOP ─────────────────────────────────────────
--
-- GATED ON created_at = updated_at, so a business that has reworded its own
-- prompt keeps every word of it. `updated_at` is written back to itself so a
-- refreshed row still reads as never edited to whatever asks next.
--
-- `ai_prompt_templates` carries ENABLE + FORCE row level security and
-- `sparx_owner` is a NON-SUPERUSER in production, so a plain UPDATE would see
-- zero rows there and report success. It would pass locally, where the owner is
-- a superuser. (wizeworks/packages/db/CLAUDE.md, "Backfilling a FORCE-RLS table")

DO $$
DECLARE
  t       RECORD;
  touched INT;
  total   INT := 0;
BEGIN
  FOR t IN SELECT id FROM "tenants" LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);

    UPDATE "ai_prompt_templates" AS p
    SET "body" = replace(
          replace(
            replace(
              p."body",
              ', embedded in its storefront chat.',
              ', answering in the chat on its site.'
            ),
            'genuinely helpful — never pushy',
            'genuinely helpful, never pushy'
          ),
          'No emoji spam — one or two at most.',
          'No emoji spam. One or two at most.'
        ),
        "updated_at" = p."updated_at"
    WHERE p."created_at" = p."updated_at"
      AND (
        p."body" LIKE '%, embedded in its storefront chat.%'
        OR p."body" LIKE '%genuinely helpful — never pushy%'
        OR p."body" LIKE '%No emoji spam — one or two at most.%'
      );
    GET DIAGNOSTICS touched = ROW_COUNT;
    total := total + touched;
  END LOOP;

  -- Says what LANDED, so a run that refreshes nothing is visible in the release
  -- log rather than indistinguishable from a run with nothing to do.
  RAISE NOTICE 'ready-made instructions, the body this time: % row(s) refreshed', total;
END $$;
