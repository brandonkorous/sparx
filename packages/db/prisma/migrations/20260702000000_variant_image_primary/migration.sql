-- Commerce — a product's PRIMARY (hero) image.
--
-- VariantImage carried only `position` ordering, no explicit hero — so
-- productService.list() hardcoded imageUrl: null and product cards / email blocks
-- had no thumbnail. This adds an is_primary flag: a product can designate ONE image
-- as the hero surfaced in admin + storefront lists, product cards, Builder email
-- product blocks, and the search index.
--
-- "At most one primary per product" is enforced in the DB by a PARTIAL UNIQUE index
-- on (tenant_id, product_id) WHERE is_primary — the canonical, race-safe Postgres
-- idiom. Prisma can't express the predicate, so it lives here in SQL only (like the
-- RLS policies and *_set_updated_at triggers elsewhere); Prisma's differ leaves it
-- alone.
--
-- NO BACKFILL: readers fall back to the first product-level image by position when
-- nothing is primary, so existing products keep a sensible thumbnail without an
-- explicit pick. The setPrimaryImage service clears the prior primary before setting
-- the new one within one transaction, so the intermediate (zero primary) never trips
-- the index. The column is additive and RLS is unchanged (the table already FORCEs
-- RLS from its creation migration), so this needs no per-tenant backfill loop.

-- AlterTable — additive column.
ALTER TABLE "commerce_variant_images"
    ADD COLUMN "is_primary" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex — at most one PRIMARY image per product (partial unique).
CREATE UNIQUE INDEX "commerce_variant_images_one_primary_per_product"
    ON "commerce_variant_images" ("tenant_id", "product_id") WHERE "is_primary";
