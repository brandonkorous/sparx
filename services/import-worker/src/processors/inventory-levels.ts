// Stock levels — SKU × location → on hand.
//
// The entity a migration is most likely to drop and the one whose absence hurts most:
// a catalogue with no stock numbers is a shop that cannot sell, and the tenant's only
// remedy is to physically re-count everything they own. [docs/68 §8] has carried
// "inventory-adjustment CSV import (SKU + location)" as an open item since it was
// written; this closes it.
//
// Three things make this processor more than a loop:
//
//   Locations are created on demand. Shopify calls it "Main Warehouse", Square calls
//   it "Downtown", and neither exists here yet. Requiring the tenant to pre-create
//   locations whose names exactly match their export is the step where an inventory
//   migration gets abandoned.
//
//   The count is set ABSOLUTELY, not added. An import is a statement of what is on the
//   shelf, not a movement. Re-running the same file must leave the same number — a
//   delta would double it, and the tenant would discover that at the worst moment.
//
//   Every write goes through the ledger like any other stock change, so an imported
//   count is auditable and reconcilable rather than a number that appeared from
//   nowhere. `idempotencyKey` makes a retried job apply exactly once.

import { withTenant } from '@sparx/db';
import { inventoryService } from '@sparx/inventory';
import { toInteger } from '@sparx/migration';

import { Resolver } from './resolve';
import {
  eachRow,
  type EntityProcessor,
  type ImportRow,
  type PreviewResult,
  type RowResult,
} from './types';

function readRow(row: ImportRow): { sku: string; location: string; quantity: number | undefined } {
  return {
    sku: (row.sku ?? '').trim(),
    location: (row.location ?? '').trim(),
    quantity: toInteger(row.quantity ?? row.available ?? row.on_hand),
  };
}

export const inventoryLevelsProcessor: EntityProcessor = {
  entity: 'inventory_levels',
  module: 'inventory',

  async run(ctx, rows, options, logger) {
    const resolver = new Resolver(ctx);
    const note = options.vendor === undefined ? 'Imported' : `Imported from ${options.vendor}`;

    return eachRow<RowResult>(
      rows,
      logger,
      async (row, rowIndex) => {
        const { sku, location, quantity } = readRow(row);
        const naturalKey = location === '' ? sku : `${sku} @ ${location}`;

        if (sku === '') {
          return { rowIndex, status: 'error', errorMsg: 'No SKU, so there is nothing to count.' };
        }
        if (quantity === undefined) {
          return {
            rowIndex,
            status: 'error',
            naturalKey,
            errorMsg: `"${row.quantity ?? ''}" is not a number of units.`,
          };
        }

        const variant = await resolver.variantBySku(sku);
        if (variant === null) {
          return {
            rowIndex,
            status: 'error',
            naturalKey,
            errorMsg: `No product here has the SKU "${sku}". Import your products first, then this file.`,
          };
        }

        const warehouse = await resolver.warehouseByName(location);

        await inventoryService.updateLevelCount(ctx, variant.id, {
          warehouseId: warehouse.id,
          onHand: Math.max(quantity, 0),
          reason: 'recount',
          note,
          // Stable across retries of the same job AND across a re-upload of the same
          // file: the count is absolute, so applying it twice is harmless, but the
          // ledger should not show two movements for one statement of fact.
          idempotencyKey: `import:${ctx.tenantId}:${variant.id}:${warehouse.id}:${quantity}`,
        });

        // Reorder policy, where the export carried one. Optional everywhere, so a
        // failure here must not cost the count that already landed.
        const reorderPoint = toInteger(row.reorder_point);
        const reorderQuantity = toInteger(row.reorder_quantity);
        if (reorderPoint !== undefined || reorderQuantity !== undefined) {
          try {
            await inventoryService.setReorderPolicy(ctx, {
              variantId: variant.id,
              warehouseId: warehouse.id,
              ...(reorderPoint !== undefined ? { reorderPoint } : {}),
              ...(reorderQuantity !== undefined ? { reorderQuantity } : {}),
            });
          } catch (error) {
            logger.warn({ err: error, sku }, 'reorder policy skipped');
          }
        }

        return {
          rowIndex,
          status: 'updated',
          naturalKey,
          ...(warehouse.created
            ? {
                errorMsg: `Created the location "${location === '' ? 'Main' : location}" for this count.`,
              }
            : {}),
        };
      },
      (rowIndex, message) => ({ rowIndex, status: 'error', errorMsg: message })
    );
  },

  async preview(ctx, rows, logger) {
    const resolver = new Resolver(ctx);
    // Locations are looked up but never created during a preview — a dry run that
    // left three new warehouses behind would not be a dry run.
    const knownLocations = new Set(
      (
        await withTenant(ctx, (tx) =>
          tx.warehouse.findMany({
            where: { tenantId: ctx.tenantId, deletedAt: null },
            select: { name: true },
          })
        )
      ).map((warehouse) => warehouse.name.trim().toLowerCase())
    );

    return eachRow<PreviewResult>(
      rows,
      logger,
      async (row, rowIndex) => {
        const { sku, location, quantity } = readRow(row);
        const naturalKey = location === '' ? sku : `${sku} @ ${location}`;

        if (sku === '') return { rowIndex, action: 'error', errorMsg: 'No SKU.' };
        if (quantity === undefined)
          return { rowIndex, action: 'error', naturalKey, errorMsg: 'Quantity is not a number.' };

        const variant = await resolver.variantBySku(sku);
        if (variant === null) {
          return {
            rowIndex,
            action: 'error',
            naturalKey,
            errorMsg: `No product with SKU "${sku}" yet.`,
          };
        }

        const locationKey = (location === '' ? 'main' : location).trim().toLowerCase();
        return {
          rowIndex,
          action: 'update',
          naturalKey,
          ...(knownLocations.has(locationKey)
            ? {}
            : { errorMsg: `Will create the location "${location === '' ? 'Main' : location}".` }),
        };
      },
      (rowIndex, message) => ({ rowIndex, action: 'error', errorMsg: message })
    );
  },
};
