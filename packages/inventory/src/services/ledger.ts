// The movement ledger — the ONLY writer of `InventoryLevel.onHand`.
//
// Every onHand change (sale, manual adjust, transfer leg, receipt, sync
// reconcile, ...) funnels through `applyMovement()`. That funnel is what makes
// the product safe for the many concurrent writers — checkout, dashboard users,
// MCP/AI, ERP/WMS sync, returns, the reaper (docs/100 §2.5):
//
//   • Concurrency-safe — the level row is locked `FOR UPDATE` before the new
//     on-hand is computed, so a simultaneous sale + sync delta + manual adjust
//     can't lose an update or oversell the last unit.
//   • Idempotent — a movement may carry an `idempotencyKey`; a redelivered event
//     / integration retry / double-click applies exactly once.
//   • Attributed — every row records actorType/actorId (+ source) so the audit
//     trail answers who moved stock, when, why, and by how much.
//   • Reconcilable — `onHand == Σ(delta)` always holds; `balanceAfter` carries
//     the running on-hand for cheap point-in-time audit.
//
// `applyMovement` runs INSIDE the caller's `withTenant` transaction (it takes a
// `tx`); event emission is post-commit via `emitStockEvents`, which the public
// service functions call after the transaction returns.

import type { TxClient } from '@sparx/db';

import { InventoryValidationError } from '../errors';
import type { ServiceContext } from '../errors';
import { publishInventoryEvent } from '../events';

import { syncProductInStock } from './internal';

export type ActorType = 'user' | 'ai' | 'system' | 'integration';

export interface MovementInput {
  tenantId: string;
  variantId: string;
  warehouseId: string;
  /** Signed change to onHand. Ignored when `setOnHand` is provided. */
  delta: number;
  /**
   * Absolute on-hand target — when set, the effective delta is computed
   * `setOnHand − lockedOnHand` INSIDE the row lock, so an external feed's
   * "this SKU is now N units" reconciles to a corrective movement that can't
   * race a concurrent sale. Used by the sync reconcile path; leave undefined
   * for ordinary signed-delta movements.
   */
  setOnHand?: number;
  reason: string;
  referenceType?: string | null;
  referenceId?: string | null;
  note?: string | null;
  /** Per-unit cost of inbound units — feeds the moving-average basis (delta > 0). */
  unitCostCents?: number | null;
  actorType: ActorType;
  actorId?: string | null;
  source?: string | null;
  /** Idempotency guard — a duplicate key on the same level is a no-op. */
  idempotencyKey?: string | null;
  /** Reservation bookkeeping applied to `allocated` in the same locked write. */
  allocatedDelta?: number;
  /** Permit onHand < 0 (a committed sale under a continue/preorder policy). */
  allowNegative?: boolean;
}

export interface MovementResult {
  /** The appended movement's id, the existing one when deduped, or '' on a no-op. */
  movementId: string;
  /** True when no row was appended — an idempotency hit or a zero-delta no-op. */
  deduped: boolean;
  /** The signed change actually applied to onHand (0 when deduped / no-op). */
  appliedDelta: number;
  onHand: number;
  allocated: number;
  available: number;
  avgCostCents: number | null;
  reorderPoint: number | null;
}

interface LockedLevel {
  on_hand: number;
  allocated: number;
  avg_cost_cents: number | null;
  reorder_point: number | null;
}

/** Resolve the movement actor: an explicit override wins, else derive from ctx. */
export function resolveActorType(ctx: ServiceContext, override?: ActorType): ActorType {
  if (override) return override;
  return ctx.userId ? 'user' : 'system';
}

/**
 * Moving-average cost basis. Only a costed inbound movement (delta > 0 with a
 * unit cost) moves the basis; the first costed units set it outright.
 * `new_avg = (onHand·old + qtyIn·costIn) / (onHand + qtyIn)`.
 */
export function nextAvgCost(
  oldOnHand: number,
  oldAvg: number | null,
  delta: number,
  costIn: number | null
): number | null {
  if (delta <= 0 || costIn === null) return oldAvg;
  const baseQty = Math.max(0, oldOnHand);
  if (baseQty === 0) return costIn;
  const baseAvg = oldAvg ?? costIn;
  return Math.round((baseQty * baseAvg + delta * costIn) / (baseQty + delta));
}

/**
 * Apply one stock movement: lock the level, (optionally) dedupe, write the new
 * on-hand + allocated + moving-average, and append the ledger row. Returns the
 * post-movement snapshot the caller needs for events. MUST run inside a
 * tenant-scoped transaction.
 */
export async function applyMovement(tx: TxClient, input: MovementInput): Promise<MovementResult> {
  const allocatedDelta = input.allocatedDelta ?? 0;

  // 1. Ensure the level row exists so there is something to lock. This must be
  //    ATOMIC: Prisma's upsert is SELECT-then-INSERT, so a concurrent burst of
  //    FIRST movements on a brand-new (variant, warehouse) all see "no row" and
  //    collide on the PK. `INSERT … ON CONFLICT DO NOTHING` lets exactly one
  //    writer insert and the rest no-op, after which they all serialize on the
  //    FOR UPDATE lock below — keeping the concurrency guarantee true even for
  //    the very first movement.
  await tx.$executeRaw`
    INSERT INTO inventory_levels (tenant_id, variant_id, warehouse_id, on_hand, allocated, as_of, updated_at)
    VALUES (${input.tenantId}::uuid, ${input.variantId}::uuid, ${input.warehouseId}::uuid, 0, 0, now(), now())
    ON CONFLICT (variant_id, warehouse_id) DO NOTHING
  `;

  // 2. Lock the row FOR UPDATE — serializes concurrent writers on this level.
  const locked = await tx.$queryRaw<LockedLevel[]>`
    SELECT on_hand, allocated, avg_cost_cents, reorder_point
    FROM inventory_levels
    WHERE variant_id = ${input.variantId}::uuid AND warehouse_id = ${input.warehouseId}::uuid
    FOR UPDATE
  `;
  const current = locked[0];
  if (!current) {
    // The upsert above guarantees a row; a miss means the GUC/tenant is wrong.
    throw new InventoryValidationError('Inventory level not found while applying movement');
  }

  // 3. Idempotency: with the row locked, a redelivered movement with the same
  //    key is detectable and skipped (the unique index is the DB-level backstop).
  if (input.idempotencyKey) {
    const existing = await tx.inventoryMovement.findFirst({
      where: { idempotencyKey: input.idempotencyKey },
      select: { id: true },
    });
    if (existing) {
      return noChange(existing.id, current);
    }
  }

  // Effective delta — an absolute `setOnHand` reconciles to a corrective delta
  // computed against the locked on-hand; otherwise the signed `delta` is used.
  const delta = input.setOnHand !== undefined ? input.setOnHand - current.on_hand : input.delta;

  // A zero-effect movement (e.g. a sync run that found no change) writes no
  // ledger row — keeps `onHand == Σ(movements)` clean and avoids feed noise.
  if (delta === 0 && allocatedDelta === 0) {
    return noChange('', current);
  }

  const newOnHand = current.on_hand + delta;
  if (newOnHand < 0 && !input.allowNegative) {
    throw new InventoryValidationError(
      `Movement would drive onHand negative (current ${current.on_hand}, delta ${delta})`
    );
  }
  const newAllocated = current.allocated + allocatedDelta;
  const newAvg = nextAvgCost(
    current.on_hand,
    current.avg_cost_cents,
    delta,
    input.unitCostCents ?? null
  );

  // 4. Single write to the locked row (onHand + allocated + moving-average).
  await tx.inventoryLevel.update({
    where: {
      variantId_warehouseId: { variantId: input.variantId, warehouseId: input.warehouseId },
    },
    data: {
      onHand: newOnHand,
      allocated: newAllocated,
      ...(newAvg !== null ? { avgCostCents: newAvg } : {}),
      asOf: new Date(),
    },
  });

  // 5. Append the ledger row.
  const movement = await tx.inventoryMovement.create({
    data: {
      tenantId: input.tenantId,
      variantId: input.variantId,
      warehouseId: input.warehouseId,
      delta,
      balanceAfter: newOnHand,
      reason: input.reason,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      source: input.source ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      note: input.note ?? null,
      unitCostCents: input.unitCostCents ?? null,
    },
  });

  // 6. Keep the denormalized Product.inStock flag honest.
  await syncProductInStock(tx, input.variantId);

  return {
    movementId: movement.id,
    deduped: false,
    appliedDelta: delta,
    onHand: newOnHand,
    allocated: newAllocated,
    available: newOnHand - newAllocated,
    avgCostCents: newAvg,
    reorderPoint: current.reorder_point,
  };
}

/** Build a MovementResult that reflects the locked level with nothing written
 *  (an idempotency hit or a zero-effect movement). */
function noChange(movementId: string, current: LockedLevel): MovementResult {
  return {
    movementId,
    deduped: true,
    appliedDelta: 0,
    onHand: current.on_hand,
    allocated: current.allocated,
    available: current.on_hand - current.allocated,
    avgCostCents: current.avg_cost_cents,
    reorderPoint: current.reorder_point,
  };
}

/**
 * Post-commit threshold events for a level after a movement. Fires
 * `inventory.adjusted` always, plus `inventory.low` / `inventory.depleted` when
 * available crosses the reorder point / zero. Call AFTER the transaction
 * commits; never inside it.
 */
export async function emitStockEvents(
  ctx: ServiceContext,
  variantId: string,
  warehouseId: string,
  result: MovementResult,
  delta: number,
  reason: string
): Promise<void> {
  await publishInventoryEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'inventory.adjusted',
    data: {
      variantId,
      warehouseId,
      delta,
      reason,
      newOnHand: result.onHand,
      newAvailable: result.available,
    },
  });

  if (result.reorderPoint !== null && result.available <= result.reorderPoint) {
    await publishInventoryEvent({
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      topic: 'inventory.low',
      data: {
        variantId,
        warehouseId,
        available: result.available,
        reorderPoint: result.reorderPoint,
      },
    });
  }
  if (result.available <= 0) {
    await publishInventoryEvent({
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      topic: 'inventory.depleted',
      data: { variantId, warehouseId },
    });
  }
}
