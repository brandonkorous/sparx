-- The mirror of 20270401000000_uncounted_products_are_sellable, and the same column.
--
-- `commerce_products.in_stock` is a denormalized read column maintained by
-- `syncProductInStock`, which `applyMovement` calls at the end of every stock
-- change. `applyMovement` returns EARLY when a movement has no effect — delta 0
-- and no allocation change write no ledger row, which is correct, because
-- nothing moved.
--
-- But one zero-effect movement DOES change the answer: the FIRST count of
-- something, recorded as zero. The level row goes from ABSENT to PRESENT-AT-ZERO,
-- and that takes the variant off the untracked path (no level row = never
-- counted = sellable, per availability.ts) and makes it genuinely sold out. The
-- early return skipped the sync, so the column kept saying `true`.
--
-- "We are out of this" is the first count a shop ever records, not an edge case.
-- A bakery counted her rye at zero because it had gone, the console told her
-- "Nothing left to sell", and her website went on offering it.
--
-- Fixed in code (inventory/src/services/ledger.ts — the level-creating INSERT
-- now reports whether it inserted, and the zero-delta return syncs when it did).
-- This corrects the rows already written, because a code fix alone leaves them
-- wrong until something else happens to move that stock.
--
-- SCOPE, and it is deliberately one-directional. Only `true` → `false`, because
-- `true` is the only value this bug can leave behind. Every condition below is a
-- term of `syncProductInStock`'s own predicate:
--
--   · the product HAS been counted somewhere (at least one level row) — an
--     uncounted product is the 20270401 case and must stay sellable;
--   · everything counted, everywhere, nets to zero or less;
--   · no live variant is orderable without stock (`inventory_policy <> 'deny'`
--     covers dropship / print-on-demand / preorder, whose stock never appears in
--     inventory_levels at all);
--   · the tenant actually tracks stock — the `inventory` module, or `commerce` /
--     `b2b`, which bundle it free (BUNDLED_FREE in @wizeworks/modules). With
--     tracking off, `syncProductInStock` writes `true` unconditionally and the
--     storefront ignores the column anyway.
--
-- IDEMPOTENT. Re-running matches nothing new: the `in_stock = true` guard means
-- a row already corrected is no longer a candidate.
UPDATE commerce_products p
SET in_stock = false
WHERE p.deleted_at IS NULL
  AND p.in_stock = true
  AND EXISTS (
    SELECT 1
    FROM inventory_levels il
    JOIN commerce_product_variants v ON v.id = il.variant_id
    WHERE v.product_id = p.id
  )
  AND COALESCE(
    (
      SELECT SUM(il.on_hand - il.allocated - il.unsellable_on_hand)
      FROM inventory_levels il
      JOIN commerce_product_variants v ON v.id = il.variant_id
      WHERE v.product_id = p.id
    ),
    0
  ) <= 0
  AND NOT EXISTS (
    SELECT 1
    FROM commerce_product_variants v
    WHERE v.product_id = p.id
      AND v.deleted_at IS NULL
      AND v.inventory_policy <> 'deny'
  )
  AND EXISTS (
    SELECT 1
    FROM tenants t
    WHERE t.id = p.tenant_id
      AND (
        (t.settings -> 'modules' -> 'inventory' ->> 'enabled')::boolean IS TRUE
        OR (t.settings -> 'modules' -> 'commerce' ->> 'enabled')::boolean IS TRUE
        OR (t.settings -> 'modules' -> 'b2b' ->> 'enabled')::boolean IS TRUE
      )
  );
