-- A note only your team sees, written by a developer
--
-- Issue 607 rewrote the fourteen ready-made lists out of developer shorthand:
-- "Clothing fitment - a single Size axis (alpha + numeric), no sub-levels."
-- became "For clothing sold by size. One plain list of sizes, with letters and
-- numbers together, and nothing underneath them."
--
-- The catalog changed. The rows it had already stamped did not. Every fitment
-- list in the database still carried the old sentence, in a field the console
-- labels "Optional. Only your team sees this" (issue 801).
--
-- Matched by SLUG, because the old sentence has had more than one spelling.
-- Guarded by created_at = updated_at, so a list anyone has SAVED since it was
-- installed keeps whatever they wrote: this only refreshes what the installer
-- put there and nobody has touched. Idempotent, and a no-op on a fresh install.
--
-- ── WHY THE TENANT LOOP ─────────────────────────────────────────────────────
--
-- `commerce_fitment_domains` carries ENABLE + FORCE row level security and
-- `sparx_owner` is a NON-SUPERUSER in production, so a plain UPDATE would see
-- zero rows there and report success. It passes locally only because the local
-- owner IS a superuser, which is how this kind of migration ships broken.
-- Found on 2026-09-25 while writing the one beside it.
-- (wizeworks/packages/db/CLAUDE.md, "Backfilling a FORCE-RLS table")

DO $$
DECLARE
  t       RECORD;
  touched INT;
  total   INT := 0;
BEGIN
  FOR t IN SELECT id FROM "tenants" LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);

    UPDATE "commerce_fitment_domains" AS d
    SET "description" = c."description", "updated_at" = "updated_at"
    FROM (VALUES
      ('vehicle', 'For parts that only fit certain cars and trucks. A shopper picks their make, model and engine, and you can narrow it further by year.'),
      ('device', 'For cases, screens and accessories. A shopper picks the make of their phone or tablet, then the model.'),
      ('apparel-sizes', 'For clothing sold by size. One plain list of sizes, with letters and numbers together, and nothing underneath them.'),
      ('pet', 'For collars, beds, coats and harnesses. A shopper picks the animal, then the breed, and you can narrow it further by weight.'),
      ('equipment', 'For parts, filters and the bits that wear out. A shopper picks the kind of machine, then the model.'),
      ('footwear', 'For shoes sold by size and width. A shopper picks who they are buying for, then the width, and you can narrow it further by size.'),
      ('bicycle', 'For tires, tubes and parts. A shopper picks the kind of riding they do, then their wheel size.'),
      ('eyewear', 'For lenses, arms and spare parts. A shopper picks the make of their glasses, then the frame.'),
      ('tires-wheels', 'For tires and wheels sold by size. A shopper picks the rim they are fitting, then how wide the tire needs to be.'),
      ('hvac-filters', 'For air filters sold by the size printed on the frame. One plain list of sizes, each written as width by height by depth, in inches.'),
      ('furniture', 'For covers, cushions and spare parts. A shopper picks the room, then the piece of furniture.'),
      ('marine-powersports', 'For parts that only fit certain boats, quad bikes and motorbikes. A shopper picks the make and model, and you can narrow it further by year.'),
      ('instruments', 'For strings, reeds, pads and spare parts. A shopper picks the family of instrument, then the instrument itself.'),
      ('appliances', 'For parts, filters and door seals. A shopper picks the kind of appliance, then the make.')
    ) AS c("slug", "description")
    WHERE d."slug" = c."slug"
      AND d."created_at" = d."updated_at"
      AND d."description" IS DISTINCT FROM c."description";
    GET DIAGNOSTICS touched = ROW_COUNT;
    total := total + touched;
  END LOOP;

  -- Says what LANDED, so a run that refreshes nothing is visible in the
  -- release log rather than indistinguishable from a run with nothing to do.
  RAISE NOTICE 'fitment domain notes: % row(s) refreshed', total;
END $$;
