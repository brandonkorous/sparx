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

import { mirrorMovementToBins } from './bin-ledger';
import { commitConsumption, planConsumption, restoreToLayers, writeCostLayer } from './cost-layers';
import type { CostLayerSource } from './cost-layers';
import { resolveCosting } from './costing-policy';
import { recordOversellIncidentOnTx } from './integrity';
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
  /**
   * Which shelf this change happened on (docs/146 Phase 2).
   *
   * Optional and usually omitted: a sale does not know which shelf a picker
   * used, so the mirror draws down across the bins that hold stock. Set it when
   * the caller genuinely knows — a put-away, a bin-scoped count, a scan.
   * Ignored entirely on a location that does not use bins.
   */
  binId?: string | null;
  /**
   * Landed cost of the goods alone, before allocated charges (docs/146 Phase 5).
   * Only meaningful on an inbound movement, and only to split the cost layer's
   * breakdown into "the part" and "the freight". Defaults to `unitCostCents`.
   */
  goodsUnitCostCents?: number | null;
  /**
   * Where the inbound units came from, for the cost layer. Derived from `reason`
   * when omitted, which is right for every caller except receiving — a receipt
   * wants the RECEIPT LINE as its source id so a later freight invoice can find
   * the exact layer to revalue.
   */
  layerSource?: CostLayerSource;
  layerSourceId?: string | null;
  /**
   * When the units arrived, for FIFO ordering. Defaults to now. A back-dated
   * receipt sorts by when the goods landed rather than by when someone got round
   * to typing it in.
   */
  acquiredAt?: Date;
  /**
   * Reverse the cost of a specific earlier movement (docs/146 Phase 5.9). Set on
   * an INBOUND movement that undoes an outbound one — a cancelled order, a
   * return coming back. The units go back onto the layers the original sale
   * drained rather than onto a fresh layer at today's average, which is what
   * keeps FIFO honest through a cancellation, and the cost is credited rather
   * than charged.
   */
  costRestoreFromMovementId?: string | null;
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
  /** What the goods on this movement cost (docs/146 Phase 5.9). Positive when
   *  stock left, negative when a reversal credited it back, null on an ordinary
   *  inbound. */
  costConsumedCents: number | null;
}

interface LockedLevel {
  on_hand: number;
  allocated: number;
  avg_cost_cents: number | null;
  reorder_point: number | null;
  /** Who owns the units at this level RIGHT NOW (docs/146 Phase 9.5). Read off
   *  the same locked row rather than in a query of its own, so stamping every
   *  movement with it costs nothing. */
  ownership: string;
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
    SELECT on_hand, allocated, avg_cost_cents, reorder_point, ownership
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
  // Refuse only a movement that CAUSES the negative.
  //
  // `delta > 0` is excluded deliberately, and the omission was a real bug that
  // Phase 9 surfaced: a level driven to −12 by a permitted oversell could not
  // then be RECEIVED into, because +8 still leaves −4 and the guard fired on the
  // result rather than on the cause. That is the exact sequence backorders exist
  // to serve — sell past zero, then take a delivery — and it failed the delivery.
  //
  // An inbound movement can never make the position worse, so a still-negative
  // balance after one is a pre-existing shortfall being partially repaid, not a
  // new overdraft to block.
  if (newOnHand < 0 && delta < 0 && !input.allowNegative) {
    throw new InventoryValidationError(
      `Movement would drive onHand negative (current ${current.on_hand}, delta ${delta})`
    );
  }

  // A permitted negative on-hand means goods left the building that the system
  // did not believe were there. That is the most serious of the three oversell
  // shapes and the easiest to miss — it throws nothing, shows no error, and the
  // only trace is a minus sign on a stock screen nobody is looking at. Recorded
  // in THIS transaction so the incident and the movement land together
  // (docs/146 Phase 1, D3).
  if (newOnHand < 0 && current.on_hand >= 0) {
    await recordOversellIncidentOnTx(
      tx,
      { tenantId: input.tenantId, ...(input.actorId ? { userId: input.actorId } : {}) },
      {
        variantId: input.variantId,
        warehouseId: input.warehouseId,
        kind: 'negative_on_hand',
        // The "request" here is the size of the movement, and what was available
        // is what the level actually held before it.
        requestedQuantity: Math.abs(delta),
        availableQuantity: current.on_hand,
        onHandAtDecision: current.on_hand,
        allocatedAtDecision: current.allocated,
        bufferAtDecision: 0,
        // The policy that permitted it is implied by the caller passing
        // `allowNegative`; the variant's own flag is not read here because doing
        // so would add a query to the hot path of every committed sale.
        policy: 'continue',
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        holderType: input.referenceType ?? null,
        holderId: input.referenceId ?? null,
      }
    );
  }
  const newAllocated = current.allocated + allocatedDelta;
  const newAvg = nextAvgCost(
    current.on_hand,
    current.avg_cost_cents,
    delta,
    input.unitCostCents ?? null
  );

  // Cost of goods (docs/146 Phase 5.9). Resolved BEFORE the ledger row is
  // written so the movement can be stamped in one insert rather than an insert
  // and a correcting update — a movement whose cost arrives a moment later is a
  // movement some reader will see without one.
  //
  // Only outbound movements need the resolution: an inbound one's basis is its
  // own `unitCostCents`. Skipping it keeps receiving at exactly the query count
  // it had before this phase.
  const costing =
    delta < 0
      ? await resolveCosting(tx, {
          tenantId: input.tenantId,
          variantId: input.variantId,
          warehouseId: input.warehouseId,
        })
      : null;
  const plan =
    delta < 0
      ? await planConsumption(tx, {
          tenantId: input.tenantId,
          variantId: input.variantId,
          warehouseId: input.warehouseId,
          quantity: -delta,
        })
      : null;
  const costConsumedCents =
    costing && plan
      ? costOfGoods({
          method: costing.method,
          quantity: -delta,
          plan,
          avgCostCents: current.avg_cost_cents,
          standardCostCents: costing.standardCostCents,
        })
      : null;

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
      costConsumedCents,
      // Who owned the units when this happened (docs/146 Phase 9.5). STAMPED,
      // never joined at read time: ownership changes — a consignment gets bought
      // outright, a 3PL contract ends — and classifying a three-month-old sale
      // by today's ownership silently rewrites what was owed that quarter. A
      // settlement that moves after it was paid is worse than none at all.
      ownership: current.ownership,
    },
  });

  // 5b. The cost ledger rides along in THIS transaction, so the stock change and
  //     what it cost can never disagree about whether they happened.
  const creditedCostCents = await applyCostLedger(tx, input, {
    movementId: movement.id,
    delta,
    plan,
    avgCostCents: newAvg ?? current.avg_cost_cents,
  });
  // A reversal's credit is only knowable once the layers have been refilled, so
  // it is the one case that needs a second touch on the row. Rare by nature: it
  // happens on a cancellation, not on a sale.
  if (creditedCostCents !== null) {
    await tx.inventoryMovement.update({
      where: { id: movement.id },
      data: { costConsumedCents: creditedCostCents },
    });
  }

  // 6. Mirror the change onto a shelf (docs/146 Phase 2). A no-op on a location
  //    that does not use bins, which is what keeps the whole feature genuinely
  //    optional rather than optional-in-the-UI-only. Runs in THIS transaction, so
  //    the warehouse row and its bin row land together or not at all — the two
  //    ledgers can never disagree about whether something happened.
  await mirrorMovementToBins(tx, {
    tenantId: input.tenantId,
    variantId: input.variantId,
    warehouseId: input.warehouseId,
    delta,
    reason: input.reason,
    movementId: movement.id,
    binId: input.binId ?? null,
    referenceType: input.referenceType ?? null,
    referenceId: input.referenceId ?? null,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    source: input.source ?? null,
    allowNegative: input.allowNegative ?? false,
  });

  // 7. Keep the denormalized Product.inStock flag honest.
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
    costConsumedCents: creditedCostCents ?? costConsumedCents,
  };
}

/**
 * What the goods on an outbound movement cost, per the tenant's method.
 *
 * The layers are consumed either way — see `cost-layers.ts` on why the ledger is
 * kept regardless of method. This decides only which number gets STAMPED:
 *
 *   fifo            what the layers actually held, oldest first
 *   moving_average  the running average at the moment it left
 *   standard        the planned figure, so the difference from what was paid
 *                   shows up as a variance instead of being buried in the basis
 *
 * Units the layers could not cover (stock that predates costing, or a sale under
 * a `continue` policy) fall back to the moving average, then to the standard
 * cost, then to zero — the same chain valuation has always used, so a cost here
 * never disagrees with the report next to it.
 */
export function costOfGoods(params: {
  method: 'moving_average' | 'fifo' | 'standard';
  quantity: number;
  plan: { coveredCostCents: number; shortfall: number };
  avgCostCents: number | null;
  standardCostCents: number | null;
}): number {
  const fallbackUnit = params.avgCostCents ?? params.standardCostCents ?? 0;
  switch (params.method) {
    case 'fifo':
      return params.plan.coveredCostCents + params.plan.shortfall * fallbackUnit;
    case 'standard':
      return params.quantity * (params.standardCostCents ?? fallbackUnit);
    case 'moving_average':
    default:
      return params.quantity * fallbackUnit;
  }
}

/**
 * Keep the cost layers in step with a stock change.
 *
 * Outbound draws the planned units off their layers. Inbound either gives units
 * back to the layers an earlier movement drained (a cancellation — see
 * `restoreToLayers`) or opens a new layer at what the units cost. Returns the
 * credited cost when this was a reversal, so the caller can stamp it; null
 * otherwise.
 */
async function applyCostLedger(
  tx: TxClient,
  input: MovementInput,
  params: {
    movementId: string;
    delta: number;
    plan: { slices: { layerId: string; quantity: number; unitCostCents: number }[] } | null;
    avgCostCents: number | null;
  }
): Promise<number | null> {
  if (params.delta < 0) {
    if (params.plan) {
      await commitConsumption(tx, {
        tenantId: input.tenantId,
        movementId: params.movementId,
        plan: { ...params.plan, shortfall: 0, coveredCostCents: 0 },
      });
    }
    return null;
  }
  if (params.delta === 0) return null;

  // A reversal: the same units going back where they came from.
  if (input.costRestoreFromMovementId) {
    const restored = await restoreToLayers(tx, {
      tenantId: input.tenantId,
      movementId: params.movementId,
      sourceMovementId: input.costRestoreFromMovementId,
      quantity: params.delta,
    });
    // Anything the original movement cannot account for is still stock that
    // exists — it gets its own layer at the current basis rather than being
    // quietly uncosted.
    if (restored.uncovered > 0) {
      await writeCostLayer(tx, {
        tenantId: input.tenantId,
        variantId: input.variantId,
        warehouseId: input.warehouseId,
        quantity: restored.uncovered,
        unitCostCents: input.unitCostCents ?? params.avgCostCents ?? 0,
        ...(input.goodsUnitCostCents != null
          ? { goodsUnitCostCents: input.goodsUnitCostCents }
          : {}),
        sourceType: layerSourceFor(input),
        sourceId: input.layerSourceId ?? input.referenceId ?? null,
        movementId: params.movementId,
        ...(input.acquiredAt ? { acquiredAt: input.acquiredAt } : {}),
      });
    }
    // Negative: reversing a sale CREDITS the cost of goods sold, so summing the
    // column over a period gives period COGS with no special cases.
    return -restored.creditedCostCents;
  }

  await writeCostLayer(tx, {
    tenantId: input.tenantId,
    variantId: input.variantId,
    warehouseId: input.warehouseId,
    quantity: params.delta,
    unitCostCents: input.unitCostCents ?? params.avgCostCents ?? 0,
    ...(input.goodsUnitCostCents != null ? { goodsUnitCostCents: input.goodsUnitCostCents } : {}),
    sourceType: layerSourceFor(input),
    sourceId: input.layerSourceId ?? input.referenceId ?? null,
    movementId: params.movementId,
    ...(input.acquiredAt ? { acquiredAt: input.acquiredAt } : {}),
  });
  return null;
}

/** Where inbound units came from, derived from the movement's reason when the
 *  caller has not said. Receiving says, because it wants the receipt LINE as the
 *  source so a freight invoice arriving later can find the layer to revalue. */
function layerSourceFor(input: MovementInput): CostLayerSource {
  if (input.layerSource) return input.layerSource;
  switch (input.reason) {
    case 'receive':
      return 'receipt';
    case 'return':
    case 'cancel':
      return 'return';
    case 'transfer_in':
      return 'transfer_in';
    case 'recount':
      return 'count';
    default:
      return 'adjustment';
  }
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
    costConsumedCents: null,
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
