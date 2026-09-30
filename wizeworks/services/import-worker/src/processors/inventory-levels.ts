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
//
// Every column read here is a canonical field key (`ENTITY_FIELDS.inventory_levels`),
// held equal by `contract.test.ts`. "Available" and "Incoming" are off that list:
// available is on hand less what is already promised to orders, and incoming is what
// open purchase orders are bringing, so both are worked out here rather than stored,
// and a file's copy of either has nowhere to go. Unit cost, barcode and bin used to
// be offered and dropped; they are saved below, each only when the cell has a value.

import { variantService } from '@wizeworks/commerce';
import { withTenant } from '@wizeworks/db';
import { inventoryService } from '@wizeworks/inventory';
import { toCents, toInteger } from '@wizeworks/migration';

import { Resolver } from './resolve';
import {
  eachRow,
  type EntityProcessor,
  type ImportRow,
  type PreviewResult,
  type ProcessorContext,
  type RowResult,
} from './types';

function readRow(row: ImportRow): { sku: string; location: string; quantity: number | undefined } {
  return {
    sku: (row.sku ?? '').trim(),
    location: (row.location ?? '').trim(),
    quantity: toInteger(row.quantity),
  };
}

function present(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== '';
}

/**
 * The item's cost and barcode, which live on the item rather than the location.
 *
 * Optional, like the reorder policy: a failure here must not cost the count that
 * already landed, so each problem comes back as a sentence for the run report.
 */
async function saveItemDetails(
  ctx: ProcessorContext,
  variantId: string,
  row: ImportRow
): Promise<string[]> {
  const notes: string[] = [];
  const costCents = toCents(row.cost_per_item);
  const barcode = present(row.barcode) ? row.barcode.trim() : undefined;
  const barcodeOk = barcode !== undefined && /^\d{8,14}$/.test(barcode);
  if (barcode !== undefined && !barcodeOk) {
    notes.push(
      `“${barcode}” is not a barcode that can be stored here (8 to 14 digits), so it was left off.`
    );
  }
  if (costCents !== undefined && costCents < 0) {
    notes.push('A unit cost cannot be below zero, so the cost was not set from this row.');
  }

  const input = {
    ...(costCents !== undefined && costCents >= 0 ? { costCents } : {}),
    ...(barcodeOk ? { barcode } : {}),
  };
  if (Object.keys(input).length === 0) return notes;
  try {
    await variantService.update(ctx, variantId, input);
  } catch (error) {
    const what = [
      ...('costCents' in input ? ['cost'] : []),
      ...('barcode' in input ? ['barcode'] : []),
    ].join(' and ');
    const reason = error instanceof Error ? error.message : String(error);
    notes.push(`The count was saved, but the item’s ${what} could not be: ${reason}`);
  }
  return notes;
}

/**
 * The item's home shelf at this location, when the file names one that is set up.
 *
 * Shelves are not created from a stock file. A shelf is a place in a building that
 * somebody lays out on purpose, with its own code, zone and pick order, and a
 * location has to have shelves switched on before it has any; inventing them from a
 * column would scatter placeholder shelves nobody can find. Matched by code, then by
 * name.
 */
async function saveHomeBin(
  ctx: ProcessorContext,
  variantId: string,
  warehouseId: string,
  bin: string
): Promise<string | null> {
  const found = await withTenant(ctx, (tx) =>
    tx.inventoryBin.findFirst({
      where: {
        tenantId: ctx.tenantId,
        warehouseId,
        isActive: true,
        deletedAt: null,
        OR: [
          { code: { equals: bin, mode: 'insensitive' } },
          { name: { equals: bin, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    })
  );
  if (found === null) {
    return `No shelf called “${bin}” is set up at this location, so its home shelf was not set.`;
  }
  try {
    await inventoryService.setVariantHomeBin(ctx, variantId, found.id);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return `The count was saved, but its home shelf could not be set: ${reason}`;
  }
  return null;
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

        const notes = await saveItemDetails(ctx, variant.id, row);
        if (present(row.bin)) {
          const binNote = await saveHomeBin(ctx, variant.id, warehouse.id, row.bin.trim());
          if (binNote !== null) notes.push(binNote);
        }

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

        if (warehouse.created) {
          notes.unshift(
            `Created the location "${location === '' ? 'Main' : location}" for this count.`
          );
        }
        return {
          rowIndex,
          status: 'updated',
          naturalKey,
          ...(notes.length > 0 ? { errorMsg: notes.join(' ') } : {}),
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
