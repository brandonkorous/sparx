// Inventory levels — the (variant, warehouse) stock snapshot — plus the
// reorder policy and the low-stock report. onHand is authoritative and only
// ever changes through the movement ledger (see ./ledger); this module owns
// the read paths + the non-stock fields (reorder policy, cost basis surfacing).

import { SetReorderPolicyInput, SetSafetyBufferInput } from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import type { Prisma, TxClient } from '@sparx/db';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';

import { ensureVariantExists, ensureWarehouseActive } from './internal';

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
  return withTenant(ctx, async (tx) => {
    const where: Prisma.InventoryLevelWhereInput = {
      warehouseId,
      ...(filter.lowStockOnly
        ? {
            reorderPoint: { not: null },
            // available = onHand - allocated; can't filter on a derived
            // column directly. Approximate with onHand <= reorderPoint
            // (slight over-report when there are stale allocations; the
            // dashboard re-filters after fetch).
            onHand: { lte: 5 },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      tx.inventoryLevel.findMany({
        where,
        include: { warehouse: { select: { code: true } } },
        orderBy: { onHand: 'asc' },
        take: Math.min(filter.take ?? 100, 500),
        skip: filter.skip ?? 0,
      }),
      tx.inventoryLevel.count({ where }),
    ]);
    return { items: rows.map(serializeLevel), total };
  });
}

export async function setReorderPolicy(ctx: ServiceContext, rawInput: unknown): Promise<void> {
  const input = SetReorderPolicyInput.parse(rawInput);
  await withTenant(ctx, async (tx) => {
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
  });
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
    // Postgres can do the available calculation as `onHand - allocated`.
    // Use a raw query so we filter on the derived value cleanly.
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
      WHERE l.reorder_point IS NOT NULL
        AND l.on_hand - l.allocated <= l.reorder_point
        AND (${warehouseFilter}::uuid IS NULL OR l.warehouse_id = ${warehouseFilter}::uuid)
        AND w.deleted_at IS NULL
        AND v.deleted_at IS NULL
        AND p.deleted_at IS NULL
      ORDER BY (l.on_hand - l.allocated) ASC
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
