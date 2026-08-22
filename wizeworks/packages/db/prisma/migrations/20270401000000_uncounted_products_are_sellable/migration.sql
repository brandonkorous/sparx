-- Un-strand every product that was marked "Sold out" for never having been counted.
--
-- `commerce_products.in_stock` is a denormalized read column maintained by
-- `syncProductInStock`. Its rule summed the variant's inventory_levels rows and
-- called the total zero when there were none — but nothing in the
-- product-creation path ever writes a level row. Levels appear only when
-- somebody deliberately sets stock. So EVERY product a business typed in was
-- written with `in_stock = false`, and `inventory_policy` defaults to `deny`,
-- and the storefront duly told every visitor it was Sold out. The console beside
-- it said On sale, because that reads `status`, which is a different question.
--
-- The rule is fixed in code (inventory/src/services/availability.ts — no level
-- row is the ABSENCE of a count, not a count of zero, so it takes the untracked
-- path). This corrects the rows already written under the old one, because a
-- code fix alone would leave every existing product stranded until somebody
-- happened to edit it.
--
-- SCOPE. Only products with NO level row anywhere. A product that has been
-- counted keeps whatever its count says: counted zero really is zero, and this
-- statement must never flip one of those back to sellable.
--
-- IDEMPOTENT. Re-running changes nothing: the `in_stock = false` guard means
-- rows already corrected are not matched.
UPDATE commerce_products p
SET in_stock = true
WHERE p.deleted_at IS NULL
  AND p.in_stock = false
  AND NOT EXISTS (
    SELECT 1
    FROM inventory_levels il
    JOIN commerce_product_variants v ON v.id = il.variant_id
    WHERE v.product_id = p.id
  );
