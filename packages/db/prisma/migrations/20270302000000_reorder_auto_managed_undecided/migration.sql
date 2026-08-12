-- "Nobody has decided" is a third state, and leaving it out made a setting inert.
--
-- docs/146 Phase 7 shipped `inventory_reorder_policies.is_auto_managed` as a
-- NOT NULL boolean decided ONCE at row creation and never revisited. The intent
-- was right — a level handed to the maths must not silently change hands every
-- night — but two states cannot express "no one has said yet", so the sweep had
-- to guess, and it guessed `false`.
--
-- The consequence, found by browser-testing the switch end to end: the very
-- first sweep creates a policy row for every level it plans and stamps
-- `is_auto_managed = false` on all of them, because at that moment the tenant's
-- "set reorder levels automatically" switch is off (it is off by default, and
-- deliberately). From then on the "decided once, never re-litigated" rule reads
-- that stored `false` forever. So an owner who later turns the switch ON gets
-- NOTHING: no level is adopted, no reorder point is ever set, and no message
-- says why. A silent no-op on a control whose entire purpose is to do something.
--
-- Three states fix it, and they map to who actually decided:
--
--   NULL             nobody has decided. The tenant switch governs, every run.
--   set + 'sweep'    the system adopted this level under the switch. The switch
--                    still governs, so turning it off releases the level — but
--                    the row remembers it was adopted, which is what stops the
--                    sweep from un-adopting itself the moment it writes a point
--                    (after which the level HAS one, and the naive test
--                    "has no reorder point" would flip straight back to false).
--   set + 'person'   somebody chose, on this level, by hand. Final. The tenant
--                    switch never overrides it in either direction.
--
-- That last row is the consent rule the phase is built on, now stated in the
-- data rather than inferred from an absence.

ALTER TABLE "inventory_reorder_policies"
  ALTER COLUMN "is_auto_managed" DROP NOT NULL,
  ALTER COLUMN "is_auto_managed" DROP DEFAULT;

ALTER TABLE "inventory_reorder_policies"
  ADD COLUMN "auto_managed_source" VARCHAR(8);

-- BACKFILL BEFORE CONSTRAINING. The pair check below is violated by every
-- existing row the instant it is added — they all carry a non-null
-- `is_auto_managed` and a null source — so the data has to be brought into
-- shape first. (Learned the direct way: adding the constraints first fails the
-- whole migration on `ATRewriteTable`.)

-- Release every `false` back to undecided. Those were all written by a sweep
-- running while the switch was off — nobody chose them, and treating a default
-- as a decision is the bug. Levels with a hand-typed reorder point are still
-- protected: the resolver leaves them alone while undecided, because the switch
-- only ever adopts levels that have no point of their own.
UPDATE "inventory_reorder_policies"
SET "is_auto_managed" = NULL
WHERE "is_auto_managed" = false;

-- Anything already ON was necessarily turned on deliberately: the switch that
-- would otherwise have produced it is off by default and, per the defect above,
-- never took effect. Attribute it to a person so it is never revoked by a
-- tenant-level toggle.
UPDATE "inventory_reorder_policies"
SET "auto_managed_source" = 'person'
WHERE "is_auto_managed" = true;

ALTER TABLE "inventory_reorder_policies"
  ADD CONSTRAINT "inventory_reorder_policies_auto_source_check" CHECK (
    "auto_managed_source" IS NULL OR "auto_managed_source" IN ('person','sweep')
  ),
  -- The two travel together: a decision without a decider is the ambiguity this
  -- migration exists to remove, and a decider without a decision is meaningless.
  ADD CONSTRAINT "inventory_reorder_policies_auto_pair_check" CHECK (
    ("is_auto_managed" IS NULL) = ("auto_managed_source" IS NULL)
  );
