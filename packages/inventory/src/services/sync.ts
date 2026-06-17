// External-feed reconcile — the write path for inventory sources (CSV / API /
// WMS / ERP). A feed reports an ABSOLUTE on-hand ("SKU X at warehouse W is now N
// units"); `reconcileStockLevel` funnels that through `applyMovement()` as a
// corrective `sync` movement rather than a blind overwrite (docs/100 §2.5), so:
//
//   • the corrective delta is computed inside the level's row lock, so it can't
//     race a concurrent sale / manual adjust (no lost updates, no oversell);
//   • the change is attributed (`actorType: 'integration'`, `source`: the feed)
//     and lands in the one ledger, keeping `onHand == Σ(movements)` true;
//   • a sync that finds no change writes no row (applyMovement's zero-delta
//     no-op), so polling feeds don't flood the ledger.
//
// Both the inventory-worker (CSV pull) and the `/sources/:id/push` endpoint
// (external push) call this — one reconcile implementation, one funnel.

import { withTenant } from '@sparx/db';

import type { ServiceContext } from '../errors';

import { ensureVariantExists, ensureWarehouseActive } from './internal';
import { applyMovement, emitStockEvents } from './ledger';
import type { MovementResult } from './ledger';

export interface ReconcileStockLevelInput {
  variantId: string;
  warehouseId: string;
  /** Absolute on-hand reported by the feed; the corrective delta is derived. */
  onHand: number;
  /** Origin system for attribution (e.g. the source name / "fishbowl"). */
  source?: string | null;
  /** Per-unit cost from the feed, when it carries one (moves the avg-cost basis). */
  unitCostCents?: number | null;
}

/**
 * Reconcile one (variant, warehouse) level to a feed's absolute on-hand. Returns
 * the post-movement snapshot; `result.deduped` is true when nothing changed.
 */
export async function reconcileStockLevel(
  ctx: ServiceContext,
  input: ReconcileStockLevelInput
): Promise<MovementResult> {
  const result = await withTenant(ctx, async (tx) => {
    await ensureWarehouseActive(tx, input.warehouseId);
    await ensureVariantExists(tx, input.variantId);

    return applyMovement(tx, {
      tenantId: ctx.tenantId,
      variantId: input.variantId,
      warehouseId: input.warehouseId,
      delta: 0,
      setOnHand: Math.max(0, input.onHand),
      reason: 'sync',
      actorType: 'integration',
      actorId: ctx.userId ?? null,
      source: input.source ?? null,
      unitCostCents: input.unitCostCents ?? null,
    });
  });

  if (!result.deduped) {
    await emitStockEvents(
      ctx,
      input.variantId,
      input.warehouseId,
      result,
      result.appliedDelta,
      'sync'
    );
  }

  return result;
}
