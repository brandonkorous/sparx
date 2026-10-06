// Shared internals for the inventory service split — guards + the denormalized
// in-stock recompute. Imported by the ledger, movements, reservations, and lot
// modules; depends only on @wizeworks/db + the module error vocabulary, so it never
// forms a cycle with the higher-level service files.

import type { TxClient } from '@wizeworks/db';

import { InventoryNotFoundError } from '../errors';
import {
  AVAILABILITY_LEVEL_SELECT,
  availabilityLevelOf,
  computeAvailability,
} from './availability';
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
 * What to call a variant in a message somebody will read.
 *
 * The product's name with the code beside it, which is exactly how every list in
 * the console prints a line ("Brass belt hardware, antique · BRASS-BELT-1"), so
 * a refusal names the same thing the screen does.
 *
 * Called only on a FAILURE path, never on the way a request normally goes, so
 * the extra read costs nothing that anybody waits for. Returns null rather than
 * throwing when the variant cannot be read: a refusal with a worse sentence is
 * still a refusal, and losing one is far worse than losing a name.
 */
export async function variantLabel(tx: TxClient, variantId: string): Promise<string | null> {
  const row = await tx.productVariant.findFirst({
    where: { id: variantId },
    select: { sku: true, title: true, product: { select: { title: true } } },
  });
  if (!row) return null;
  const name = row.product?.title ?? row.title ?? null;
  if (!name) return row.sku || null;
  return row.sku ? `${name} (${row.sku})` : name;
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

  // A product is in stock when any live version of it can be bought, asked the
  // ONE way the product page asks it: `computeAvailability`, per variant, over
  // the same level columns (`AVAILABILITY_LEVEL_SELECT`). A version nobody has
  // counted is untracked and buyable; one that may be sold past zero
  // (continue / preorder, which covers dropship and print-on-demand) is always
  // buyable; otherwise it needs a unit some location can actually sell.
  //
  // This used to be its own sum, `Σ(on_hand − allocated − unsellable)` over
  // every level of every version, and it disagreed with the page twice. It
  // dropped the safety buffer, so a product whose last units were withheld read
  // in stock in the grid and sold out on its page. And it did not floor a
  // location at zero, so one oversold location cancelled real stock at another:
  // MEASURED 2026-10-03 on Gillett Diesel, a CP4 kit with one on the shop's
  // shelf and the warehouse at 0 on hand / 3 allocated summed to −2, and the
  // grid said Sold out while the product page offered Add to cart for the one
  // that was there (after order O-000014).
  const variants = await tx.productVariant.findMany({
    where: { productId: variant.productId, deletedAt: null },
    select: {
      inventoryPolicy: true,
      inventoryLevels: { select: { ...AVAILABILITY_LEVEL_SELECT, reorderPoint: true } },
    },
  });
  const levels = variants.flatMap((v) => v.inventoryLevels);
  // A product with no live version keeps the old answer (in stock): there is
  // nothing to have counted, and the page falls back to this column for it.
  const inStock =
    variants.length === 0 ||
    variants.some(
      (v) =>
        computeAvailability(v.inventoryLevels.map(availabilityLevelOf), v.inventoryPolicy, {
          inventoryActive: true,
        }).inStock
    );
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
