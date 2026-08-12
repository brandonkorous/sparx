// Working a pick list (docs/146 Phase 4.3).
//
// Assign it, walk it, confirm what came off each shelf, say what did not, finish.
//
// ── Confirming a pick writes NO warehouse movement ───────────────────────────
//
// This is the one thing to hold onto. Checkout already took these units off
// `inventory_levels.on_hand`; a second decrement here would sell one unit twice
// in the books. What a pick adds is knowledge of WHICH SHELF, and when the picker
// took from somewhere other than the instruction, that difference is written to
// the bin ledger alone (`correctPickBin`). The location total never moves.
//
// ── A short pick moves stock UP, and that is not an exception ────────────────
//
// Units nobody could find were never picked, so the sale that removed them has
// not happened. They go back on-hand — and straight into a reservation for the
// order that still wants them, so nobody else can buy something we have just
// admitted we cannot find. Then the shelf is routed to a count, because a short
// pick is the single best free signal that a stock number is wrong, and the whole
// value of catching it is squandered if it can be tapped past.
//
// The alternative — leaving the sale's decrement in place and treating the
// missing units as shrinkage — is wrong twice over: it books a loss nobody has
// confirmed, and it leaves the order owing units that the system now believes
// were shipped.

import {
  AssignPickListInput,
  CancelPickListInput,
  ConfirmPickInput,
  ShortPickInput,
  SkipPickInput,
} from '@sparx/commerce-schemas';
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

import { applyBinMovement } from './bin-ledger';
import { createInventoryCount } from './inventory-counts';
import { applyMovement, emitStockEvents, resolveActorType } from './ledger';
import type { MovementResult } from './ledger';
import { getPickList } from './pick-lists';
import type { PickListDetail } from './pick-lists';

// ─── Assignment ────────────────────────────────────────────────────────────────

export async function assignPickList(
  ctx: ServiceContext,
  pickListId: string,
  rawInput: unknown
): Promise<PickListDetail> {
  const input = AssignPickListInput.parse(rawInput);

  await withTenant(ctx, async (tx) => {
    const list = await loadList(tx, ctx.tenantId, pickListId);
    assertOpen(list);

    await tx.pickList.update({
      where: { id: pickListId },
      data: {
        assignedTo: input.assignedTo,
        assignedAt: input.assignedTo ? new Date() : null,
        // Handing a started walk back to the pool does not un-start it — lines
        // have already been picked and pretending otherwise loses the clock the
        // throughput report is measured against.
        status: list.status === 'picking' ? 'picking' : input.assignedTo ? 'assigned' : 'draft',
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.pick_list.assigned',
      entityType: 'PickList',
      entityId: pickListId,
      diff: { before: { assignedTo: list.assignedTo }, after: { assignedTo: input.assignedTo } },
    });
  });

  return getPickList(ctx, pickListId);
}

export async function cancelPickList(
  ctx: ServiceContext,
  pickListId: string,
  rawInput: unknown = {}
): Promise<PickListDetail> {
  const input = CancelPickListInput.parse(rawInput ?? {});

  await withTenant(ctx, async (tx) => {
    const list = await loadList(tx, ctx.tenantId, pickListId);
    if (list.status === 'cancelled') {
      throw new InventoryConflictError('That walk is already cancelled.', 'status');
    }

    // Lines already picked STAY picked. The units are off the shelf and in a
    // tote; cancelling the paperwork does not put them back, and rewriting them
    // to pending would send someone to fetch them a second time.
    await tx.pickListLine.updateMany({
      where: { pickListId, status: { in: ['pending', 'skipped'] } },
      data: { status: 'skipped' },
    });

    await tx.pickList.update({
      where: { id: pickListId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledReason: input.reason ?? null,
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.pick_list.cancelled',
      entityType: 'PickList',
      entityId: pickListId,
      diff: { after: { reason: input.reason ?? null } },
    });
  });

  return getPickList(ctx, pickListId);
}

// ─── Confirming a line ─────────────────────────────────────────────────────────

export interface PickActionResult {
  lineId: string;
  status: string;
  pickedQuantity: number;
  shortQuantity: number;
  /** Plain language, always populated — this is what the handheld shows. */
  message: string;
  /** The next instruction on the walk, or null when the walk is done. */
  next: PickListDetail['lines'][number] | null;
  list: PickListDetail;
}

export async function confirmPick(
  ctx: ServiceContext,
  pickListId: string,
  rawInput: unknown
): Promise<PickActionResult> {
  const input = ConfirmPickInput.parse(rawInput);

  const outcome = await withTenant(ctx, async (tx) => {
    const { list, line } = await loadWorkableLine(tx, ctx.tenantId, pickListId, input.lineId);

    const outstanding = line.quantity - line.pickedQuantity - line.shortQuantity;
    if (outstanding <= 0) {
      throw new InventoryConflictError('That line is already finished.', 'status');
    }
    const taken = input.quantity ?? outstanding;
    if (taken > outstanding) {
      throw new InventoryValidationError(
        `This line asks for ${outstanding} more, not ${taken}. Pick the rest onto another walk if there is more to take.`
      );
    }
    if (taken <= 0) {
      throw new InventoryValidationError(
        'Confirming zero picked is a short pick — say why, so the shelf gets counted.'
      );
    }

    const actualBin = input.binId ?? line.binId;
    if (taken > 0 && actualBin) {
      await correctPickBin(tx, ctx, {
        lineId: line.id,
        orderId: line.orderId,
        variantId: line.variantId,
        warehouseId: list.warehouseId,
        instructedBinId: line.binId,
        actualBinId: actualBin,
        quantity: taken,
      });
    }

    const pickedQuantity = line.pickedQuantity + taken;
    const finished = pickedQuantity + line.shortQuantity >= line.quantity;

    await tx.pickListLine.update({
      where: { id: line.id },
      data: {
        pickedQuantity,
        status: finished ? 'picked' : 'pending',
        binId: actualBin,
        verifiedByScan: line.verifiedByScan || (input.verifiedByScan ?? false),
        pickedAt: new Date(),
        pickedBy: ctx.userId ?? list.assignedTo ?? null,
      },
    });

    await touchStarted(tx, list);
    const completed = await completeIfFinished(tx, ctx, pickListId);

    return {
      lineId: line.id,
      status: finished ? 'picked' : 'pending',
      pickedQuantity,
      shortQuantity: line.shortQuantity,
      message: `${taken} × ${line.sku} confirmed.`,
      completed,
    };
  });

  if (outcome.completed) await announceCompletion(ctx, pickListId);
  return withNext(ctx, pickListId, outcome);
}

export async function skipPick(
  ctx: ServiceContext,
  pickListId: string,
  rawInput: unknown
): Promise<PickActionResult> {
  const input = SkipPickInput.parse(rawInput);

  const outcome = await withTenant(ctx, async (tx) => {
    const { list, line } = await loadWorkableLine(tx, ctx.tenantId, pickListId, input.lineId);
    await tx.pickListLine.update({ where: { id: line.id }, data: { status: 'skipped' } });
    await touchStarted(tx, list);
    return {
      lineId: line.id,
      status: 'skipped',
      pickedQuantity: line.pickedQuantity,
      shortQuantity: line.shortQuantity,
      // Deliberately not "done". A skipped line is still owed, and the walk will
      // not finish while any remain — the picker is coming back to it.
      message: `${line.sku} left for later.`,
      completed: false,
    };
  });

  return withNext(ctx, pickListId, outcome);
}

/**
 * The units are not there.
 *
 * Three things happen, and the order matters: whatever WAS found is confirmed
 * first (so a "found 2 of 5" is two real picks and a short of three, not a short
 * of five), then the missing units are returned to stock and held for the order,
 * then the shelf is routed to a count.
 */
export async function shortPick(
  ctx: ServiceContext,
  pickListId: string,
  rawInput: unknown
): Promise<PickActionResult> {
  const input = ShortPickInput.parse(rawInput);
  const found = input.quantity ?? 0;

  if (found > 0) {
    await confirmPick(ctx, pickListId, { lineId: input.lineId, quantity: found });
  }

  const restored: {
    variantId: string;
    warehouseId: string;
    short: number;
    result: MovementResult;
  }[] = [];

  const outcome = await withTenant(ctx, async (tx) => {
    const { list, line } = await loadWorkableLine(tx, ctx.tenantId, pickListId, input.lineId);
    const short = line.quantity - line.pickedQuantity - line.shortQuantity;
    if (short <= 0) {
      throw new InventoryConflictError('That line is already finished.', 'status');
    }

    // Put the units back, and hold them. On-hand rises because the sale that
    // removed them did not actually happen; `allocated` rises by the same amount
    // so AVAILABLE does not move and nobody can buy stock we have just said we
    // cannot find. The reservation makes the hold visible and releasable —
    // `reverseOrderSale` already drops order-held reservations on cancellation,
    // so this needs no new teardown path.
    const result = await applyMovement(tx, {
      tenantId: ctx.tenantId,
      variantId: line.variantId,
      warehouseId: list.warehouseId,
      delta: short,
      allocatedDelta: short,
      reason: 'pick_short',
      referenceType: 'Order',
      referenceId: line.orderId,
      idempotencyKey: `pick-short:${line.id}`,
      actorType: resolveActorType(ctx),
      actorId: ctx.userId ?? null,
      note: `Not found while picking ${list.number}: ${input.reason}`,
      // Deliberately unseated. We do NOT know which shelf they should go back on
      // — the whole point is that they were not where we said. The inbound
      // resolver puts them on the item's home shelf, which is where a person
      // looking for them would go next.
      ...(line.binId ? { binId: line.binId } : {}),
    });

    if (!result.deduped) {
      await tx.inventoryReservation.create({
        data: {
          tenantId: ctx.tenantId,
          variantId: line.variantId,
          warehouseId: list.warehouseId,
          quantity: short,
          holderType: 'order',
          holderId: line.orderId,
          status: 'active',
        },
      });
      restored.push({
        variantId: line.variantId,
        warehouseId: list.warehouseId,
        short,
        result,
      });
    }

    const countId =
      (input.raiseCount ?? true)
        ? await raiseShortCount(tx, ctx, {
            warehouseId: list.warehouseId,
            binId: line.binId,
            variantId: line.variantId,
            pickListNumber: list.number,
            sku: line.sku,
          })
        : null;

    await tx.pickListLine.update({
      where: { id: line.id },
      data: {
        shortQuantity: line.shortQuantity + short,
        shortReason: input.reason,
        shortNote: input.note ?? null,
        shortCountId: countId,
        status: 'short',
        pickedAt: new Date(),
        pickedBy: ctx.userId ?? list.assignedTo ?? null,
      },
    });

    await touchStarted(tx, list);
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.pick_list.short',
      entityType: 'PickListLine',
      entityId: line.id,
      diff: {
        after: { sku: line.sku, short, reason: input.reason, countId },
      },
    });

    const completed = await completeIfFinished(tx, ctx, pickListId);

    return {
      lineId: line.id,
      status: 'short',
      pickedQuantity: line.pickedQuantity,
      shortQuantity: line.shortQuantity + short,
      message: countId
        ? `${short} × ${line.sku} short. The shelf has been put on a count.`
        : `${short} × ${line.sku} short.`,
      raisedCount: countId !== null,
      completed,
    };
  });

  for (const r of restored) {
    await emitStockEvents(ctx, r.variantId, r.warehouseId, r.result, r.short, 'pick_short');
    await publishInventoryEvent({
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      topic: 'inventory.pick.short',
      data: {
        pickListId,
        variantId: r.variantId,
        warehouseId: r.warehouseId,
        quantity: r.short,
        reason: input.reason,
      },
    });
  }

  // The count is raised OUTSIDE the transaction that recorded the short, because
  // `createInventoryCount` owns its own — and because a count sheet failing to
  // open must never undo the record that something was missing. Reusing an open
  // count happened inline; this is the case where a new one is needed.
  let message = outcome.message;
  if ((input.raiseCount ?? true) && !outcome.raisedCount) {
    const { raised } = await ensureShortCounts(ctx, pickListId);
    if (raised > 0) message = `${message} The shelf has been put on a count.`;
  }

  if (outcome.completed) await announceCompletion(ctx, pickListId);
  return withNext(ctx, pickListId, { ...outcome, message });
}

/**
 * Raise (or reuse) a bin-scoped blind count for the shelf that came up short.
 *
 * Reuses an open count on the same shelf rather than making a second one: a bad
 * morning on aisle C should produce one count sheet, not eleven, and eleven is
 * how a genuinely useful signal turns into noise people mute.
 *
 * Blind, always. The number the counter writes down has to be what they SEE, and
 * this count exists precisely because what we expected is in doubt.
 */
async function raiseShortCount(
  tx: TxClient,
  ctx: ServiceContext,
  input: {
    warehouseId: string;
    binId: string | null;
    variantId: string;
    pickListNumber: string;
    sku: string;
  }
): Promise<string | null> {
  const existing = await tx.inventoryCount.findFirst({
    where: {
      tenantId: ctx.tenantId,
      warehouseId: input.warehouseId,
      status: 'counting',
      ...(input.binId ? { scope: 'bin', binId: input.binId } : { scope: 'location' }),
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  if (existing) {
    const line = await tx.inventoryCountLine.findFirst({
      where: { countId: existing.id, variantId: input.variantId },
      select: { id: true },
    });
    if (!line) {
      const level = await tx.inventoryLevel.findUnique({
        where: {
          variantId_warehouseId: {
            variantId: input.variantId,
            warehouseId: input.warehouseId,
          },
        },
        select: { onHand: true },
      });
      await tx.inventoryCountLine.create({
        data: {
          tenantId: ctx.tenantId,
          countId: existing.id,
          variantId: input.variantId,
          expectedQuantity: level?.onHand ?? 0,
          ...(input.binId ? { binId: input.binId } : {}),
          note: `Short on ${input.pickListNumber}`,
        },
      });
    }
    return existing.id;
  }

  // `createInventoryCount` opens its own transaction, so it cannot be called from
  // inside this one — and it must not be, because a failure to raise the count
  // must never roll back the short pick itself. The count is the follow-up; the
  // short is the fact.
  return null;
}

// ─── The bin correction ────────────────────────────────────────────────────────

/**
 * Make the shelves describe the building.
 *
 * The sale drew these units off a shelf chosen at checkout. If the picker took
 * them off the same shelf — which is the overwhelmingly common case, because the
 * draw-down and the walk use the same strategy — there is nothing to do. If they
 * took them off a different one, the books have to be corrected: put the units
 * back on the shelf the sale assumed, and take them off the shelf they really
 * came from.
 *
 * No warehouse movement, in either direction. Nothing entered or left the
 * building; the location total is exactly as right as it was a second ago.
 */
async function correctPickBin(
  tx: TxClient,
  ctx: ServiceContext,
  input: {
    lineId: string;
    orderId: string;
    variantId: string;
    warehouseId: string;
    instructedBinId: string | null;
    actualBinId: string;
    quantity: number;
  }
): Promise<void> {
  if (input.instructedBinId === input.actualBinId) return;

  const warehouse = await tx.warehouse.findFirst({
    where: { id: input.warehouseId },
    select: { usesBins: true },
  });
  if (!warehouse?.usesBins) return;

  const actual = await tx.inventoryBin.findFirst({
    where: {
      id: input.actualBinId,
      tenantId: ctx.tenantId,
      warehouseId: input.warehouseId,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true, code: true },
  });
  if (!actual) {
    throw new InventoryValidationError(
      'That shelf is not one of this location’s. Scan a shelf in the building you are standing in.',
      [{ field: 'binId', message: 'Unknown or archived shelf for this location' }]
    );
  }

  // Where the sale believed these came from. Null when the instruction named no
  // shelf (a line generated with no sale to read) — then the correction is a
  // simple take-off-the-actual-shelf, and the sale's guess is left where it is
  // because there is no evidence about what it was.
  const target = input.instructedBinId;
  if (!target) return;

  const common = {
    tenantId: ctx.tenantId,
    variantId: input.variantId,
    warehouseId: input.warehouseId,
    reason: 'pick',
    referenceType: 'Order',
    referenceId: input.orderId,
    actorType: resolveActorType(ctx),
    actorId: ctx.userId ?? null,
    fromBinId: input.actualBinId,
    toBinId: target,
  };

  // Back onto the shelf the sale drew from…
  await applyBinMovement(tx, {
    ...common,
    binId: target,
    delta: input.quantity,
    idempotencyKey: `pick-correct-in:${input.lineId}`,
    note: `Picked from ${actual.code} instead — the sale had taken it from here.`,
  });

  // …and off the one it really came from. Allowed negative: if the picker took
  // stock the books say is not on that shelf, the shelf IS wrong and the minus
  // sign is the honest record of it. Refusing here would leave the two ledgers
  // disagreeing and block the pick over a data problem the picker cannot fix.
  await applyBinMovement(tx, {
    ...common,
    binId: input.actualBinId,
    delta: -input.quantity,
    allowNegative: true,
    idempotencyKey: `pick-correct-out:${input.lineId}`,
    note: `Picked from here for order; the sale had assumed another shelf.`,
  });
}

// ─── Completion ────────────────────────────────────────────────────────────────

/** Every line resolved → the walk is over. Returns true when this call ended it. */
async function completeIfFinished(
  tx: TxClient,
  ctx: ServiceContext,
  pickListId: string
): Promise<boolean> {
  const open = await tx.pickListLine.count({
    where: { pickListId, status: { in: ['pending', 'skipped'] } },
  });
  if (open > 0) return false;

  const updated = await tx.pickList.updateMany({
    where: { id: pickListId, status: { in: ['draft', 'assigned', 'picking'] } },
    data: { status: 'picked', pickedAt: new Date() },
  });
  if (updated.count === 0) return false;

  await writeAuditLog({
    tx,
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    actorType: ctx.userId ? 'user' : 'system',
    action: 'inventory.pick_list.picked',
    entityType: 'PickList',
    entityId: pickListId,
    diff: { after: { status: 'picked' } },
  });
  return true;
}

async function announceCompletion(ctx: ServiceContext, pickListId: string): Promise<void> {
  const detail = await getPickList(ctx, pickListId);
  await publishInventoryEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'inventory.pick_list.completed',
    data: {
      pickListId,
      number: detail.number,
      unitsPicked: detail.unitsPicked,
      unitsRequested: detail.unitsRequested,
      shortLines: detail.shortCount,
    },
  });
}

// ─── Shared plumbing ───────────────────────────────────────────────────────────

interface ListHeader {
  id: string;
  number: string;
  status: string;
  warehouseId: string;
  assignedTo: string | null;
  startedAt: Date | null;
}

interface WorkableLine {
  id: string;
  orderId: string;
  variantId: string;
  sku: string;
  binId: string | null;
  quantity: number;
  pickedQuantity: number;
  shortQuantity: number;
  status: string;
  verifiedByScan: boolean;
}

async function loadList(tx: TxClient, tenantId: string, pickListId: string): Promise<ListHeader> {
  const list = await tx.pickList.findFirst({
    where: { id: pickListId, tenantId },
    select: {
      id: true,
      number: true,
      status: true,
      warehouseId: true,
      assignedTo: true,
      startedAt: true,
    },
  });
  if (!list) throw new InventoryNotFoundError('PickList', pickListId);
  return list;
}

function assertOpen(list: ListHeader): void {
  if (list.status === 'cancelled' || list.status === 'picked') {
    throw new InventoryConflictError(
      `Walk ${list.number} is ${list.status} and can no longer be worked.`,
      'status'
    );
  }
}

export async function loadWorkableLine(
  tx: TxClient,
  tenantId: string,
  pickListId: string,
  lineId: string
): Promise<{ list: ListHeader; line: WorkableLine }> {
  const list = await loadList(tx, tenantId, pickListId);
  assertOpen(list);

  const rows = await tx.$queryRaw<WorkableLine[]>`
    SELECT ln.id               AS "id",
           ln.order_id         AS "orderId",
           ln.variant_id       AS "variantId",
           v.sku               AS "sku",
           ln.bin_id           AS "binId",
           ln.quantity         AS "quantity",
           ln.picked_quantity  AS "pickedQuantity",
           ln.short_quantity   AS "shortQuantity",
           ln.status           AS "status",
           ln.verified_by_scan AS "verifiedByScan"
      FROM inventory_pick_list_lines ln
      JOIN commerce_product_variants v ON v.id = ln.variant_id
     WHERE ln.tenant_id = ${tenantId}::uuid
       AND ln.pick_list_id = ${pickListId}::uuid
       AND ln.id = ${lineId}::uuid
  `;
  const line = rows[0];
  if (!line) throw new InventoryNotFoundError('PickListLine', lineId);
  return { list, line };
}

/** First confirmed line starts the clock — not the assignment. A walk assigned at
 *  08:00 and started at 11:00 took twenty minutes, not three hours. */
async function touchStarted(tx: TxClient, list: ListHeader): Promise<void> {
  if (list.startedAt) {
    if (list.status === 'draft' || list.status === 'assigned') {
      await tx.pickList.update({ where: { id: list.id }, data: { status: 'picking' } });
    }
    return;
  }
  await tx.pickList.update({
    where: { id: list.id },
    data: { status: 'picking', startedAt: new Date() },
  });
}

interface RawOutcome {
  lineId: string;
  status: string;
  pickedQuantity: number;
  shortQuantity: number;
  message: string;
  completed: boolean;
  /** Whether the short pick already attached a count (by reusing an open one). */
  raisedCount?: boolean;
}

/** Attach the reloaded list and the next instruction. The handheld renders from
 *  the SERVER's view of the walk after every action, for the same reason a
 *  receiving session does: two people on two guns must see one truth. */
async function withNext(
  ctx: ServiceContext,
  pickListId: string,
  outcome: RawOutcome
): Promise<PickActionResult> {
  const list = await getPickList(ctx, pickListId);
  const next = list.lines.find((l) => l.status === 'pending') ?? null;
  return {
    lineId: outcome.lineId,
    status: outcome.status,
    pickedQuantity: outcome.pickedQuantity,
    shortQuantity: outcome.shortQuantity,
    message: outcome.message,
    next,
    list,
  };
}

/**
 * Raise the follow-up count for a short pick that could not reuse an open one.
 *
 * Deliberately OUTSIDE the short-pick transaction (see `raiseShortCount`): a
 * count is the follow-up, the short is the fact, and a failure to open a count
 * sheet must never undo the record that something was missing.
 */
export async function ensureShortCounts(
  ctx: ServiceContext,
  pickListId: string
): Promise<{ raised: number }> {
  const pending = await withTenant(
    ctx,
    (tx) =>
      tx.$queryRaw<{ lineId: string; warehouseId: string; binId: string | null }[]>`
      SELECT ln.id             AS "lineId",
             pl.warehouse_id   AS "warehouseId",
             ln.bin_id         AS "binId"
        FROM inventory_pick_list_lines ln
        JOIN inventory_pick_lists pl ON pl.id = ln.pick_list_id
       WHERE ln.tenant_id      = ${ctx.tenantId}::uuid
         AND ln.pick_list_id   = ${pickListId}::uuid
         AND ln.status         = 'short'
         AND ln.short_count_id IS NULL
    `
  );

  let raised = 0;
  for (const row of pending) {
    const count = await createInventoryCount(ctx, {
      warehouseId: row.warehouseId,
      type: 'cycle',
      isBlind: true,
      ...(row.binId ? { scope: 'bin', binId: row.binId } : { scope: 'location' }),
      note: 'Raised by a short pick — settle what is actually on this shelf.',
    });
    await withTenant(ctx, (tx) =>
      tx.pickListLine.update({ where: { id: row.lineId }, data: { shortCountId: count.id } })
    );
    raised += 1;
  }
  return { raised };
}
