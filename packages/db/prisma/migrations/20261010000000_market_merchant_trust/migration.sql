-- sparx.market S5 (docs/117): seller trust signals on the merchant directory
-- projection. Adds an aggregate rating to market_merchants, rolled up from the
-- tenant's own market_listings (weighted by review count) by the projection writer
-- whenever a listing or the profile changes. Member-since is derived from the
-- existing market_merchants.created_at (when the seller joined the marketplace) —
-- no column needed.
--
-- market_merchants is a GLOBAL projection table (cross-tenant SELECT, tenant-scoped
-- write) — RLS is row-level and already covers new columns, so no policy change.

ALTER TABLE "market_merchants"
  ADD COLUMN "rating" DOUBLE PRECISION,
  ADD COLUMN "rating_count" INTEGER NOT NULL DEFAULT 0;
