-- A design can come without its examples (issue 098).
--
-- Installing a blueprint has always brought its example rows with it: the
-- products, the articles, the salon called Maison Élan with three stylists who
-- work somewhere else. That is on purpose — a console with nothing in it teaches
-- a new owner nothing — but it was never a CHOICE, and somebody who already
-- knows what they are doing wants the structure without the furniture.
--
-- The answer lives on the install row rather than in the request that made it,
-- because two later code paths ask the same question again: the backfill, when a
-- module is switched on months after the install, and the updater, when a newer
-- version of the design adds something. Without a recorded answer both would
-- default to "yes" and hand back exactly what she declined.
--
-- DEFAULT TRUE is the existing behaviour, so every row already in the table is
-- correct without a backfill.
ALTER TABLE "tenant_blueprint_installs"
  ADD COLUMN "sample_data" BOOLEAN NOT NULL DEFAULT true;
