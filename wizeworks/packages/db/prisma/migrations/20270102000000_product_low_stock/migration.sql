-- Denormalized Product.low_stock — the sibling of Product.in_stock.
--
-- A product is "low stock" when it is still sellable (in_stock = true) AND at
-- least one of its variant/warehouse inventory_levels rows has crossed its
-- reorder point per the module's ONE canonical predicate:
--   reorder_point IS NOT NULL AND (on_hand - allocated - safety_buffer) <= reorder_point
-- (see @sparx/inventory low-stock.ts LOW_STOCK_SQL / isLowStock). This closes the
-- collection-rule compiler's `inventory low_stock` gap: it now maps to a plain
-- indexed column filter `{ low_stock: true }`, exactly like in_stock does. The
-- column is maintained going forward by syncProductInStock() in the SAME tx that
-- maintains in_stock — never written inline. Mirrors in_stock: NOT NULL DEFAULT
-- false, no dedicated index (in_stock carries none either).

-- AlterTable
ALTER TABLE "commerce_products" ADD COLUMN "low_stock" BOOLEAN NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────────────────
-- Backfill (RLS-aware). Both commerce_products and inventory_levels are
-- ENABLE + FORCE ROW LEVEL SECURITY, so sparx_owner (the migration role, a
-- NON-superuser in prod) sees ZERO rows with app.tenant_id unset —
-- current_tenant_id() → NULL → the tenant_isolation policy filters everything
-- out, and the UPDATE would silently no-op in prod while "passing" locally
-- under the superuser. Loop per tenant and set app.tenant_id locally before
-- each write — the same GUC withTenant sets, the same idiom as
-- 20260611000000_sitebuilder_templates.
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM "tenants" LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        UPDATE "commerce_products" p
        SET "low_stock" = true
        WHERE p."in_stock" = true
          AND EXISTS (
              SELECT 1
              FROM "inventory_levels" l
              JOIN "commerce_product_variants" v ON v."id" = l."variant_id"
              WHERE v."product_id" = p."id"
                AND v."deleted_at" IS NULL
                AND l."reorder_point" IS NOT NULL
                AND (l."on_hand" - l."allocated" - l."safety_buffer") <= l."reorder_point"
          );
    END LOOP;

    PERFORM set_config('app.tenant_id', '', true);
END $$;
