// The documented public API surface (docs/06 §7) — the headless contract
// external integrators code against, distinct from the dashboard-shaped routes.
//
//   listInventory   → GET   /v1/inventory            (cross-warehouse, enriched)
//   updateLevelCount→ PATCH /v1/inventory/:variant_id (set on-hand or delta)
//   bulkAdjust      → POST  /v1/inventory/adjustments (CSV/JSON, per-row results)
//
// Writes never touch onHand directly — they all route through `applyMovement`
// (the ledger funnel): concurrency-safe, idempotent, attributed, reconcilable.
// A bulk adjustment runs each row in its OWN transaction so one bad row can't
// roll back the rest; the per-row result carries the outcome.

import { BulkAdjustmentInput, UpdateInventoryCountInput } from '@sparx/commerce-schemas';
import type { InventoryAdjustReason } from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import type { Prisma, TxClient } from '@sparx/db';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';

import { ensureVariantExists, ensureWarehouseActive } from './internal';
import {
  applyMovement,
  emitStockEvents,
  resolveActorType,
  type ActorType,
  type MovementResult,
} from './ledger';

// ─── List (GET /v1/inventory) ─────────────────────────────────────────

export interface PublicInventoryRow {
  variantId: string;
  sku: string | null;
  productId: string;
  productTitle: string | null;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  onHand: number;
  allocated: number;
  available: number;
  reorderPoint: number | null;
  reorderQuantity: number | null;
  avgCostCents: number | null;
  updatedAt: string;
}

export interface ListInventoryFilter {
  warehouseId?: string;
  /** Case-insensitive match on variant SKU OR product title. */
  q?: string;
  /**
   * Every level for ONE product, across its variants and every warehouse.
   *
   * Exists so a product-scoped stock view is a SINGLE request. Without it the
   * only way to answer "what stock does this product have" was a request per
   * variant — an N+1 that a 40-variant product turns into 40 round trips, and
   * which the workbench's product-scoped panes would have multiplied again by
   * being dockable side by side. Filtering on `q` is not a substitute: it
   * matches product title as a SUBSTRING, so two products called "Camp Mug" and
   * "Camp Mug XL" cannot be told apart.
   */
  productId?: string;
  take?: number;
  skip?: number;
}

export async function listInventory(
  ctx: ServiceContext,
  filter: ListInventoryFilter = {}
): Promise<{ items: PublicInventoryRow[]; total: number }> {
  const take = Math.min(filter.take ?? 50, 200);
  const skip = filter.skip ?? 0;

  const variantWhere: Prisma.ProductVariantWhereInput = {
    deletedAt: null,
    ...(filter.productId ? { productId: filter.productId } : {}),
    ...(filter.q
      ? {
          OR: [
            { sku: { contains: filter.q, mode: 'insensitive' } },
            { product: { title: { contains: filter.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const where: Prisma.InventoryLevelWhereInput = {
    // Explicit tenant scope: the local superuser bypasses RLS, so a broad-scan
    // read without it leaks other tenants' levels. RLS enforces it in prod; this
    // is defense-in-depth + correct under the superuser-local test role.
    tenantId: ctx.tenantId,
    ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
    warehouse: { deletedAt: null },
    variant: variantWhere,
  };

  return withTenant(ctx, async (tx) => {
    const [rows, total] = await Promise.all([
      tx.inventoryLevel.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        take,
        skip,
        select: {
          variantId: true,
          warehouseId: true,
          onHand: true,
          allocated: true,
          reorderPoint: true,
          reorderQuantity: true,
          avgCostCents: true,
          updatedAt: true,
          warehouse: { select: { code: true, name: true } },
          variant: {
            select: { sku: true, product: { select: { id: true, title: true } } },
          },
        },
      }),
      tx.inventoryLevel.count({ where }),
    ]);

    const items = rows.map((r) => ({
      variantId: r.variantId,
      sku: r.variant.sku,
      productId: r.variant.product.id,
      productTitle: r.variant.product.title,
      warehouseId: r.warehouseId,
      warehouseCode: r.warehouse.code,
      warehouseName: r.warehouse.name,
      onHand: r.onHand,
      allocated: r.allocated,
      available: r.onHand - r.allocated,
      reorderPoint: r.reorderPoint,
      reorderQuantity: r.reorderQuantity,
      avgCostCents: r.avgCostCents,
      updatedAt: r.updatedAt.toISOString(),
    }));
    return { items, total };
  });
}

// ─── Count update (PATCH) + bulk adjustment (POST) ────────────────────

interface LevelChange {
  variantId: string;
  warehouseId: string;
  /** Absolute on-hand target (reconciled to a corrective delta under the lock). */
  onHand?: number;
  /** Signed change to on-hand. Exactly one of onHand/delta is set. */
  delta?: number;
  reason: InventoryAdjustReason;
  note?: string | null;
  actorType: ActorType;
  idempotencyKey?: string | null;
}

/** Apply one level change through the ledger inside the caller's tx + audit it. */
async function applyLevelChangeOnTx(
  tx: TxClient,
  ctx: ServiceContext,
  change: LevelChange
): Promise<MovementResult> {
  await ensureWarehouseActive(tx, change.warehouseId);
  await ensureVariantExists(tx, change.variantId);

  const r = await applyMovement(tx, {
    tenantId: ctx.tenantId,
    variantId: change.variantId,
    warehouseId: change.warehouseId,
    delta: change.delta ?? 0,
    ...(change.onHand !== undefined ? { setOnHand: change.onHand } : {}),
    reason: change.reason,
    note: change.note ?? null,
    actorType: change.actorType,
    actorId: ctx.userId ?? null,
    idempotencyKey: change.idempotencyKey ?? null,
  });

  if (!r.deduped) {
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.adjusted',
      entityType: 'InventoryLevel',
      entityId: change.variantId,
      diff: {
        before: { onHand: r.onHand - r.appliedDelta },
        after: { onHand: r.onHand, allocated: r.allocated, warehouseId: change.warehouseId },
      },
    });
  }
  return r;
}

export interface LevelCountResult {
  variantId: string;
  warehouseId: string;
  onHand: number;
  available: number;
  appliedDelta: number;
  deduped: boolean;
}

/** PATCH /v1/inventory/:variant_id — set an absolute on-hand or apply a delta. */
export async function updateLevelCount(
  ctx: ServiceContext,
  variantId: string,
  rawInput: unknown
): Promise<LevelCountResult> {
  const input = UpdateInventoryCountInput.parse(rawInput);

  const result = await withTenant(ctx, (tx) =>
    applyLevelChangeOnTx(tx, ctx, {
      variantId,
      warehouseId: input.warehouseId,
      ...(input.onHand !== undefined ? { onHand: input.onHand } : {}),
      ...(input.delta !== undefined ? { delta: input.delta } : {}),
      reason: input.reason,
      note: input.note ?? null,
      actorType: resolveActorType(ctx),
      idempotencyKey: input.idempotencyKey ?? null,
    })
  );

  if (!result.deduped) {
    await emitStockEvents(
      ctx,
      variantId,
      input.warehouseId,
      result,
      result.appliedDelta,
      input.reason
    );
  }

  return {
    variantId,
    warehouseId: input.warehouseId,
    onHand: result.onHand,
    available: result.available,
    appliedDelta: result.appliedDelta,
    deduped: result.deduped,
  };
}

export interface BulkAdjustResultRow {
  index: number;
  sku: string | null;
  variantId: string | null;
  warehouseId: string;
  status: 'applied' | 'skipped' | 'error';
  onHand?: number;
  available?: number;
  appliedDelta?: number;
  error?: string;
}

export interface BulkAdjustResult {
  applied: number;
  skipped: number;
  failed: number;
  results: BulkAdjustResultRow[];
}

/**
 * POST /v1/inventory/adjustments — apply many level changes. Each row resolves a
 * variant by `sku` (batch-resolved up front) or `variantId`, then runs in its
 * own transaction so one failure can't roll back the batch. The per-row result
 * reports applied / skipped (idempotent no-op) / error with the reason.
 */
export async function bulkAdjust(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<BulkAdjustResult> {
  const input = BulkAdjustmentInput.parse(rawInput);

  // One query resolves every distinct SKU → variant id.
  const skus = [...new Set(input.adjustments.flatMap((r) => (r.sku ? [r.sku] : [])))];
  const bySku = new Map<string, string>();
  if (skus.length > 0) {
    const variants = await withTenant(ctx, (tx) =>
      tx.productVariant.findMany({
        // Explicit tenant scope — the superuser-local role bypasses RLS, and a
        // SKU can collide across tenants; never resolve to another tenant's variant.
        where: { tenantId: ctx.tenantId, sku: { in: skus }, deletedAt: null },
        select: { id: true, sku: true },
      })
    );
    for (const v of variants) if (v.sku) bySku.set(v.sku, v.id);
  }

  const results: BulkAdjustResultRow[] = [];
  let applied = 0;
  let skipped = 0;
  let failed = 0;

  for (const [i, row] of input.adjustments.entries()) {
    const variantId = row.variantId ?? (row.sku ? bySku.get(row.sku) : undefined);
    if (!variantId) {
      failed++;
      results.push({
        index: i,
        sku: row.sku ?? null,
        variantId: null,
        warehouseId: row.warehouseId,
        status: 'error',
        error: `No active variant found for sku "${row.sku ?? ''}".`,
      });
      continue;
    }

    try {
      const r = await withTenant(ctx, (tx) =>
        applyLevelChangeOnTx(tx, ctx, {
          variantId,
          warehouseId: row.warehouseId,
          ...(row.onHand !== undefined ? { onHand: row.onHand } : {}),
          ...(row.delta !== undefined ? { delta: row.delta } : {}),
          reason: row.reason,
          note: row.note ?? null,
          actorType: resolveActorType(ctx),
        })
      );
      if (!r.deduped) {
        await emitStockEvents(ctx, variantId, row.warehouseId, r, r.appliedDelta, row.reason);
        applied++;
      } else {
        skipped++;
      }
      results.push({
        index: i,
        sku: row.sku ?? null,
        variantId,
        warehouseId: row.warehouseId,
        status: r.deduped ? 'skipped' : 'applied',
        onHand: r.onHand,
        available: r.available,
        appliedDelta: r.appliedDelta,
      });
    } catch (err) {
      failed++;
      results.push({
        index: i,
        sku: row.sku ?? null,
        variantId,
        warehouseId: row.warehouseId,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { applied, skipped, failed, results };
}
