-- A repeat delivery remembers how it is delivered (issue 916).
--
-- Every renewal used to be written with its items and nothing else, so the
-- first delivery carried postage and sales tax and every one after it carried
-- neither. Pricing the postage again on each renewal needs to know WHICH
-- delivery option the shopper chose at checkout, and the subscription was the
-- one record that did not say.
--
-- Shape: { providerSlug, rateRef, description }. The ref is matched first (a
-- shop's own rates keep a stable one); the description is the fallback for a
-- live carrier, whose refs are single-use. Null on every subscription written
-- before this, and on one an owner starts by hand: those are priced at the
-- cheapest way the shop delivers to the address on the day.
--
-- No backfill and no RLS change: it is a column on a table that already has
-- both, and a null here is a true record of "nobody chose".

ALTER TABLE "commerce_subscriptions" ADD COLUMN "shipping_choice" JSONB;
