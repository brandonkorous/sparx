-- Per-SITE product rating aggregate (docs/131 §4).
--
-- The review LIST already shows the correct per-site average (review-service
-- scopes its live aggregate), but the denormalized products.average_rating /
-- review_count are TENANT-WIDE and drive the star badge on product cards and the
-- rating sort on a per-site grid — where a shopper sees an average blended across
-- sibling businesses on a product listed on more than one site. This table is the
-- cheap per-(product, site) lookup those grid surfaces read instead.
--
-- It stores the SUM of ratings and the count, NOT the average, because a
-- storefront's figure combines two buckets — its own reviews plus the null
-- "legacy/shared" bucket every site counts — and averages cannot be averaged:
-- sum(sum_rating)/sum(review_count) over the (site, null) rows is the only correct
-- combine. property_id is nullable for that shared bucket.
--
-- New table, no backfill in the migration itself — recomputeProductRating
-- populates a product's rows the next time its approved-review set changes, and a
-- one-shot reconcile can prime existing products. Empty rollups simply mean the
-- read falls back to the all-sites product.* columns, which is the pre-multi-site
-- behaviour.

CREATE TABLE "commerce_product_review_rollups" (
    "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"    UUID NOT NULL,
    "product_id"   UUID NOT NULL,
    "property_id"  UUID,
    "sum_rating"   INTEGER NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "commerce_product_review_rollups_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "commerce_product_review_rollups"
    ADD CONSTRAINT "commerce_product_review_rollups_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
ALTER TABLE "commerce_product_review_rollups"
    ADD CONSTRAINT "commerce_product_review_rollups_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "commerce_products"("id") ON DELETE CASCADE;
ALTER TABLE "commerce_product_review_rollups"
    ADD CONSTRAINT "commerce_product_review_rollups_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;

-- NULLS NOT DISTINCT so the shared bucket (property_id IS NULL) is ONE row per
-- product — without it, every recompute could insert a second null row and the
-- read would double-count legacy reviews.
CREATE UNIQUE INDEX "commerce_product_review_rollups_unique"
    ON "commerce_product_review_rollups"("tenant_id", "product_id", "property_id")
    NULLS NOT DISTINCT;

CREATE INDEX "commerce_product_review_rollups_product_idx"
    ON "commerce_product_review_rollups"("product_id");

-- Tenant-scoped like the reviews it derives from: ENABLE + FORCE RLS + the
-- canonical tenant_isolation policy on current_tenant_id().
ALTER TABLE "commerce_product_review_rollups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce_product_review_rollups" FORCE  ROW LEVEL SECURITY;
CREATE POLICY "commerce_product_review_rollups_tenant_isolation"
    ON "commerce_product_review_rollups"
    AS PERMISSIVE FOR ALL
    USING ("tenant_id" = current_tenant_id());
