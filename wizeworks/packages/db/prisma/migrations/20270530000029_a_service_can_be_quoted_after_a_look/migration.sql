-- A service whose price is worked out after looking at the job.
--
-- Measured on Gillett: Doty's service menu has an injector set and a turbo rebuild
-- priced by quote. A service had only a price, "Leave blank for a free booking",
-- and the public booking list printed "Free" for a 0 price, so his turbo rebuild
-- would have read Free to every customer (sparx persona issue 117). Existing
-- services keep their price; none is quoted until the business says so.

ALTER TABLE scheduling_services
    ADD COLUMN price_on_quote BOOLEAN NOT NULL DEFAULT false;
