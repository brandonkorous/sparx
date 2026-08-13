// Shared internals for the inventory service split — guards + the denormalized
// in-stock recompute. Imported by the ledger, movements, reservations, and lot
// modules; depends only on @sparx/db + the module error vocabulary, so it never
// forms a cycle with the higher-level service files.

import type { TxClient } from '@sparx/db';

import { InventoryNotFoundError } from '../errors';
import { isLowStock } from './low-stock';

// Cart reservations default to a 30-minute soft hold; the reaper releases them.
export const CART_TTL_SECONDS_DEFAULT = 30 * 60;

export async function ensureWarehouseActive(tx: TxClient, warehouseId: string): Promise<void> {
  const w = await tx.warehouse.findFirst({
    where: { id: warehouseId, deletedAt: null, isActive: true },
    select: { id: true },
  });
  if (!w) throw new InventoryNotFoundError('Warehouse', warehouseId);
}

export async function ensureVariantExists(tx: TxClient, variantId: string): Promise<void> {
  const v = await tx.productVariant.findFirst({
    where: { id: variantId, deletedAt: null },
    select: { id: true },
  });
  if (!v) throw new InventoryNotFoundError('Variant', variantId);
}

/**
 * Recompute the product's denormalized `inStock` + `lowStock` flags from current
 * levels across all warehouses. Cheap, runs inside the caller's tx so the
 * storefront's PLP grid stays consistent with inventory state. Called by
 * `applyMovement` (every onHand change) and by the reservation paths (allocated
 * changes).
 */
export async function syncProductInStock(
  tx: TxClient,
  variantId: string,
  // Whether the tenant tracks inventory (the `inventory` module is active). Defaults
  // true because the inventory-internal callers (ledger movements, reservations) only
  // ever run when it IS active. Commerce/installer callers pass the real flag: a tenant
  // with inventory OFF does not manage stock at all, so its products are ALWAYS sellable
  // — defaulting them to the column's `false` would strand every product at "Sold out"
  // on the storefront with no way to fix it. Mirrors `computeAvailability`'s untracked
  // path so the denormalized column agrees with the live availability calc.
  inventoryActive = true
): Promise<void> {
  const variant = await tx.productVariant.findFirst({
    where: { id: variantId },
    select: { productId: true },
  });
  if (!variant) return;

  if (!inventoryActive) {
    await tx.product.update({
      where: { id: variant.productId },
      data: { inStock: true, lowStock: false },
    });
    return;
  }

  // A product is "in stock" if it has positive available inventory in any
  // warehouse, OR any live variant is orderable without tracked stock
  // (inventoryPolicy continue/preorder). The latter covers dropship / print-on-
  // demand, whose stock lives with the supplier and never appears in
  // inventory_levels — counting only on-hand would mark those permanently sold
  // out even though they're always purchasable.
  const [levels, sellableWithoutStock] = await Promise.all([
    tx.inventoryLevel.findMany({
      where: { variant: { productId: variant.productId, deletedAt: null } },
      // safetyBuffer + reorderPoint feed the low-stock predicate below.
      select: {
        onHand: true,
        allocated: true,
        safetyBuffer: true,
        unsellableOnHand: true,
        reorderPoint: true,
      },
    }),
    tx.productVariant.count({
      where: {
        productId: variant.productId,
        deletedAt: null,
        inventoryPolicy: { not: 'deny' },
      },
    }),
  ]);
  const total = levels.reduce((acc, l) => acc + (l.onHand - l.allocated - l.unsellableOnHand), 0);
  const inStock = total > 0 || sellableWithoutStock > 0;
  // "Low stock" = still sellable, but at least one level has crossed its reorder
  // point per the module's ONE canonical predicate (isLowStock). A level with no
  // reorder point never counts (an owner who set no trigger asked for no signal),
  // and an always-purchasable product with no tracked levels is never "low".
  const lowStock = inStock && levels.some((l) => isLowStock(l));
  await tx.product.update({
    where: { id: variant.productId },
    data: { inStock, lowStock },
  });
}
