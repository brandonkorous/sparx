-- sparx.market S3 (docs/117): card badges + trending signal on the global catalog
-- projection. Adds two denormalized columns to market_listings, projected from the
-- product graph by @sparx/commerce's projectMarketListing (and refreshed on
-- inventory drift by the commerce-indexer):
--
--   best_seller_rank  — mirror of commerce_products.best_seller_rank (1 = top seller
--                       in the tenant's catalog). Nullable; NULL sorts last. Drives
--                       the "Bestseller" card badge + the S4 trending rail.
--   low_stock         — true when the listing is in stock but at/under the low-stock
--                       threshold (a computed sellable-quantity signal). Drives the
--                       "Only a few left" urgency badge.
--
-- market_listings is a GLOBAL projection table (cross-tenant SELECT, tenant-scoped
-- write) — RLS is row-level and already covers new columns, so no policy change.

ALTER TABLE "market_listings"
  ADD COLUMN "best_seller_rank" INTEGER,
  ADD COLUMN "low_stock" BOOLEAN NOT NULL DEFAULT false;

-- Ascending with NULLs last: the trending/bestseller ordering reads rank 1 first and
-- pushes unranked listings to the tail.
CREATE INDEX "market_listings_best_seller_rank_idx"
  ON "market_listings" ("best_seller_rank" ASC NULLS LAST);
