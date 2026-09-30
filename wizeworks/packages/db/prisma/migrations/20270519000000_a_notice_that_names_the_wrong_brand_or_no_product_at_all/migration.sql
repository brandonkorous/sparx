-- A notice that names the wrong brand, and one that names no product at all
--
-- Both writers were fixed months apart. Neither fix reached the rows already
-- sitting in people's bells, and a notification is not a template — it is a
-- sentence that was composed once and then stored, so a fix to the composer
-- does nothing for what it already wrote. [[feedback_data_is_a_deploy_stage]]
--
-- Found by opening What has been happening as P03 (Juniper Row, a Piggles
-- account). Her ONE unread notice, the single thing on the screen headed
-- "Addressed to you personally", read:
--
--       is out of stock
--       Customers cannot buy this until it is back in stock.
--
-- MEASURED 2026-09-25 on the dev database:
--
--     notification rows in total  .....................  7
--     titled "The <brand> team replied to your feedback"  5
--     kind = inventory.depleted, no subject, no link ..  2
--
-- Five of the seven name a brand resolved before the per-tenant lookup existed,
-- and the other two are a sentence with its subject deleted. Every row in the
-- table is one or the other.
--
-- ── 1. THE ONES THAT NAME A BRAND ───────────────────────────────────────────
--
-- `operator-feedback.ts` wrote "The ${brandIdentity.name} team replied to your
-- feedback". Before the lookup landed (issue 128) that resolved to the platform
-- default, so a Piggles account holder was told "The sparx team" replied, in the
-- Piggles console, about a message they sent from inside Piggles.
--
-- The writer no longer names a brand at all: a notice is only ever read inside
-- its own brand's console, so the brand is already on the screen around it and
-- the title has nothing to add by repeating it. A sentence that CANNOT name the
-- wrong brand is a stronger guard than a lookup that must not fail.
--
-- These rows are repaired to the same words, matched on the shape the old
-- composer produced rather than on any one brand name, so a row written under
-- any brand is caught. `body` is the staff member's own reply and is untouched.
--
-- ── 2. THE ONE THAT NAMES NOTHING ───────────────────────────────────────────
--
-- The out-of-stock notice is composed from '{{product.title}} is out of stock'.
-- When the merge field came back empty the title was written anyway, so the row
-- says "is out of stock" about nothing, over a body that says "customers cannot
-- buy this" where "this" names nothing either. `entity_id` is NULL on both, so
-- the link that would have said which product is absent too.
--
-- `wizeworks/packages/automation/src/actions/notify.ts` now refuses to write a
-- notification whose title has an unresolved placeholder, and records which
-- path came back empty in the run ledger. These two predate that guard.
--
-- They are DELETED, not repaired. `entity_id` is NULL, so there is nothing left
-- on the row that says which variant ran out: the fact the notice existed to
-- carry is gone, and an unreadable warning in a bell is worse than no warning —
-- it takes up the one slot marked "addressed to you personally" and cannot be
-- acted on. Deletion is bounded to rows that are ALL of: this kind, no link,
-- and a title that does not begin with a capital, which is what an unresolved
-- leading placeholder leaves behind. A correctly composed one begins with the
-- product's name.
--
-- ── WHY THE TENANT LOOP ─────────────────────────────────────────────────────
--
-- `notifications` carries ENABLE + FORCE row level security and `sparx_owner`
-- is a NON-SUPERUSER in production, so a plain UPDATE or DELETE would see zero
-- rows there and report success. It would pass locally, where the owner is a
-- superuser. (wizeworks/packages/db/CLAUDE.md, "Backfilling a FORCE-RLS table")
--
-- Idempotent: the UPDATE skips rows already reading the new sentence, and the
-- DELETE has nothing left to match on a second run.

DO $$
DECLARE
  t       RECORD;
  touched INT;
  renamed INT := 0;
  dropped INT := 0;
BEGIN
  FOR t IN SELECT id FROM "tenants" LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);

    -- 1. The reply notice signs itself with no brand at all.
    UPDATE "notifications"
    SET "title" = 'We replied to your feedback'
    WHERE "kind" = 'feedback.replied'
      AND "title" LIKE 'The % team replied to your feedback';
    GET DIAGNOSTICS touched = ROW_COUNT;
    renamed := renamed + touched;

    -- 2. The out-of-stock notice that never learned which product.
    DELETE FROM "notifications"
    WHERE "kind" = 'inventory.depleted'
      AND "entity_id" IS NULL
      AND "title" !~ '^[A-Z]';
    GET DIAGNOSTICS touched = ROW_COUNT;
    dropped := dropped + touched;
  END LOOP;

  -- Says what LANDED, so a run that changes nothing is visible in the release
  -- log rather than indistinguishable from a run with nothing to do.
  RAISE NOTICE 'notifications: % reply notice(s) unbranded, % subjectless stock notice(s) removed',
    renamed, dropped;
END $$;
