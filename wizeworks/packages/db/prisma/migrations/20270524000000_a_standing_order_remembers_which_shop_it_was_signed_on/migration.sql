-- A standing order remembers which shop it was signed on.
--
-- A renewal creates a real Order. Every per-site figure the console shows
-- selects on `orders.property_id`, and `order-service.ts` reads a null there as
-- an order belonging to a business that has since been deleted, so it withholds
-- the row from every member whose access is limited to named sites. A sale with
-- no site is not "on all of them", it is in nobody's takings.
--
-- `commerce_subscriptions` carried no site, and there was nothing else for a
-- renewal to read: the order is minted by a worker months after the signup,
-- from the subscription row alone. So every renewal order on this platform was
-- site-less. Measured 2026-09-30: 12 of 123 orders carried no site, and the one
-- subscription that exists had produced one of them (issue 878).
--
-- NULLABLE, and deliberately not backfilled. A row written before this column
-- existed cannot be told apart from a subscription that genuinely has no site,
-- and picking the tenant's primary for the old ones would file real money
-- against a shop that never took it. Existing subscriptions keep renewing
-- site-less, which is what they have always done and is at least honest; the
-- ones signed from here on carry it.
--
-- ON DELETE SET NULL, matching `orders.property_id`: a standing order outlives
-- the site it was signed on, and deleting a site must not delete the agreement
-- to keep billing somebody.
ALTER TABLE "commerce_subscriptions" ADD COLUMN "property_id" UUID;

ALTER TABLE "commerce_subscriptions"
  ADD CONSTRAINT "commerce_subscriptions_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "commerce_subscriptions_tenant_id_property_id_idx"
  ON "commerce_subscriptions"("tenant_id", "property_id");
