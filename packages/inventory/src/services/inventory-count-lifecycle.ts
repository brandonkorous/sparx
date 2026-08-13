// Inventory counts (docs/100 P4) — the lifecycle: submit a counting session for
// review (freeze the variance + the approval requirement), approve it when the
// variance value clears the threshold, post it (apply a `recount` movement per
// line through the ledger), or cancel it. The recount is an absolute `setOnHand`,
// so the corrective delta is computed against LIVE on-hand inside the row lock —
// a sale that landed mid-count is reconciled, not lost.

import { withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import { writeAuditLog } from '../audit';
import {
  InventoryConflictError,
  InventoryNotFoundError,
  InventoryValidationError,
} from '../errors';
import type { ServiceContext } from '../errors';
import { publishInventoryEvent } from '../events';

import { lockBinOnHand } from './bin-ledger';
import { applyMovement, emitStockEvents, resolveActorType } from './ledger';
import type { MovementResult } from './ledger';
import { costBasisFor, loadCountDetail } from './inventory-count-shared';
import type { InventoryCountDetail } from './inventory-count-shared';
import { noteSetupStep } from './setup-progress';

const DEFAULT_THRESHOLD_CENTS = 5000;

interface CountLineLite {
  id: string;
  variantId: string;
  expectedQuantity: number;
  countedQuantity: number | null;
  /** Set on a shelf-scoped line — the whole reason `applyRecount` branches. */
  binId: string | null;
}

// ─── Submit for review ─────────────────────────────────────────────────────────

export async function submitInventoryCount(
  ctx: ServiceContext,
  countId: string
): Promise<InventoryCountDetail> {
  await withTenant(ctx, async (tx) => {
    const count = await tx.inventoryCount.findFirst({
      where: { id: countId },
      select: { id: true, status: true, warehouseId: true, approvalThresholdCents: true },
    });
    if (!count) throw new InventoryNotFoundError('InventoryCount', countId);
    if (count.status !== 'counting') {
      throw new InventoryConflictError(`Cannot submit a count while ${count.status}`, 'status');
    }

    const lines = await tx.inventoryCountLine.findMany({
      where: { countId },
      select: {
        id: true,
        variantId: true,
        expectedQuantity: true,
        countedQuantity: true,
        binId: true,
      },
    });
    if (lines.length === 0) {
      throw new InventoryValidationError('Add at least one line before submitting the count');
    }
    const uncounted = lines.filter((l) => l.countedQuantity === null).length;
    if (uncounted > 0) {
      throw new InventoryValidationError(
        `${uncounted} line${uncounted === 1 ? '' : 's'} not yet counted — enter every quantity first`
      );
    }

    const varianceValueCents = await computeVarianceValue(tx, count.warehouseId, lines);
    const threshold = count.approvalThresholdCents ?? DEFAULT_THRESHOLD_CENTS;
    const requiresApproval = varianceValueCents > threshold;

    await tx.inventoryCount.update({
      where: { id: countId },
      data: { status: 'review', countedAt: new Date(), varianceValueCents, requiresApproval },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.count.submitted',
      entityType: 'InventoryCount',
      entityId: countId,
      diff: { after: { varianceValueCents, requiresApproval } },
    });
  });
  return getDetail(ctx, countId);
}

/** Σ |counted − expected| × cost basis (avg → unit → variant cost → 0). */
async function computeVarianceValue(
  tx: TxClient,
  warehouseId: string,
  lines: CountLineLite[]
): Promise<number> {
  const variantIds = lines.map((l) => l.variantId);
  const [costBasis, variants] = await Promise.all([
    costBasisFor(tx, warehouseId, variantIds),
    tx.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, costCents: true },
    }),
  ]);
  const variantCost = new Map(variants.map((v) => [v.id, v.costCents]));
  let total = 0;
  for (const l of lines) {
    if (l.countedQuantity === null) continue;
    const cost = costBasis.get(l.variantId) ?? variantCost.get(l.variantId) ?? 0;
    total += Math.abs(l.countedQuantity - l.expectedQuantity) * cost;
  }
  return total;
}

// ─── Approve (over-threshold sign-off) ───────────────────────────────────────

export async function approveInventoryCount(
  ctx: ServiceContext,
  countId: string
): Promise<InventoryCountDetail> {
  await withTenant(ctx, async (tx) => {
    const count = await tx.inventoryCount.findFirst({
      where: { id: countId },
      select: { id: true, status: true, requiresApproval: true },
    });
    if (!count) throw new InventoryNotFoundError('InventoryCount', countId);
    if (count.status !== 'review') {
      throw new InventoryConflictError(`Cannot approve a count while ${count.status}`, 'status');
    }
    if (!count.requiresApproval) {
      throw new InventoryConflictError(
        'This count is under the approval threshold — post it directly',
        'status'
      );
    }
    await tx.inventoryCount.update({
      where: { id: countId },
      data: { status: 'approved', approvedAt: new Date(), approvedBy: ctx.userId ?? null },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.count.approved',
      entityType: 'InventoryCount',
      entityId: countId,
      diff: { after: { approvedBy: ctx.userId ?? null } },
    });
  });
  return getDetail(ctx, countId);
}

// ─── Post (apply recount movements) ──────────────────────────────────────────

interface RecountEvent {
  variantId: string;
  warehouseId: string;
  result: MovementResult;
  delta: number;
}

export async function postInventoryCount(
  ctx: ServiceContext,
  countId: string
): Promise<InventoryCountDetail> {
  const posted = await withTenant(ctx, async (tx) => {
    const count = await tx.inventoryCount.findFirst({
      where: { id: countId },
      select: {
        id: true,
        number: true,
        status: true,
        type: true,
        warehouseId: true,
        requiresApproval: true,
      },
    });
    if (!count) throw new InventoryNotFoundError('InventoryCount', countId);
    assertPostable(count.status, count.requiresApproval);

    // An opening count's movements are the first quantities this business ever
    // recorded, not corrections to quantities it got wrong (docs/146 Phase
    // 11.4). Under `recount` they would land in the shrinkage report and credit
    // stock corrections in the journal — a business's first day reading as its
    // worst day of losses.
    const reason = count.type === 'opening' ? 'opening' : 'recount';

    const lines = await tx.inventoryCountLine.findMany({
      where: { countId, countedQuantity: { not: null } },
      select: {
        id: true,
        variantId: true,
        expectedQuantity: true,
        countedQuantity: true,
        binId: true,
      },
    });

    const events: RecountEvent[] = [];
    for (const line of lines) {
      events.push(await applyRecount(tx, ctx, count.warehouseId, countId, line, reason));
    }

    await tx.inventoryCount.update({
      where: { id: countId },
      data: { status: 'posted', postedAt: new Date() },
    });

    if (count.type === 'opening') {
      await noteSetupStep(tx, ctx.tenantId, 'opening_balance', {
        countId,
        number: count.number,
        lines: lines.length,
      });
    }
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.count.posted',
      entityType: 'InventoryCount',
      entityId: countId,
      diff: { after: { number: count.number, lineCount: lines.length } },
    });
    return { number: count.number, events, reason };
  });

  // Post-commit: threshold events per changed level + the completion signal.
  for (const e of posted.events) {
    if (e.delta !== 0)
      await emitStockEvents(ctx, e.variantId, e.warehouseId, e.result, e.delta, posted.reason);
  }
  await publishInventoryEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'inventory.count.completed',
    data: {
      countId,
      number: posted.number,
      adjustedLines: posted.events.filter((e) => e.delta !== 0).length,
    },
  });
  return getDetail(ctx, countId);
}

function assertPostable(status: string, requiresApproval: boolean): void {
  const canPost = (status === 'review' && !requiresApproval) || status === 'approved';
  if (canPost) return;
  if (status === 'review' && requiresApproval) {
    throw new InventoryConflictError(
      'This count exceeds the approval threshold — it must be approved before posting',
      'status'
    );
  }
  throw new InventoryConflictError(`Cannot post a count while ${status}`, 'status');
}

/** Reconcile one level to its counted quantity via an absolute `setOnHand`
 *  movement; record the applied delta + movement id on the line. The reason is
 *  passed in rather than hardcoded because an opening count posts `opening` and
 *  every other count posts `recount`. */
async function applyRecount(
  tx: TxClient,
  ctx: ServiceContext,
  warehouseId: string,
  countId: string,
  line: CountLineLite,
  reason: string
): Promise<RecountEvent> {
  const counted = line.countedQuantity ?? 0;

  // ── A SHELF-scoped line (docs/146 Phase 2) ──
  //
  // `setOnHand` would be flatly wrong here. Counting twelve on shelf A-01 does
  // not mean the LOCATION holds twelve — it means A-01 does, and the location
  // should move by the difference at that shelf. Setting the location to twelve
  // would silently delete everything on every other shelf, which is the most
  // destructive thing this module could do and would look like a successful count.
  //
  // So: lock the shelf, take the difference against what is LIVE on it (immune to
  // a sale landing mid-count, exactly as `setOnHand` is at location level), and
  // apply that as a relative delta seated on the shelf.
  if (line.binId) {
    const liveOnShelf = await lockBinOnHand(tx, {
      tenantId: ctx.tenantId,
      variantId: line.variantId,
      binId: line.binId,
      warehouseId,
    });
    const delta = counted - (liveOnShelf ?? 0);
    const result = await applyMovement(tx, {
      tenantId: ctx.tenantId,
      variantId: line.variantId,
      warehouseId,
      delta,
      reason,
      referenceType: 'InventoryCount',
      referenceId: countId,
      actorType: resolveActorType(ctx),
      actorId: ctx.userId ?? null,
      idempotencyKey: `count:${line.id}`,
      binId: line.binId,
      // A count is the authority on what is physically there. If the shelf was
      // already recorded negative — the location was oversold and the shortfall
      // was seated here — correcting UP is the fix, and refusing it would leave
      // the wrong number in place.
      allowNegative: true,
    });
    await tx.inventoryCountLine.update({
      where: { id: line.id },
      data: { appliedDelta: result.appliedDelta, movementId: result.movementId || null },
    });
    await tx.inventoryBinLevel.updateMany({
      where: { variantId: line.variantId, binId: line.binId },
      data: { lastCountedAt: new Date() },
    });
    return { variantId: line.variantId, warehouseId, result, delta: result.appliedDelta };
  }

  const result = await applyMovement(tx, {
    tenantId: ctx.tenantId,
    variantId: line.variantId,
    warehouseId,
    delta: 0,
    setOnHand: counted,
    reason,
    referenceType: 'InventoryCount',
    referenceId: countId,
    actorType: resolveActorType(ctx),
    actorId: ctx.userId ?? null,
    idempotencyKey: `count:${line.id}`,
  });
  await tx.inventoryCountLine.update({
    where: { id: line.id },
    data: { appliedDelta: result.appliedDelta, movementId: result.movementId || null },
  });
  return { variantId: line.variantId, warehouseId, result, delta: result.appliedDelta };
}

// ─── Cancel ──────────────────────────────────────────────────────────────────

export async function cancelInventoryCount(
  ctx: ServiceContext,
  countId: string
): Promise<InventoryCountDetail> {
  await withTenant(ctx, async (tx) => {
    const count = await tx.inventoryCount.findFirst({
      where: { id: countId },
      select: { id: true, status: true },
    });
    if (!count) throw new InventoryNotFoundError('InventoryCount', countId);
    if (count.status === 'posted' || count.status === 'cancelled') {
      throw new InventoryConflictError(`Cannot cancel a count while ${count.status}`, 'status');
    }
    await tx.inventoryCount.update({ where: { id: countId }, data: { status: 'cancelled' } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.count.cancelled',
      entityType: 'InventoryCount',
      entityId: countId,
      diff: { after: { status: 'cancelled' } },
    });
  });
  return getDetail(ctx, countId);
}

function getDetail(ctx: ServiceContext, countId: string): Promise<InventoryCountDetail> {
  return withTenant(ctx, (tx) => loadCountDetail(tx, countId));
}
