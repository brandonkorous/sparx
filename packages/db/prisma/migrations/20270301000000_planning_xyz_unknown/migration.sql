-- Steadiness may be UNKNOWN — it is not "erratic by default".
--
-- docs/146 Phase 7 shipped `inventory_classifications.xyz_class` as NOT NULL
-- DEFAULT 'Z'. The arithmetic behind it never objects: a coefficient of variation
-- over daily demand is a finite number for any history at all, and an item that
-- sold on two days out of thirty produces a CV around 4.0 — comfortably past the
-- 1.0 threshold, so it lands in Z. Z renders as "Erratic", and the advice column
-- then tells a business owner to order the line little and often and count it
-- monthly.
--
-- On a young catalogue that made EVERY line erratic. Browser-testing the surface
-- against the dev tenant returned eighteen rows of "Erratic", six of which had
-- never sold a single unit. That is not a measurement of erratic demand; it is a
-- measurement of not enough demand to have a pattern, reported with total
-- confidence.
--
-- So the column becomes nullable and loses its default. NULL means "not enough
-- selling days to judge", which the UI renders as such — the same rule
-- `seasonality_index` already followed by returning NULL below a year of history
-- rather than a defaulted 1.0.
--
-- `inventory_levels.xyz_class` needs no change: it was already nullable with a
-- NULL-tolerant CHECK, because there NULL already meant "no sweep has looked".

ALTER TABLE "inventory_classifications"
  ALTER COLUMN "xyz_class" DROP NOT NULL,
  ALTER COLUMN "xyz_class" DROP DEFAULT;

-- The CHECK has to be replaced rather than left alone: `IN ('X','Y','Z')`
-- evaluates to NULL for a NULL input, which Postgres treats as passing, so the
-- old constraint would in fact permit it. Restated explicitly all the same —
-- a constraint that reads as forbidding what the column now allows is a trap for
-- whoever reads it next.
ALTER TABLE "inventory_classifications"
  DROP CONSTRAINT IF EXISTS "inventory_classifications_xyz_check";

ALTER TABLE "inventory_classifications"
  ADD CONSTRAINT "inventory_classifications_xyz_check" CHECK (
    "xyz_class" IS NULL OR "xyz_class" IN ('X','Y','Z')
  );

-- Clear the classes that were never really measured, using the same floor the
-- application enforces (packages/commerce-schemas/src/planning.ts:
-- MIN_DEMAND_DAYS_FOR_XYZ = 6, MIN_HISTORY_DAYS_FOR_XYZ = 28). A level with no
-- velocity row at all has certainly never been measured, so it clears too.
--
-- Only 'Z' rows are touched. An X or a Y that somehow sits on thin evidence is
-- left for the next sweep to correct: this backfill exists to remove a false
-- alarm, not to relitigate every row from outside the code that owns the rule.
UPDATE "inventory_classifications" c
SET "xyz_class" = NULL
WHERE c."xyz_class" = 'Z'
  AND NOT EXISTS (
    SELECT 1
    FROM "inventory_demand_velocity" dv
    WHERE dv."variant_id" = c."variant_id"
      AND dv."warehouse_id" = c."warehouse_id"
      AND dv."days_with_demand" >= 6
      AND dv."history_days" >= 28
  );

-- The denormalised twin on the level follows the same rule, so the fast read and
-- the explanation cannot disagree about whether an item was measured.
UPDATE "inventory_levels" l
SET "xyz_class" = NULL
WHERE l."xyz_class" = 'Z'
  AND NOT EXISTS (
    SELECT 1
    FROM "inventory_demand_velocity" dv
    WHERE dv."variant_id" = l."variant_id"
      AND dv."warehouse_id" = l."warehouse_id"
      AND dv."days_with_demand" >= 6
      AND dv."history_days" >= 28
  );
