-- Built-in product kinds wear a symbol, not the name of one.
--
-- The seven platform-owned rows were seeded with the icon LIBRARY's names —
-- 'shirt', 'wrench', 'utensils-crossed' — into a column the console renders as
-- literal text beside the name. So "Kinds of product" listed "shirt Apparel",
-- and the kind picker on every product form did the same (issue 167). The
-- field's own description says "a small symbol, such as an emoji", which is
-- what these now are.
--
-- Mirrors wizeworks/packages/commerce-schemas/src/product-types/builtins/*.ts.
-- Scoped to the PLATFORM tenant and to `is_built_in`, so a business that opened
-- one of these, edited it and kept its own copy is not overwritten.

UPDATE commerce_product_types SET icon = '👕',  updated_at = NOW() WHERE tenant_id = '00000000-0000-0000-0000-000000000000' AND is_built_in AND key = 'apparel'       AND icon = 'shirt';
UPDATE commerce_product_types SET icon = '🔧',  updated_at = NOW() WHERE tenant_id = '00000000-0000-0000-0000-000000000000' AND is_built_in AND key = 'auto_part'     AND icon = 'wrench';
UPDATE commerce_product_types SET icon = '💄',  updated_at = NOW() WHERE tenant_id = '00000000-0000-0000-0000-000000000000' AND is_built_in AND key = 'cosmetics'     AND icon = 'sparkles';
UPDATE commerce_product_types SET icon = '💻',  updated_at = NOW() WHERE tenant_id = '00000000-0000-0000-0000-000000000000' AND is_built_in AND key = 'electronics'   AND icon = 'cpu';
UPDATE commerce_product_types SET icon = '🍽️', updated_at = NOW() WHERE tenant_id = '00000000-0000-0000-0000-000000000000' AND is_built_in AND key = 'food_beverage' AND icon = 'utensils-crossed';
UPDATE commerce_product_types SET icon = '🏷️', updated_at = NOW() WHERE tenant_id = '00000000-0000-0000-0000-000000000000' AND is_built_in AND key = 'general'       AND icon = 'tag';
UPDATE commerce_product_types SET icon = '💡',  updated_at = NOW() WHERE tenant_id = '00000000-0000-0000-0000-000000000000' AND is_built_in AND key = 'home_goods'    AND icon = 'lamp';
