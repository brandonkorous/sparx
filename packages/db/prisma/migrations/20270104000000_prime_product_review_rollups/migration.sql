-- Prime commerce_product_review_rollups from existing approved reviews (docs/131 §4).
--
-- The rollup table shipped empty in 20270103000000; recomputeProductRating only
-- rewrites a product's rows the next time its approved-review set changes. Without
-- this backfill, a product that already has approved reviews would read as "no
-- reviews" on the (now authoritative) site-scoped storefront surfaces until someone
-- happened to submit/moderate/delete a review on it. This primes every existing
-- (product, site) bucket so per-site ratings are correct the moment the read path
-- goes live.
--
-- FORCE-RLS footgun (packages/db/CLAUDE.md): both the source (commerce_product_reviews)
-- and the target (commerce_product_review_rollups) enforce RLS, and sparx_owner is a
-- NON-superuser in prod — a single unscoped statement sees 0 rows and the backfill
-- silently no-ops. So loop tenants and set app.tenant_id per tenant; the SELECT is
-- then scoped to that tenant's reviews and the INSERT's WITH CHECK (the tenant_isolation
-- policy) passes because every row carries the same tenant_id.
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);

    INSERT INTO commerce_product_review_rollups
      (tenant_id, product_id, property_id, sum_rating, review_count, updated_at)
    SELECT
      r.tenant_id,
      r.product_id,
      r.property_id,
      SUM(r.rating)::int,
      COUNT(*)::int,
      CURRENT_TIMESTAMP
    FROM commerce_product_reviews r
    WHERE r.status = 'approved'
      AND r.deleted_at IS NULL
    GROUP BY r.tenant_id, r.product_id, r.property_id
    -- Idempotent: a re-run (or a bucket a recompute already wrote) is folded into
    -- the existing row rather than colliding on the NULLS NOT DISTINCT unique index.
    ON CONFLICT (tenant_id, product_id, property_id) DO UPDATE
      SET sum_rating   = EXCLUDED.sum_rating,
          review_count = EXCLUDED.review_count,
          updated_at   = CURRENT_TIMESTAMP;
  END LOOP;
END $$;
