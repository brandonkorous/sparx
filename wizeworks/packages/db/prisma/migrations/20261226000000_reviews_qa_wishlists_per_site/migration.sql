-- Per-SITE shopper content: reviews, Q&A, wishlists (docs/131 §4).
--
-- These stamp WHERE THE CONTENT WAS WRITTEN, which is deliberately not "the site
-- that owns the product". A product reaches sites through the ProductProperty
-- JUNCTION and can be listed on several at once, so ownership cannot identify a
-- site — only the act of writing can, and that fact is unrecoverable after the
-- fact. Hence a denormalized column rather than a join.
--
-- What it prevents: a review left on one storefront appearing on every
-- storefront that sells the same item, carrying that storefront's voice and
-- context with it ("arrived next day", "the staff at the counter were great")
-- into a business the reviewer never dealt with. Q&A is sharper still — a
-- question is usually addressed to the SELLER ("do you have this in stock at
-- your shop?") and its answer is true of one business only.
--
-- ALL THREE ARE SetNull, not Cascade, and that is the point worth carrying
-- forward: these are records of what a real person WROTE or SAVED. Closing a
-- storefront must not delete someone's words or silently empty their wishlist.
-- Contrast the Cascade used for authored operator content (quick replies,
-- letterhead templates, redirects) — those belong to the business; these belong
-- to the shopper.
--
-- `commerce_product_answers` gets NO column: an answer exists only under its
-- question and inherits the site (docs/131 §2, pattern 3). A column there could
-- disagree with its parent, which has no meaning.
--
-- Nullable, no backfill, no FORCE-RLS loop: rows written before multi-site have
-- no true answer, and assigning them the primary would be inventing one. NULL
-- reads as "written before this was tracked", which is what it is.

ALTER TABLE "commerce_product_reviews"   ADD COLUMN "property_id" UUID;
ALTER TABLE "commerce_product_questions" ADD COLUMN "property_id" UUID;
ALTER TABLE "commerce_wishlists"         ADD COLUMN "property_id" UUID;

ALTER TABLE "commerce_product_reviews"
    ADD CONSTRAINT "commerce_product_reviews_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL;
ALTER TABLE "commerce_product_questions"
    ADD CONSTRAINT "commerce_product_questions_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL;
ALTER TABLE "commerce_wishlists"
    ADD CONSTRAINT "commerce_wishlists_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL;

-- The storefront listing filters by site before product + status, so site leads.
CREATE INDEX "commerce_product_reviews_tenant_property_product_status_idx"
    ON "commerce_product_reviews"("tenant_id", "property_id", "product_id", "status");
CREATE INDEX "commerce_product_questions_tenant_property_product_status_idx"
    ON "commerce_product_questions"("tenant_id", "property_id", "product_id", "status");
