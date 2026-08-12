// Suppliers and purchase orders — the inbound half of inventory.
//
// Stock levels answer "what is on the shelf." These answer "where does more come
// from, at what cost, and what is already on its way." A tenant who migrates the
// first and not the second has a warehouse they can sell out of and no way to
// refill it, and the reorder planner — which is one of the reasons to be on this
// platform at all — has nothing to work with until they re-enter every supplier
// by hand.
//
// No competitor on the roster exports either one, which is exactly why they are
// here: this is the path for the ERP or spreadsheet a tenant keeps ALONGSIDE their
// store, through the manual column mapper. Almost every small distributor has one.

import { inventoryService } from '@sparx/inventory';
import { withTenant } from '@sparx/db';
import { toCents, toInteger, toIsoDate } from '@sparx/migration';

import { Resolver, codeFor } from './resolve';
import {
  eachRow,
  type EntityProcessor,
  type ImportRow,
  type PreviewResult,
  type ProcessorContext,
  type RowResult,
} from './types';

async function freeSupplierCode(ctx: ProcessorContext, desired: string): Promise<string> {
  const base = (codeFor(desired) || 'SUP').slice(0, 28);
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const taken = await withTenant(ctx, (tx) =>
      tx.supplier.findFirst({
        where: { tenantId: ctx.tenantId, code: candidate },
        select: { id: true },
      })
    );
    if (taken === null) return candidate;
  }
  return `SUP-${Date.now().toString(36).toUpperCase()}`;
}

async function findSupplier(
  ctx: ProcessorContext,
  name: string,
  code: string
): Promise<{ id: string } | null> {
  return withTenant(ctx, (tx) =>
    tx.supplier.findFirst({
      where: {
        tenantId: ctx.tenantId,
        deletedAt: null,
        OR: [
          { name: { equals: name, mode: 'insensitive' } },
          ...(code === '' ? [] : [{ code: { equals: code, mode: 'insensitive' as const } }]),
        ],
      },
      select: { id: true },
    })
  );
}

export const suppliersProcessor: EntityProcessor = {
  entity: 'suppliers',
  module: 'inventory',

  async run(ctx, rows, options, logger) {
    const resolver = new Resolver(ctx);

    return eachRow<RowResult>(
      rows,
      logger,
      async (row, rowIndex) => {
        const name = (row.name ?? '').trim();
        if (name === '')
          return { rowIndex, status: 'error', errorMsg: 'This row has no supplier name.' };

        const givenCode = (row.code ?? '').trim();
        const existing = await findSupplier(ctx, name, givenCode);
        if (existing !== null && !options.upsert) {
          return { rowIndex, status: 'skipped', naturalKey: name };
        }

        const input = {
          name: name.slice(0, 160),
          ...(row.email !== undefined && row.email !== '' ? { email: row.email } : {}),
          ...(row.phone !== undefined && row.phone !== '' ? { phone: row.phone.slice(0, 50) } : {}),
          ...(row.address1 !== undefined && row.address1 !== ''
            ? { line1: row.address1.slice(0, 255) }
            : {}),
          ...(row.city !== undefined && row.city !== '' ? { city: row.city.slice(0, 120) } : {}),
          ...(row.country?.length === 2 ? { country: row.country.toUpperCase() } : {}),
          ...(toInteger(row.lead_time_days) !== undefined
            ? { leadTimeDays: toInteger(row.lead_time_days) }
            : {}),
        };

        let supplierId: string;
        if (existing !== null) {
          await inventoryService.updateSupplier(ctx, existing.id, input);
          supplierId = existing.id;
        } else {
          const created = await inventoryService.createSupplier(ctx, {
            ...input,
            code: givenCode === '' ? await freeSupplierCode(ctx, name) : givenCode.slice(0, 32),
          });
          supplierId = created.id;
        }

        // A supplier row that also names a SKU is a price list line — the single most
        // useful thing in the file, because it is what makes reorder cost real.
        const sku = (row.sku ?? '').trim();
        if (sku !== '') {
          const variant = await resolver.variantBySku(sku);
          if (variant === null) {
            return {
              rowIndex,
              status: existing === null ? 'imported' : 'updated',
              naturalKey: name,
              errorMsg: `The supplier was saved, but no product here has the SKU "${sku}", so their price for it was not linked.`,
            };
          }
          await inventoryService.upsertSupplierVariant(ctx, supplierId, {
            variantId: variant.id,
            ...(row.supplier_sku !== undefined && row.supplier_sku !== ''
              ? { supplierSku: row.supplier_sku.slice(0, 100) }
              : {}),
            ...(toCents(row.unit_cost) !== undefined
              ? { unitCostCents: toCents(row.unit_cost) }
              : {}),
            ...(toInteger(row.lead_time_days) !== undefined
              ? { leadTimeDays: toInteger(row.lead_time_days) }
              : {}),
          });
        }

        return {
          rowIndex,
          status: existing === null ? 'imported' : 'updated',
          naturalKey: name,
        };
      },
      (rowIndex, message) => ({ rowIndex, status: 'error', errorMsg: message })
    );
  },

  async preview(ctx, rows, logger) {
    return eachRow<PreviewResult>(
      rows,
      logger,
      async (row, rowIndex) => {
        const name = (row.name ?? '').trim();
        if (name === '') return { rowIndex, action: 'error', errorMsg: 'No supplier name.' };
        const existing = await findSupplier(ctx, name, (row.code ?? '').trim());
        return { rowIndex, action: existing === null ? 'create' : 'update', naturalKey: name };
      },
      (rowIndex, message) => ({ rowIndex, action: 'error', errorMsg: message })
    );
  },
};

// ──────────────────────────────────────────────────────────────────────────────

/** POs arrive flattened, one row per line, like orders. */
interface GatheredPo {
  poNumber: string;
  firstRowIndex: number;
  rowIndexes: number[];
  head: ImportRow;
  lines: ImportRow[];
}

function gatherPos(rows: ImportRow[]): GatheredPo[] {
  const byNumber = new Map<string, GatheredPo>();
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]!;
    const poNumber = (row.po_number ?? '').trim();
    if (poNumber === '') continue;
    const existing = byNumber.get(poNumber);
    if (existing === undefined) {
      byNumber.set(poNumber, {
        poNumber,
        firstRowIndex: index,
        rowIndexes: [index],
        head: row,
        lines: [row],
      });
    } else {
      existing.rowIndexes.push(index);
      existing.lines.push(row);
    }
  }
  return [...byNumber.values()];
}

export const purchaseOrdersProcessor: EntityProcessor = {
  entity: 'purchase_orders',
  module: 'inventory',

  async run(ctx, rows, options, logger) {
    const resolver = new Resolver(ctx);
    const groups = gatherPos(rows);
    const results: RowResult[] = [];

    const claimed = new Set(groups.flatMap((group) => group.rowIndexes));
    for (let index = 0; index < rows.length; index++) {
      if (!claimed.has(index)) {
        results.push({ rowIndex: index, status: 'error', errorMsg: 'This row has no PO number.' });
      }
    }

    for (const group of groups) {
      try {
        const { head, poNumber } = group;

        const existing = await withTenant(ctx, (tx) =>
          tx.purchaseOrder.findFirst({
            where: { tenantId: ctx.tenantId, poNumber },
            select: { id: true },
          })
        );
        if (existing !== null && !options.upsert) {
          for (const rowIndex of group.rowIndexes) {
            results.push({ rowIndex, status: 'skipped', naturalKey: poNumber });
          }
          continue;
        }
        if (existing !== null) {
          // A received PO is a historical fact whose lines have already moved stock.
          // Rewriting it would either double-count that stock or silently erase the
          // receipt, so an existing PO is left exactly as it is.
          for (const rowIndex of group.rowIndexes) {
            results.push({
              rowIndex,
              status: 'skipped',
              naturalKey: poNumber,
              errorMsg: 'A purchase order with this number is already here and was left untouched.',
            });
          }
          continue;
        }

        const supplierName = (head.supplier ?? '').trim();
        const supplier = supplierName === '' ? null : await findSupplier(ctx, supplierName, '');
        if (supplier === null) {
          for (const rowIndex of group.rowIndexes) {
            results.push({
              rowIndex,
              status: 'error',
              naturalKey: poNumber,
              errorMsg:
                supplierName === ''
                  ? 'A purchase order needs a supplier, and this one names none.'
                  : `No supplier called "${supplierName}" is set up yet. Import your suppliers first.`,
            });
          }
          continue;
        }

        const warehouse = await resolver.warehouseByName(head.location ?? '');

        const lineData: { variantId: string; quantity: number; unitCostCents: number }[] = [];
        const missingSkus: string[] = [];
        for (const line of group.lines) {
          const sku = (line.line_sku ?? '').trim();
          if (sku === '') continue;
          const variant = await resolver.variantBySku(sku);
          if (variant === null) {
            missingSkus.push(sku);
            continue;
          }
          lineData.push({
            variantId: variant.id,
            quantity: toInteger(line.line_quantity) ?? 1,
            unitCostCents: toCents(line.line_cost) ?? 0,
          });
        }

        if (lineData.length === 0) {
          for (const rowIndex of group.rowIndexes) {
            results.push({
              rowIndex,
              status: 'error',
              naturalKey: poNumber,
              errorMsg:
                missingSkus.length === 0
                  ? 'This purchase order has no lines.'
                  : `None of its SKUs (${missingSkus.slice(0, 3).join(', ')}) match a product here. Import your products first.`,
            });
          }
          continue;
        }

        const created = await inventoryService.createPurchaseOrder(ctx, {
          supplierId: supplier.id,
          warehouseId: warehouse.id,
          ...(toIsoDate(head.expected_at) !== undefined
            ? { expectedArrivalAt: toIsoDate(head.expected_at) }
            : {}),
          ...(head.po_number === undefined ? {} : { reference: head.po_number.slice(0, 120) }),
          ...(head.note !== undefined && head.note !== '' ? { notes: head.note } : {}),
          lines: lineData,
        });

        results.push({
          rowIndex: group.firstRowIndex,
          status: 'imported',
          naturalKey: created.number ?? poNumber,
          ...(missingSkus.length > 0
            ? {
                errorMsg: `${missingSkus.length} line${missingSkus.length === 1 ? '' : 's'} were left off because their SKUs are not here yet.`,
              }
            : {}),
        });
        for (const rowIndex of group.rowIndexes.slice(1)) {
          results.push({ rowIndex, status: 'skipped', naturalKey: poNumber });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn({ err: error, poNumber: group.poNumber }, 'purchase order failed');
        for (const rowIndex of group.rowIndexes) {
          results.push({
            rowIndex,
            status: 'error',
            naturalKey: group.poNumber,
            errorMsg: message,
          });
        }
      }
    }

    return results.sort((a, b) => a.rowIndex - b.rowIndex);
  },

  async preview(ctx, rows, logger) {
    const groups = gatherPos(rows);
    const results: PreviewResult[] = [];
    const claimed = new Set(groups.flatMap((group) => group.rowIndexes));
    for (let index = 0; index < rows.length; index++) {
      if (!claimed.has(index)) {
        results.push({ rowIndex: index, action: 'error', errorMsg: 'No PO number.' });
      }
    }

    for (const group of groups) {
      let action: PreviewResult['action'] = 'create';
      let errorMsg: string | undefined;
      try {
        const existing = await withTenant(ctx, (tx) =>
          tx.purchaseOrder.findFirst({
            where: { tenantId: ctx.tenantId, poNumber: group.poNumber },
            select: { id: true },
          })
        );
        if (existing !== null) {
          action = 'skip';
          errorMsg = 'Already here — an existing purchase order is never overwritten.';
        }
      } catch (error) {
        logger.warn({ err: error }, 'po preview failed');
        action = 'error';
        errorMsg = error instanceof Error ? error.message : String(error);
      }
      results.push({
        rowIndex: group.firstRowIndex,
        action,
        naturalKey: group.poNumber,
        ...(errorMsg === undefined ? {} : { errorMsg }),
      });
      for (const rowIndex of group.rowIndexes.slice(1)) {
        results.push({ rowIndex, action: 'skip', naturalKey: group.poNumber });
      }
    }

    return results.sort((a, b) => a.rowIndex - b.rowIndex);
  },
};
