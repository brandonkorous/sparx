// Pick lists — turning orders into a walk (docs/146 Phase 4.1).
//
// Generation, reading, and cancellation. What happens once someone is holding
// the list lives in `pick-lifecycle.ts`; which shelf each line names is decided
// in `pick-allocation.ts` (and, really, was decided at checkout — read the
// header comment there before changing anything about sequencing).
//
// ── One instruction per order line, never per variant ────────────────────────
//
// A wave covering nine orders that all want the same widget produces nine lines,
// not one line for nine. Merging them would shorten the walk by nothing (the
// picker still stands at one shelf and counts to nine) and would destroy the only
// thing that makes a short pick actionable: which customer is now missing an
// item. Consecutive lines on one shelf are GROUPED for display and confirmed
// together — that is a screen concern, and it is where the saving actually is.

import { GeneratePickListInput, ListPickListsQuery } from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import type { TxClient } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { InventoryNotFoundError, InventoryValidationError } from '../errors';
import type { ServiceContext } from '../errors';
import { publishInventoryEvent } from '../events';

import { allocationsForOrderLine, toPickStrategy } from './pick-allocation';
import type { PickStrategy } from './pick-allocation';

// ─── Shapes ────────────────────────────────────────────────────────────────────

export interface PickListRow {
  id: string;
  number: string;
  kind: string;
  status: string;
  strategy: string;
  warehouseId: string;
  warehouseName: string;
  assignedTo: string | null;
  orderCount: number;
  orderNumbers: string[];
  lineCount: number;
  /** Lines that are neither picked, short nor skipped. */
  pendingCount: number;
  shortCount: number;
  unitsRequested: number;
  unitsPicked: number;
  note: string | null;
  assignedAt: string | null;
  startedAt: string | null;
  pickedAt: string | null;
  createdAt: string;
}

export interface PickListLineRow {
  id: string;
  orderId: string;
  orderNumber: string;
  orderItemId: string;
  variantId: string;
  sku: string;
  productTitle: string;
  variantTitle: string | null;
  /** What to point the gun at when verifying. */
  primaryBarcode: string | null;
  binId: string | null;
  binCode: string | null;
  binZone: string | null;
  lotId: string | null;
  lotNumber: string | null;
  lotExpiresAt: string | null;
  quantity: number;
  pickedQuantity: number;
  shortQuantity: number;
  shortReason: string | null;
  shortNote: string | null;
  shortCountId: string | null;
  pickSequence: number;
  status: string;
  verifiedByScan: boolean;
  pickedAt: string | null;
  pickedBy: string | null;
}

export interface PickListDetail extends PickListRow {
  usesBins: boolean;
  lines: PickListLineRow[];
  orders: { orderId: string; orderNumber: string; position: number; customerName: string | null }[];
}

// ─── Generate ──────────────────────────────────────────────────────────────────

interface PickableLine {
  orderId: string;
  orderNumber: string;
  orderItemId: string;
  variantId: string | null;
  sku: string;
  name: string;
  /** quantity − quantityFulfilled. */
  outstanding: number;
}

/**
 * Build a walk from a set of orders.
 *
 * Refuses more than it accepts, on purpose. A pick list that quietly leaves
 * something out is worse than one that will not generate: the picker completes it,
 * the order ships short, and nobody finds out until the customer does.
 */
export async function generatePickList(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<PickListDetail> {
  const input = GeneratePickListInput.parse(rawInput);

  const created = await withTenant(ctx, async (tx) => {
    const orders = await loadPickableOrders(tx, ctx.tenantId, input.orderIds);
    const warehouseId = await resolveWarehouse(tx, ctx.tenantId, input.orderIds, input.warehouseId);

    const warehouse = await tx.warehouse.findFirst({
      where: { id: warehouseId, tenantId: ctx.tenantId },
      select: { id: true, name: true, usesBins: true, allocationStrategy: true },
    });
    if (!warehouse) throw new InventoryNotFoundError('Warehouse', warehouseId);

    const strategy: PickStrategy = input.strategy ?? toPickStrategy(warehouse.allocationStrategy);
    const kind = input.kind ?? (input.orderIds.length > 1 ? 'batch' : 'single');

    // Units of each order line already spoken for by a walk that is still open.
    // Without this, generating a list twice sends two people for the same unit
    // and the second one finds an empty shelf — a short pick the system caused.
    const claimed = await claimedUnits(
      tx,
      ctx.tenantId,
      orders.map((o) => o.orderItemId)
    );

    const staged: {
      line: PickableLine;
      binId: string | null;
      lotId: string | null;
      quantity: number;
      pickSequence: number;
      short: number;
    }[] = [];

    for (const line of orders) {
      const remaining = line.outstanding - (claimed.get(line.orderItemId) ?? 0);
      if (remaining <= 0) continue;

      if (!line.variantId) {
        // A free-text order line has no stock record to walk to.
        if (!input.includeUnstocked) continue;
        staged.push({
          line,
          binId: null,
          lotId: null,
          quantity: remaining,
          pickSequence: Number.MAX_SAFE_INTEGER,
          short: 0,
        });
        continue;
      }

      const { allocations, shortfall } = await allocationsForOrderLine(tx, {
        tenantId: ctx.tenantId,
        orderId: line.orderId,
        variantId: line.variantId,
        warehouseId,
        quantity: remaining,
        strategy,
        usesBins: warehouse.usesBins,
      });

      for (const allocation of allocations) {
        staged.push({
          line,
          binId: allocation.binId,
          lotId: allocation.lotId,
          quantity: allocation.quantity,
          pickSequence: allocation.pickSequence,
          short: 0,
        });
      }

      // Nothing on any shelf accounts for these. Put them on the list anyway,
      // marked short from the start: the picker needs to know they were expected,
      // and the order needs the line to exist so the shortfall is attributable.
      if (shortfall > 0) {
        staged.push({
          line,
          binId: null,
          lotId: null,
          quantity: shortfall,
          pickSequence: Number.MAX_SAFE_INTEGER,
          short: shortfall,
        });
      }
    }

    if (staged.length === 0) {
      throw new InventoryValidationError(
        'Every line on these orders is already picked, already on another walk, or has nothing left to fulfil.'
      );
    }

    // Walk order. Bin sequence first (nulls last, which MAX_SAFE_INTEGER already
    // encodes), then bin code so an unsequenced warehouse still walks its aisles
    // alphabetically rather than at random, then SKU so two lines on one shelf
    // are always in the same order on the sheet and on the screen.
    const binCodes = await binCodeMap(
      tx,
      staged.map((s) => s.binId).filter((b): b is string => b !== null)
    );
    staged.sort(
      (a, b) =>
        a.pickSequence - b.pickSequence ||
        (binCodes.get(a.binId ?? '') ?? '~').localeCompare(binCodes.get(b.binId ?? '') ?? '~') ||
        a.line.sku.localeCompare(b.line.sku)
    );

    const number = await nextPickListNumber(tx, ctx.tenantId);
    const list = await tx.pickList.create({
      data: {
        tenantId: ctx.tenantId,
        number,
        warehouseId,
        kind,
        strategy,
        status: input.assignedTo ? 'assigned' : 'draft',
        assignedTo: input.assignedTo ?? null,
        assignedAt: input.assignedTo ? new Date() : null,
        note: input.note ?? null,
        createdBy: ctx.userId ?? null,
      },
      select: { id: true },
    });

    const orderIdsOnList = [...new Set(staged.map((s) => s.line.orderId))];
    await tx.pickListOrder.createMany({
      data: orderIdsOnList.map((orderId, index) => ({
        tenantId: ctx.tenantId,
        pickListId: list.id,
        orderId,
        position: index + 1,
      })),
    });

    await tx.pickListLine.createMany({
      data: staged.map((s, index) => ({
        tenantId: ctx.tenantId,
        pickListId: list.id,
        orderId: s.line.orderId,
        orderItemId: s.line.orderItemId,
        // A staged line reaches here only with a variant: the `includeUnstocked`
        // branch above pushes free-text lines and this map is not reached for
        // them. The assertion is the compiler's, not a runtime claim.
        variantId: s.line.variantId!,
        binId: s.binId,
        lotId: s.lotId,
        quantity: s.quantity,
        shortQuantity: s.short,
        shortReason: s.short > 0 ? 'not_found' : null,
        shortNote:
          s.short > 0 ? 'No shelf in this location is recorded as holding this item.' : null,
        status: s.short > 0 ? 'short' : 'pending',
        pickSequence: index + 1,
      })),
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.pick_list.generated',
      entityType: 'PickList',
      entityId: list.id,
      diff: {
        after: {
          number,
          kind,
          strategy,
          orders: orderIdsOnList.length,
          lines: staged.length,
        },
      },
    });

    return { id: list.id, number, kind, orders: orderIdsOnList.length, lines: staged.length };
  });

  await publishInventoryEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'inventory.pick_list.created',
    data: {
      pickListId: created.id,
      number: created.number,
      kind: created.kind,
      orders: created.orders,
      lines: created.lines,
    },
  });

  return getPickList(ctx, created.id);
}

/**
 * The order lines a walk could cover.
 *
 * Cancelled and refunded orders are excluded — walking to fetch something nobody
 * is going to be sent is pure waste, and the picker has no way to know.
 */
async function loadPickableOrders(
  tx: TxClient,
  tenantId: string,
  orderIds: string[]
): Promise<PickableLine[]> {
  const orders = await tx.order.findMany({
    where: { id: { in: orderIds }, tenantId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      items: {
        select: {
          id: true,
          variantId: true,
          sku: true,
          name: true,
          quantity: true,
          quantityFulfilled: true,
        },
      },
    },
  });

  const found = new Set(orders.map((o) => o.id));
  const missing = orderIds.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new InventoryNotFoundError('Order', missing[0]!);
  }

  const unpickable = orders.filter((o) => o.status === 'cancelled' || o.status === 'refunded');
  if (unpickable.length > 0) {
    throw new InventoryValidationError(
      `Order ${unpickable[0]?.orderNumber} is ${unpickable[0]?.status} and must not be picked.`
    );
  }

  const lines: PickableLine[] = [];
  for (const order of orders) {
    for (const item of order.items) {
      const outstanding = item.quantity - item.quantityFulfilled;
      if (outstanding <= 0) continue;
      lines.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderItemId: item.id,
        variantId: item.variantId,
        sku: item.sku,
        name: item.name,
        outstanding,
      });
    }
  }
  return lines;
}

/**
 * Which location the walk is in.
 *
 * Taken from where the sale actually came from, not from a default — the units
 * left a specific building and that is the building they are in. An explicit
 * choice wins; a set of orders whose stock came off two locations is REFUSED
 * rather than silently split, because a picker handed half a walk finishes it and
 * reports done.
 */
async function resolveWarehouse(
  tx: TxClient,
  tenantId: string,
  orderIds: string[],
  requested: string | undefined
): Promise<string> {
  if (requested) return requested;

  const rows = await tx.$queryRaw<{ warehouseId: string; name: string; units: number }[]>`
    SELECT m.warehouse_id      AS "warehouseId",
           w.name              AS "name",
           SUM(-m.delta)::int  AS "units"
      FROM inventory_movements m
      JOIN inventory_warehouses w ON w.id = m.warehouse_id
     WHERE m.tenant_id      = ${tenantId}::uuid
       AND m.reason         = 'sale'
       AND m.reference_type = 'Order'
       AND m.reference_id   = ANY(${orderIds}::uuid[])
     GROUP BY m.warehouse_id, w.name
     ORDER BY SUM(-m.delta) DESC
  `;

  if (rows.length > 1) {
    const names = rows.map((r) => r.name).join(' and ');
    throw new InventoryValidationError(
      `These orders were filled from more than one location (${names}). Generate one walk per location, or name the location explicitly.`
    );
  }
  if (rows[0]) return rows[0].warehouseId;

  // No sale movements at all — the inventory module was off when the order was
  // placed, or it was imported. Fall back to the first active location; there is
  // nothing better to go on and refusing would leave the order unpickable.
  const fallback = await tx.warehouse.findFirst({
    where: { tenantId, isActive: true, isSystem: false, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!fallback) {
    throw new InventoryValidationError(
      'There are no active locations to pick from. Add a location first.'
    );
  }
  return fallback.id;
}

/** Units of each order item already on a walk that has not finished. */
async function claimedUnits(
  tx: TxClient,
  tenantId: string,
  orderItemIds: string[]
): Promise<Map<string, number>> {
  if (orderItemIds.length === 0) return new Map();
  const rows = await tx.$queryRaw<{ orderItemId: string; units: number }[]>`
    SELECT l.order_item_id AS "orderItemId",
           SUM(l.quantity - l.short_quantity)::int AS "units"
      FROM inventory_pick_list_lines l
      JOIN inventory_pick_lists pl ON pl.id = l.pick_list_id
     WHERE l.tenant_id = ${tenantId}::uuid
       AND l.order_item_id = ANY(${orderItemIds}::uuid[])
       AND pl.status <> 'cancelled'
       AND l.status <> 'short'
     GROUP BY l.order_item_id
  `;
  return new Map(rows.map((r) => [r.orderItemId, r.units]));
}

async function binCodeMap(tx: TxClient, binIds: string[]): Promise<Map<string, string>> {
  if (binIds.length === 0) return new Map();
  const bins = await tx.inventoryBin.findMany({
    where: { id: { in: [...new Set(binIds)] } },
    select: { id: true, code: true },
  });
  return new Map(bins.map((b) => [b.id, b.code]));
}

export async function nextPickListNumber(tx: TxClient, tenantId: string): Promise<string> {
  const count = await tx.pickList.count({ where: { tenantId } });
  return `PICK-${(count + 1).toString().padStart(6, '0')}`;
}

// ─── Read ──────────────────────────────────────────────────────────────────────

export async function listPickLists(
  ctx: ServiceContext,
  rawQuery: unknown = {}
): Promise<{ items: PickListRow[]; total: number }> {
  const query = ListPickListsQuery.parse(rawQuery ?? {});
  const take = query.take ?? 50;
  const skip = query.skip ?? 0;
  const search = query.search ? `%${query.search}%` : null;

  return withTenant(ctx, async (tx) => {
    const rows = await tx.$queryRaw<RawHeader[]>`
      SELECT pl.id                                   AS "id",
             pl.number                               AS "number",
             pl.kind                                 AS "kind",
             pl.status                               AS "status",
             pl.strategy                             AS "strategy",
             pl.warehouse_id                         AS "warehouseId",
             w.name                                  AS "warehouseName",
             pl.assigned_to                          AS "assignedTo",
             COALESCE(o.order_count, 0)::int         AS "orderCount",
             COALESCE(o.order_numbers, ARRAY[]::text[]) AS "orderNumbers",
             COALESCE(l.line_count, 0)::int          AS "lineCount",
             COALESCE(l.pending_count, 0)::int       AS "pendingCount",
             COALESCE(l.short_count, 0)::int         AS "shortCount",
             COALESCE(l.units_requested, 0)::int     AS "unitsRequested",
             COALESCE(l.units_picked, 0)::int        AS "unitsPicked",
             pl.note                                 AS "note",
             pl.assigned_at                          AS "assignedAt",
             pl.started_at                           AS "startedAt",
             pl.picked_at                            AS "pickedAt",
             pl.created_at                           AS "createdAt"
        FROM inventory_pick_lists pl
        JOIN inventory_warehouses w ON w.id = pl.warehouse_id
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS order_count,
                 ARRAY_AGG(ord.order_number ORDER BY plo.position) AS order_numbers
            FROM inventory_pick_list_orders plo
            JOIN orders ord ON ord.id = plo.order_id
           WHERE plo.pick_list_id = pl.id
        ) o ON TRUE
        LEFT JOIN LATERAL (
          SELECT COUNT(*)                                                AS line_count,
                 COUNT(*) FILTER (WHERE ln.status IN ('pending','skipped')) AS pending_count,
                 COUNT(*) FILTER (WHERE ln.status = 'short')             AS short_count,
                 SUM(ln.quantity)                                        AS units_requested,
                 SUM(ln.picked_quantity)                                 AS units_picked
            FROM inventory_pick_list_lines ln
           WHERE ln.pick_list_id = pl.id
        ) l ON TRUE
       WHERE pl.tenant_id = ${ctx.tenantId}::uuid
         AND (${query.status ?? null}::text IS NULL OR pl.status = ${query.status ?? null})
         AND (${query.kind ?? null}::text IS NULL OR pl.kind = ${query.kind ?? null})
         AND (${query.warehouseId ?? null}::uuid IS NULL OR pl.warehouse_id = ${query.warehouseId ?? null}::uuid)
         AND (${query.assignedTo ?? null}::text IS NULL OR pl.assigned_to = ${query.assignedTo ?? null})
         AND (${query.orderId ?? null}::uuid IS NULL OR EXISTS (
               SELECT 1 FROM inventory_pick_list_orders x
                WHERE x.pick_list_id = pl.id AND x.order_id = ${query.orderId ?? null}::uuid))
         AND (${search}::text IS NULL OR pl.number ILIKE ${search} OR EXISTS (
               SELECT 1 FROM inventory_pick_list_orders x
                 JOIN orders xo ON xo.id = x.order_id
                WHERE x.pick_list_id = pl.id AND xo.order_number ILIKE ${search}))
       ORDER BY pl.created_at DESC
       LIMIT ${take} OFFSET ${skip}
    `;

    const totals = await tx.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*)::int AS total
        FROM inventory_pick_lists pl
       WHERE pl.tenant_id = ${ctx.tenantId}::uuid
         AND (${query.status ?? null}::text IS NULL OR pl.status = ${query.status ?? null})
         AND (${query.kind ?? null}::text IS NULL OR pl.kind = ${query.kind ?? null})
         AND (${query.warehouseId ?? null}::uuid IS NULL OR pl.warehouse_id = ${query.warehouseId ?? null}::uuid)
         AND (${query.assignedTo ?? null}::text IS NULL OR pl.assigned_to = ${query.assignedTo ?? null})
         AND (${query.orderId ?? null}::uuid IS NULL OR EXISTS (
               SELECT 1 FROM inventory_pick_list_orders x
                WHERE x.pick_list_id = pl.id AND x.order_id = ${query.orderId ?? null}::uuid))
         AND (${search}::text IS NULL OR pl.number ILIKE ${search} OR EXISTS (
               SELECT 1 FROM inventory_pick_list_orders x
                 JOIN orders xo ON xo.id = x.order_id
                WHERE x.pick_list_id = pl.id AND xo.order_number ILIKE ${search}))
    `;

    return { items: rows.map(serializeRow), total: totals[0]?.total ?? 0 };
  });
}

export async function getPickList(
  ctx: ServiceContext,
  pickListId: string
): Promise<PickListDetail> {
  return withTenant(ctx, (tx) => loadPickListDetail(tx, ctx.tenantId, pickListId));
}

export async function loadPickListDetail(
  tx: TxClient,
  tenantId: string,
  pickListId: string
): Promise<PickListDetail> {
  const headers = await tx.$queryRaw<RawHeader[]>`
    SELECT pl.id                                   AS "id",
           pl.number                               AS "number",
           pl.kind                                 AS "kind",
           pl.status                               AS "status",
           pl.strategy                             AS "strategy",
           pl.warehouse_id                         AS "warehouseId",
           w.name                                  AS "warehouseName",
           pl.assigned_to                          AS "assignedTo",
           COALESCE(o.order_count, 0)::int         AS "orderCount",
           COALESCE(o.order_numbers, ARRAY[]::text[]) AS "orderNumbers",
           COALESCE(l.line_count, 0)::int          AS "lineCount",
           COALESCE(l.pending_count, 0)::int       AS "pendingCount",
           COALESCE(l.short_count, 0)::int         AS "shortCount",
           COALESCE(l.units_requested, 0)::int     AS "unitsRequested",
           COALESCE(l.units_picked, 0)::int        AS "unitsPicked",
           pl.note                                 AS "note",
           pl.assigned_at                          AS "assignedAt",
           pl.started_at                           AS "startedAt",
           pl.picked_at                            AS "pickedAt",
           pl.created_at                           AS "createdAt"
      FROM inventory_pick_lists pl
      JOIN inventory_warehouses w ON w.id = pl.warehouse_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS order_count,
               ARRAY_AGG(ord.order_number ORDER BY plo.position) AS order_numbers
          FROM inventory_pick_list_orders plo
          JOIN orders ord ON ord.id = plo.order_id
         WHERE plo.pick_list_id = pl.id
      ) o ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)                                                AS line_count,
               COUNT(*) FILTER (WHERE ln.status IN ('pending','skipped')) AS pending_count,
               COUNT(*) FILTER (WHERE ln.status = 'short')             AS short_count,
               SUM(ln.quantity)                                        AS units_requested,
               SUM(ln.picked_quantity)                                 AS units_picked
          FROM inventory_pick_list_lines ln
         WHERE ln.pick_list_id = pl.id
      ) l ON TRUE
     WHERE pl.tenant_id = ${tenantId}::uuid
       AND pl.id = ${pickListId}::uuid
  `;
  const header = headers[0];
  if (!header) throw new InventoryNotFoundError('PickList', pickListId);

  const warehouse = await tx.warehouse.findFirst({
    where: { id: header.warehouseId },
    select: { usesBins: true },
  });

  const lines = await tx.$queryRaw<
    (Omit<PickListLineRow, 'pickedAt' | 'lotExpiresAt'> & {
      pickedAt: Date | null;
      lotExpiresAt: Date | null;
    })[]
  >`
    SELECT ln.id                AS "id",
           ln.order_id          AS "orderId",
           ord.order_number     AS "orderNumber",
           ln.order_item_id     AS "orderItemId",
           ln.variant_id        AS "variantId",
           v.sku                AS "sku",
           p.title              AS "productTitle",
           v.title              AS "variantTitle",
           (SELECT bc.value FROM commerce_variant_barcodes bc
             WHERE bc.tenant_id = ln.tenant_id AND bc.variant_id = ln.variant_id
               AND bc.is_primary = true AND bc.is_active = true
             LIMIT 1)           AS "primaryBarcode",
           ln.bin_id            AS "binId",
           b.code               AS "binCode",
           b.zone               AS "binZone",
           ln.lot_id            AS "lotId",
           lot.lot_number       AS "lotNumber",
           lot.expires_at       AS "lotExpiresAt",
           ln.quantity          AS "quantity",
           ln.picked_quantity   AS "pickedQuantity",
           ln.short_quantity    AS "shortQuantity",
           ln.short_reason      AS "shortReason",
           ln.short_note        AS "shortNote",
           ln.short_count_id    AS "shortCountId",
           ln.pick_sequence     AS "pickSequence",
           ln.status            AS "status",
           ln.verified_by_scan  AS "verifiedByScan",
           ln.picked_at         AS "pickedAt",
           ln.picked_by         AS "pickedBy"
      FROM inventory_pick_list_lines ln
      JOIN orders ord                    ON ord.id = ln.order_id
      JOIN commerce_product_variants v   ON v.id = ln.variant_id
      JOIN commerce_products p           ON p.id = v.product_id
      LEFT JOIN inventory_bins b         ON b.id = ln.bin_id
      LEFT JOIN inventory_lot_batches lot ON lot.id = ln.lot_id
     WHERE ln.tenant_id = ${tenantId}::uuid
       AND ln.pick_list_id = ${pickListId}::uuid
     ORDER BY ln.pick_sequence ASC
  `;

  const orders = await tx.$queryRaw<
    { orderId: string; orderNumber: string; position: number; customerName: string | null }[]
  >`
    SELECT plo.order_id     AS "orderId",
           ord.order_number AS "orderNumber",
           plo.position     AS "position",
           NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), '') AS "customerName"
      FROM inventory_pick_list_orders plo
      JOIN orders ord      ON ord.id = plo.order_id
      LEFT JOIN customers c ON c.id = ord.customer_id
     WHERE plo.tenant_id = ${tenantId}::uuid
       AND plo.pick_list_id = ${pickListId}::uuid
     ORDER BY plo.position ASC
  `;

  return {
    ...serializeRow(header),
    usesBins: warehouse?.usesBins ?? false,
    lines: lines.map((l) => ({
      ...l,
      pickedAt: l.pickedAt?.toISOString() ?? null,
      lotExpiresAt: l.lotExpiresAt?.toISOString() ?? null,
    })),
    orders,
  };
}

type RawHeader = Omit<PickListRow, 'assignedAt' | 'startedAt' | 'pickedAt' | 'createdAt'> & {
  assignedAt: Date | null;
  startedAt: Date | null;
  pickedAt: Date | null;
  createdAt: Date;
};

function serializeRow(row: RawHeader): PickListRow {
  return {
    ...row,
    assignedAt: row.assignedAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    pickedAt: row.pickedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
