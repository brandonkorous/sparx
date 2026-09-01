// Inventory levels — the (variant, warehouse) stock snapshot — plus the
// reorder policy and the low-stock report. onHand is authoritative and only
// ever changes through the movement ledger (see ./ledger); this module owns
// the read paths + the non-stock fields (reorder policy, cost basis surfacing).

import { SetReorderPolicyInput, SetSafetyBufferInput } from '@wizeworks/commerce-schemas';
import { Prisma, withTenant } from '@wizeworks/db';
import type { TxClient } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { publishInventoryEvent } from '../events';
import type { ServiceContext } from '../errors';

import { ensureVariantExists, ensureWarehouseActive, syncProductInStock } from './internal';
import { LOW_STOCK_SQL, SELLABLE_SQL } from './low-stock';

export interface InventoryLevelRow {
  variantId: string;
  warehouseId: string;
  warehouseCode: string;
  onHand: number;
  allocated: number;
  available: number;
  reorderPoint: number | null;
  reorderQuantity: number | null;
  leadTimeDays: number | null;
  unitCostCents: number | null;
  avgCostCents: number | null;
  updatedAt: string;
}

export async function getLevel(
  ctx: ServiceContext,
  variantId: string,
  warehouseId: string
): Promise<InventoryLevelRow | null> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.inventoryLevel.findUnique({
      where: { variantId_warehouseId: { variantId, warehouseId } },
      include: { warehouse: { select: { code: true } } },
    });
    return row ? serializeLevel(row) : null;
  });
}

export async function levelsForVariant(
  ctx: ServiceContext,
  variantId: string
): Promise<InventoryLevelRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.inventoryLevel.findMany({
      where: { variantId },
      include: { warehouse: { select: { code: true, isActive: true } } },
      orderBy: { warehouse: { code: 'asc' } },
    });
    return rows.map(serializeLevel);
  });
}

export async function levelsForWarehouse(
  ctx: ServiceContext,
  warehouseId: string,
  filter: { lowStockOnly?: boolean; take?: number; skip?: number } = {}
): Promise<{ items: InventoryLevelRow[]; total: number }> {
  const take = Math.min(filter.take ?? 100, 500);
  const skip = filter.skip ?? 0;

  return withTenant(ctx, async (tx) => {
    if (!filter.lowStockOnly) {
      const where: Prisma.InventoryLevelWhereInput = { warehouseId };
      const [rows, total] = await Promise.all([
        tx.inventoryLevel.findMany({
          where,
          include: { warehouse: { select: { code: true } } },
          orderBy: { onHand: 'asc' },
          take,
          skip,
        }),
        tx.inventoryLevel.count({ where }),
      ]);
      return { items: rows.map(serializeLevel), total };
    }

    // Low-stock is sellable-vs-reorder-point (the ONE definition in
    // ./low-stock) — an expression over three columns Prisma's typed `where`
    // can't filter on. Select the matching variant ids in raw SQL, then hydrate
    // that page through Prisma so the row shape stays a typed select. Explicit
    // tenant scope: the local superuser bypasses RLS, and this is a broad scan.
    const scope = Prisma.sql`l.warehouse_id = ${warehouseId}::uuid AND l.tenant_id = ${ctx.tenantId}::uuid AND ${LOW_STOCK_SQL}`;
    const [keys, counted] = await Promise.all([
      tx.$queryRaw<{ variantId: string }[]>`
        SELECT l.variant_id AS "variantId"
        FROM inventory_levels l
        WHERE ${scope}
        ORDER BY ${SELLABLE_SQL} ASC, l.variant_id ASC
        LIMIT ${take} OFFSET ${skip}
      `,
      tx.$queryRaw<{ total: bigint }[]>`
        SELECT COUNT(*)::bigint AS total FROM inventory_levels l WHERE ${scope}
      `,
    ]);

    const total = Number(counted[0]?.total ?? 0);
    if (keys.length === 0) return { items: [], total };

    const rows = await tx.inventoryLevel.findMany({
      where: { warehouseId, variantId: { in: keys.map((k) => k.variantId) } },
      include: { warehouse: { select: { code: true } } },
    });
    // Re-order to the key query's order — `findMany` with an `in` set makes no
    // promise about row order, so hydrating would otherwise discard the sort.
    const byId = new Map(rows.map((r) => [r.variantId, r]));
    const items = keys.flatMap((k) => {
      const r = byId.get(k.variantId);
      return r ? [serializeLevel(r)] : [];
    });
    return { items, total };
  });
}

export async function setReorderPolicy(ctx: ServiceContext, rawInput: unknown): Promise<void> {
  const input = SetReorderPolicyInput.parse(rawInput);
  const level = await withTenant(ctx, async (tx) => {
    await ensureWarehouseActive(tx, input.warehouseId);
    await ensureVariantExists(tx, input.variantId);

    await tx.inventoryLevel.upsert({
      where: {
        variantId_warehouseId: {
          variantId: input.variantId,
          warehouseId: input.warehouseId,
        },
      },
      create: {
        tenantId: ctx.tenantId,
        variantId: input.variantId,
        warehouseId: input.warehouseId,
        onHand: 0,
        allocated: 0,
        reorderPoint: input.reorderPoint,
        reorderQuantity: input.reorderQuantity,
        leadTimeDays: input.leadTimeDays ?? null,
      },
      update: {
        reorderPoint: input.reorderPoint,
        reorderQuantity: input.reorderQuantity,
        leadTimeDays: input.leadTimeDays ?? null,
      },
    });

    // The reorder point is HALF of `isLowStock`, so setting it can make a level
    // low without a single unit moving — and `syncProductInStock` is otherwise
    // only reached from paths where stock CHANGED. Without this the
    // denormalized `Product.lowStock` never catches up, and the shop and the
    // console disagree in silence: the console's low-stock list reads the levels
    // directly and says "1 running low", while a rule-based collection built on
    // `low_stock` matches nothing and greets shoppers with "Nothing in this
    // collection yet". Observed on a real storefront (issue 370).
    await syncProductInStock(tx, input.variantId);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.reorder_policy_set',
      entityType: 'InventoryLevel',
      // entity_id is a single UUID — key on the variant, carry the warehouse in the diff.
      entityId: input.variantId,
      diff: {
        after: {
          warehouseId: input.warehouseId,
          reorderPoint: input.reorderPoint,
          reorderQuantity: input.reorderQuantity,
          leadTimeDays: input.leadTimeDays ?? null,
        },
      },
    });

    return tx.inventoryLevel.findUnique({
      where: {
        variantId_warehouseId: {
          variantId: input.variantId,
          warehouseId: input.warehouseId,
        },
      },
      select: { onHand: true, allocated: true, reorderPoint: true },
    });
  });

  // AFTER the commit, never inside it — a rolled-back write must not emit a
  // phantom event (see ../events.ts).
  //
  // Setting a threshold your stock is already under makes an item low without
  // moving a unit, and nothing else will say so: every other `inventory.low`
  // comes off a movement. Without this the item is low in the database and
  // invisible to everything downstream — the automation that reorders it, and
  // the reprojection that puts it on a rules-driven shelf — until the next time
  // somebody happens to touch the stock. Same condition the ledger uses, so the
  // two agree about what "low" means.
  if (level && level.reorderPoint !== null) {
    const available = level.onHand - level.allocated;
    if (available <= level.reorderPoint) {
      await publishInventoryEvent({
        tenantId: ctx.tenantId,
        actorId: ctx.userId ?? null,
        topic: 'inventory.low',
        data: {
          variantId: input.variantId,
          warehouseId: input.warehouseId,
          available,
          reorderPoint: level.reorderPoint,
        },
      });
    }
  }
}

/**
 * Set the oversell safety buffer for one (variant, warehouse) level — units
 * withheld from the sellable `available` (docs/28 §5.3). Upserts the level so a
 * buffer can be set before any stock exists. Tx-aware so the sync mapping can set
 * it atomically with minting a link; the public `setSafetyBuffer` wraps it + audits.
 */
export async function setSafetyBufferOnTx(
  tx: TxClient,
  ctx: ServiceContext,
  input: { variantId: string; warehouseId: string; safetyBuffer: number }
): Promise<void> {
  await ensureWarehouseActive(tx, input.warehouseId);
  await ensureVariantExists(tx, input.variantId);

  await tx.inventoryLevel.upsert({
    where: {
      variantId_warehouseId: { variantId: input.variantId, warehouseId: input.warehouseId },
    },
    create: {
      tenantId: ctx.tenantId,
      variantId: input.variantId,
      warehouseId: input.warehouseId,
      onHand: 0,
      allocated: 0,
      safetyBuffer: input.safetyBuffer,
    },
    update: { safetyBuffer: input.safetyBuffer },
  });

  // The buffer is subtracted by BOTH `isLowStock` and `isOutOfStock`, so raising
  // it can take a product from sellable to sold out, or from fine to running
  // low, with no movement to trigger the usual resync. Here rather than in the
  // public wrapper so the sync mapping's atomic path gets it too.
  await syncProductInStock(tx, input.variantId);
}

export async function setSafetyBuffer(ctx: ServiceContext, rawInput: unknown): Promise<void> {
  const input = SetSafetyBufferInput.parse(rawInput);
  await withTenant(ctx, async (tx) => {
    await setSafetyBufferOnTx(tx, ctx, input);
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.safety_buffer_set',
      entityType: 'InventoryLevel',
      entityId: input.variantId,
      diff: { after: { warehouseId: input.warehouseId, safetyBuffer: input.safetyBuffer } },
    });
  });
}

export interface LowStockRow {
  variantId: string;
  productId: string;
  sku: string;
  title: string;
  warehouseId: string;
  warehouseCode: string;
  available: number;
  reorderPoint: number;
  reorderQuantity: number | null;
  leadTimeDays: number | null;
}

export async function listLowStock(
  ctx: ServiceContext,
  filter: { warehouseId?: string; take?: number } = {}
): Promise<LowStockRow[]> {
  return withTenant(ctx, async (tx) => {
    // "Running low" is the ONE definition in ./low-stock — sellable stock
    // (on-hand minus allocations minus buffer) at or below the reorder point.
    // A raw query so we can filter on that expression. The reported `available`
    // stays `on_hand - allocated` (physical availability), matching every other
    // endpoint; only the low-stock PREDICATE and the sort use sellable.
    const take = Math.min(filter.take ?? 100, 500);
    const warehouseFilter = filter.warehouseId ?? null;
    const rows = await tx.$queryRaw<LowStockRow[]>`
      SELECT
        l.variant_id AS "variantId",
        l.warehouse_id AS "warehouseId",
        w.code AS "warehouseCode",
        l.on_hand - l.allocated AS "available",
        l.reorder_point AS "reorderPoint",
        l.reorder_quantity AS "reorderQuantity",
        l.lead_time_days AS "leadTimeDays",
        v.sku AS "sku",
        v.product_id AS "productId",
        p.title AS "title"
      FROM inventory_levels l
      JOIN inventory_warehouses w ON w.id = l.warehouse_id
      JOIN commerce_product_variants v ON v.id = l.variant_id
      JOIN commerce_products p ON p.id = v.product_id
      WHERE l.tenant_id = ${ctx.tenantId}::uuid
        AND ${LOW_STOCK_SQL}
        AND (${warehouseFilter}::uuid IS NULL OR l.warehouse_id = ${warehouseFilter}::uuid)
        AND w.deleted_at IS NULL
        AND v.deleted_at IS NULL
        AND p.deleted_at IS NULL
      ORDER BY ${SELLABLE_SQL} ASC, l.variant_id ASC
      LIMIT ${take}
    `;
    return rows;
  });
}

interface LevelWithWarehouse {
  variantId: string;
  warehouseId: string;
  warehouse: { code: string };
  onHand: number;
  allocated: number;
  reorderPoint: number | null;
  reorderQuantity: number | null;
  leadTimeDays: number | null;
  unitCostCents: number | null;
  avgCostCents: number | null;
  updatedAt: Date;
}

export function serializeLevel(l: LevelWithWarehouse): InventoryLevelRow {
  return {
    variantId: l.variantId,
    warehouseId: l.warehouseId,
    warehouseCode: l.warehouse.code,
    onHand: l.onHand,
    allocated: l.allocated,
    available: l.onHand - l.allocated,
    reorderPoint: l.reorderPoint,
    reorderQuantity: l.reorderQuantity,
    leadTimeDays: l.leadTimeDays,
    unitCostCents: l.unitCostCents,
    avgCostCents: l.avgCostCents,
    updatedAt: l.updatedAt.toISOString(),
  };
}
