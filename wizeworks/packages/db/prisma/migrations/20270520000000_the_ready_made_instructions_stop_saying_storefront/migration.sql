-- The ready-made instructions stop saying "storefront"
--
-- `default-prompts.ts` ships the AI instruction library installed by the `ai`
-- module preset and referenced by every industry starter. Its own header states
-- the reason this migration has to exist:
--
--     "the install is ensure-by-key (idempotent), so editing a body here does
--      NOT overwrite a tenant's edited copy; it only affects tenants that don't
--      yet have that key."
--
-- That is the right behaviour and it means a wording fix in the file reaches
-- nobody who already has the row. Third time this act, after the ready-made
-- reports and the reply notices. A seeded sentence is not a template — it is a
-- sentence that was copied once. [[feedback_data_is_a_deploy_stage]]
--
-- ── WHAT WAS WRONG WITH THE WORDS ───────────────────────────────────────────
--
-- P03 opened Instructions and the second row read:
--
--     Support assistant persona
--     The voice + guardrails for your storefront chat assistant. The live-chat
--     AI reads the active enabled persona to ground every reply.
--
-- **"storefront" is a retired word.** The whole platform renamed it to "site"
-- (copy, database, API, CSS and docs), keeping it in exactly one place: the
-- sales-channel VALUE, which is commerce-only and is not this. It survived here
-- because seeded data is not copy anybody greps.
--
-- The rest of that sentence is the AI trade talking to itself: "guardrails",
-- "persona", "ground every reply", and a `+` doing the work of "and". Four
-- other rows had the same problem in smaller doses — "benefit-led", "on-brand",
-- "platform-appropriate", and a second `+` in a NAME ("SEO title + meta
-- description").
--
-- MEASURED 2026-09-25 on the dev database:
--
--     ai_prompt_templates rows  .............................  57
--     saying "storefront"  ..................................   8
--     with created_at = updated_at (never edited by a tenant)  56
--
-- MATCHED ON `key`, which is the row's identity and is never displayed. GATED
-- ON created_at = updated_at, so a business that has reworded its own copy keeps
-- every word of it. `updated_at` is written back to itself, so a refreshed row
-- still reads as never edited to whatever needs to know next. Idempotent, and a
-- no-op on a fresh install because the seed already writes the new text.
--
-- ── WHY THE TENANT LOOP ─────────────────────────────────────────────────────
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
    SET "name" = c."name", "description" = c."description", "updated_at" = p."updated_at"
    FROM (VALUES
      ('support-persona',
       'How the chat assistant sounds',
       'The voice your site’s chat assistant uses, and what it must never say. Whichever one of these is switched on is the one it follows.'),
      ('sample-support-persona',
       'How the chat assistant sounds',
       'The voice the chat assistant on your site uses, and what it must never say.'),
      ('product-description',
       'Product description writer',
       'Turns a few notes into a finished product description that says what it does for the buyer.'),
      ('sample-product-description',
       'Product description writer',
       'Turns a few notes into a finished product description that says what it does for the buyer.'),
      ('support-reply',
       'Support reply draft',
       'Drafts a reply to a customer, in your own voice.'),
      ('seo-meta',
       'Page title and search summary',
       'Writes the title and the short summary a search engine shows under it.'),
      ('social-post',
       'Social post',
       'Writes a short social post that suits the place it is going, and asks for something.'),
      ('win-back-email',
       'Win-back email',
       'A warm note to somebody who has not bought in a while, with a reason to come back.'),
      ('sample-win-back-email',
       'Win-back email',
       'A warm note to somebody who has not bought in a while, with a reason to come back.')
    ) AS c("key", "name", "description")
    WHERE p."key" = c."key"
      AND p."created_at" = p."updated_at"
      AND (p."name", p."description") IS DISTINCT FROM (c."name", c."description");
    GET DIAGNOSTICS touched = ROW_COUNT;
    total := total + touched;
  END LOOP;

  -- Says what LANDED, so a run that refreshes nothing is visible in the release
  -- log rather than indistinguishable from a run with nothing to do.
  RAISE NOTICE 'ready-made instructions: % row(s) refreshed', total;
END $$;
