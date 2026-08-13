// Editing stock like a spreadsheet (docs/146 Phase 11.5).
//
// The complaint this closes is the oldest one in §2 of docs/146: a stock system
// where changing forty reorder points means forty screens loses to a spreadsheet
// every time, no matter what else it can do. So: a grid, inline edit, paste a
// column, select a block and act on all of it.
//
// ── The one thing a grid must not do ─────────────────────────────────────────
//
// A cell shows a number and a person types over it. The obvious implementation
// sends the DIFFERENCE — new value minus what the cell was showing — and it is
// wrong, because what the cell was showing is a minute old. Somebody sold three
// units while the grid was open and the difference posts against a number that
// has since moved.
//
// So the browser sends the TARGET and the server computes the delta against
// what is live, inside the row lock, exactly as a count does. What the operator
// typed is honoured; what happened underneath is not lost.
//
// Everything else here is bookkeeping fields — reorder point, buffer, cost, the
// tenant's own columns — which are plain overwrites and need none of that care.

import {
  StockGridSaveInput,
  customFieldColumn,
  readCustomFields,
  type CustomFieldDefinition,
  type CustomFieldValue,
  type StockGridEdit,
  type StockGridEditResult,
} from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { csvSafeText, type CsvTable } from '../csv';
import type { ServiceContext } from '../errors';

import { applyCustomFields, loadCustomFieldDefinitions } from './custom-fields';
import { applyMovement, emitStockEvents, resolveActorType } from './ledger';

export interface StockGridRow {
  variantId: string;
  warehouseId: string;
  sku: string;
  title: string;
  warehouseCode: string;
  warehouseName: string;
  onHand: number;
  allocated: number;
  available: number;
  reorderPoint: number | null;
  reorderQuantity: number | null;
  safetyBuffer: number;
  unitCostCents: number | null;
  avgCostCents: number | null;
  abcClass: string | null;
  /** The tenant's own columns, already read through their definitions so a
   *  value left behind by a removed field does not appear. */
  customFields: Record<string, CustomFieldValue>;
}

export interface StockGridFilter {
  warehouseId?: string | null;
  search?: string | null;
  /** Only positions below their reorder point. */
  lowOnly?: boolean;
  take?: number;
  skip?: number;
}

export interface StockGridPage {
  rows: StockGridRow[];
  total: number;
  /** The custom-field definitions the grid should render columns for — every
   *  active one for a stock position, not only those flagged for lists: the
   *  grid IS where a person fills them in. */
  customFields: CustomFieldDefinition[];
}

export async function stockGrid(
  ctx: ServiceContext,
  filter: StockGridFilter = {}
): Promise<StockGridPage> {
  const take = Math.min(filter.take ?? 100, 500);
  const search = filter.search?.trim() ?? '';

  return withTenant(ctx, async (tx) => {
    const definitions = await loadCustomFieldDefinitions(tx, ctx.tenantId, 'level');
    const where = {
      tenantId: ctx.tenantId,
      variant: {
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { sku: { contains: search, mode: 'insensitive' as const } },
                { title: { contains: search, mode: 'insensitive' as const } },
                { product: { title: { contains: search, mode: 'insensitive' as const } } },
              ],
            }
          : {}),
      },
      ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
      ...(filter.lowOnly ? { reorderPoint: { not: null } } : {}),
    };

    const [levels, total] = await Promise.all([
      tx.inventoryLevel.findMany({
        where,
        include: {
          variant: { select: { sku: true, title: true, product: { select: { title: true } } } },
          warehouse: { select: { code: true, name: true } },
        },
        orderBy: [{ variant: { sku: 'asc' } }],
        take,
        skip: filter.skip ?? 0,
      }),
      tx.inventoryLevel.count({ where }),
    ]);

    const rows = levels
      // `lowOnly` finishes in JS because "below the reorder point" is a
      // comparison between two columns, which Prisma cannot express in a filter.
      // The SQL filter above narrows to rows that HAVE a reorder point first, so
      // this is not a scan of the whole table.
      .filter((level) =>
        filter.lowOnly ? level.reorderPoint !== null && level.onHand <= level.reorderPoint : true
      )
      .map((level) => ({
        variantId: level.variantId,
        warehouseId: level.warehouseId,
        sku: level.variant.sku,
        title: level.variant.title ?? level.variant.product.title,
        warehouseCode: level.warehouse.code,
        warehouseName: level.warehouse.name,
        onHand: level.onHand,
        allocated: level.allocated,
        available: level.onHand - level.allocated - level.safetyBuffer,
        reorderPoint: level.reorderPoint,
        reorderQuantity: level.reorderQuantity,
        safetyBuffer: level.safetyBuffer,
        unitCostCents: level.unitCostCents,
        avgCostCents: level.avgCostCents,
        abcClass: level.abcClass,
        customFields: readCustomFields(definitions, level.customFields),
      }));

    return { rows, total, customFields: definitions };
  });
}

export interface StockGridSaveResult {
  results: StockGridEditResult[];
  /** Rows that saved. */
  saved: number;
  /** Rows that did not, each with its reason on the row. A partial save is
   *  reported as a partial save: forty edits where two fail must not report
   *  success, and must not throw away the thirty-eight that worked. */
  failed: number;
  unitsChanged: number;
}

/**
 * Save a block of grid edits.
 *
 * Each row is its own transaction. A grid save is forty independent facts about
 * forty different items, and one bad row taking the other thirty-nine with it
 * would make bulk editing feel like a coin toss — the exact experience the
 * spreadsheet does not have.
 */
export async function saveStockGrid(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<StockGridSaveResult> {
  const input = StockGridSaveInput.parse(rawInput);
  const results: StockGridEditResult[] = [];
  const events: {
    variantId: string;
    warehouseId: string;
    result: Awaited<ReturnType<typeof applyMovement>>;
    delta: number;
  }[] = [];

  for (const edit of input.edits) {
    try {
      const outcome = await withTenant(ctx, (tx) =>
        saveOne(tx, ctx, edit, input.reason, input.note)
      );
      results.push(outcome.result);
      if (outcome.event) events.push(outcome.event);
    } catch (error) {
      results.push({
        variantId: edit.variantId,
        warehouseId: edit.warehouseId,
        delta: null,
        onHand: 0,
        fieldsChanged: [],
        error: error instanceof Error ? error.message : 'This row could not be saved',
      });
    }
  }

  // After every transaction has committed, for the reason the importer does the
  // same: announcing a level a rollback then un-did is worse than announcing it
  // late.
  for (const event of events) {
    await emitStockEvents(
      ctx,
      event.variantId,
      event.warehouseId,
      event.result,
      event.delta,
      input.reason
    );
  }

  const saved = results.filter((row) => row.error === null).length;
  return {
    results,
    saved,
    failed: results.length - saved,
    unitsChanged: results.reduce((sum, row) => sum + Math.abs(row.delta ?? 0), 0),
  };
}

async function saveOne(
  tx: TxClient,
  ctx: ServiceContext,
  edit: StockGridEdit,
  reason: string,
  note: string | null
): Promise<{
  result: StockGridEditResult;
  event: {
    variantId: string;
    warehouseId: string;
    result: Awaited<ReturnType<typeof applyMovement>>;
    delta: number;
  } | null;
}> {
  const fieldsChanged: string[] = [];
  const bookkeeping: Record<string, number | null> = {};
  if (edit.reorderPoint !== undefined) bookkeeping.reorderPoint = edit.reorderPoint;
  if (edit.reorderQuantity !== undefined) bookkeeping.reorderQuantity = edit.reorderQuantity;
  if (edit.safetyBuffer !== undefined) bookkeeping.safetyBuffer = edit.safetyBuffer;
  if (edit.unitCostCents !== undefined) bookkeeping.unitCostCents = edit.unitCostCents;

  // The level has to exist before anything can be written to it. A grid row for
  // a (variant, location) pair with no level is a real case — an item that has
  // never been stocked here — so it is created empty rather than refused.
  const level = await tx.inventoryLevel.upsert({
    where: {
      variantId_warehouseId: { variantId: edit.variantId, warehouseId: edit.warehouseId },
    },
    update: {},
    create: {
      tenantId: ctx.tenantId,
      variantId: edit.variantId,
      warehouseId: edit.warehouseId,
      onHand: 0,
    },
    select: { onHand: true },
  });

  if (Object.keys(bookkeeping).length > 0) {
    await tx.inventoryLevel.update({
      where: {
        variantId_warehouseId: { variantId: edit.variantId, warehouseId: edit.warehouseId },
      },
      data: bookkeeping,
    });
    fieldsChanged.push(...Object.keys(bookkeeping));
  }

  if (edit.customFields && Object.keys(edit.customFields).length > 0) {
    const written = await applyCustomFields(
      tx,
      ctx,
      'level',
      { variantId: edit.variantId, warehouseId: edit.warehouseId },
      edit.customFields
    );
    fieldsChanged.push(...written.changed.map(customFieldColumn));
  }

  let delta: number | null = null;
  let onHand = level.onHand;
  let event: {
    variantId: string;
    warehouseId: string;
    result: Awaited<ReturnType<typeof applyMovement>>;
    delta: number;
  } | null = null;

  if (edit.onHand !== undefined) {
    // `setOnHand`, not a delta: the effective change is computed against LIVE
    // on-hand inside the row lock, so a sale that landed while the grid was open
    // is reconciled rather than lost.
    const result = await applyMovement(tx, {
      tenantId: ctx.tenantId,
      variantId: edit.variantId,
      warehouseId: edit.warehouseId,
      delta: 0,
      setOnHand: edit.onHand,
      reason,
      referenceType: 'StockGrid',
      referenceId: null,
      note,
      actorType: resolveActorType(ctx),
      actorId: ctx.userId ?? null,
    });
    onHand = result.onHand;
    delta = result.appliedDelta;
    if (delta !== 0) {
      fieldsChanged.push('onHand');
      event = { variantId: edit.variantId, warehouseId: edit.warehouseId, result, delta };
    }
  }

  if (fieldsChanged.length > 0) {
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.level.grid_edit',
      entityType: 'InventoryLevel',
      // The VARIANT id: `audit_logs.entity_id` is a UUID column, and a level's
      // two-part key is not one. The location rides in the diff.
      entityId: edit.variantId,
      diff: { after: { warehouseId: edit.warehouseId, fields: fieldsChanged, delta } },
    });
  }

  return {
    result: {
      variantId: edit.variantId,
      warehouseId: edit.warehouseId,
      delta,
      onHand,
      fieldsChanged,
      error: null,
    },
    event: event,
  };
}

/**
 * The grid, as a spreadsheet.
 *
 * Same columns the grid shows and the importer reads, so the round trip that
 * 10.6 promises reaches the bulk-edit path too: export the grid, edit four
 * hundred rows in the tool you already know, bring it back.
 */
export async function stockGridCsv(
  ctx: ServiceContext,
  filter: StockGridFilter = {}
): Promise<CsvTable> {
  const page = await stockGrid(ctx, { ...filter, take: filter.take ?? 5000 });
  return {
    name: 'stock-grid',
    headers: [
      'sku',
      'item',
      'warehouse',
      'on_hand',
      'reorder_point',
      'reorder_quantity',
      'safety_buffer',
      'unit_cost',
      ...page.customFields.map((definition) => customFieldColumn(definition.key)),
    ],
    rows: page.rows.map((row) => [
      row.sku,
      csvSafeText(row.title),
      row.warehouseCode,
      row.onHand,
      row.reorderPoint,
      row.reorderQuantity,
      row.safetyBuffer,
      // Cents out as a decimal, because the column comes back through the
      // importer's number parser and a person editing it will type 4.50.
      row.unitCostCents === null ? null : (row.unitCostCents / 100).toFixed(2),
      ...page.customFields.map((definition) => {
        const value = row.customFields[definition.key];
        if (value === null || value === undefined) return null;
        if (Array.isArray(value)) return value.join('|');
        if (typeof value === 'string') return csvSafeText(value);
        return value;
      }),
    ]),
  };
}
