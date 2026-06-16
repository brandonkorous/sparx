// Shared internals for the inventory service split — guards + the denormalized
// in-stock recompute. Imported by the ledger, movements, reservations, and lot
// modules; depends only on @sparx/db + the module error vocabulary, so it never
// forms a cycle with the higher-level service files.

import type { TxClient } from '@sparx/db';

import { InventoryNotFoundError } from '../errors';

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
 * Recompute the product's denormalized `inStock` flag from current available
 * across all warehouses. Cheap, runs inside the caller's tx so the storefront's
 * PLP grid stays consistent with inventory state. Called by `applyMovement`
 * (every onHand change) and by the reservation paths (allocated changes).
 */
export async function syncProductInStock(tx: TxClient, variantId: string): Promise<void> {
  const variant = await tx.productVariant.findFirst({
    where: { id: variantId },
    select: { productId: true },
  });
  if (!variant) return;

  // A product is "in stock" if it has positive available inventory in any
  // warehouse, OR any live variant is orderable without tracked stock
  // (inventoryPolicy continue/preorder). The latter covers dropship / print-on-
  // demand, whose stock lives with the supplier and never appears in
  // inventory_levels — counting only on-hand would mark those permanently sold
  // out even though they're always purchasable.
  const [levels, sellableWithoutStock] = await Promise.all([
    tx.inventoryLevel.findMany({
      where: { variant: { productId: variant.productId, deletedAt: null } },
      select: { onHand: true, allocated: true },
    }),
    tx.productVariant.count({
      where: {
        productId: variant.productId,
        deletedAt: null,
        inventoryPolicy: { not: 'deny' },
      },
    }),
  ]);
  const total = levels.reduce((acc, l) => acc + (l.onHand - l.allocated), 0);
  await tx.product.update({
    where: { id: variant.productId },
    data: { inStock: total > 0 || sellableWithoutStock > 0 },
  });
}
