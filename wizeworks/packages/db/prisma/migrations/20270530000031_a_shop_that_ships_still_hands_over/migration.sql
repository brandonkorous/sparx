-- A shop that ships can still hand orders over in person (sparx persona issue 129).
--
-- Checkout offered "Collect in person" only while a shop had no delivery set up
-- at all. The moment Gillett Diesel added a US region for shipping, collecting
-- vanished from his site, though his counter is open six days a week and his
-- setup story said customers "pick up locally". Nothing stored that choice.
--
-- Per SITE, beside the site's other checkout settings: two businesses under one
-- owner have two counters, or one, or none. Off by default, so no shop that
-- delivers today starts offering a handover it never mentioned.

ALTER TABLE "commerce_site_settings"
  ADD COLUMN "offers_collection" BOOLEAN NOT NULL DEFAULT false;
