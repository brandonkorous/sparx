// Inventory transfers (docs/100 P4) — the lifecycle: ship a draft (each line
// leaves the source and lands in the system in-transit warehouse), receive an
// in-transit transfer (in-transit → destination, short receipts written off as a
// `loss`), or cancel (a draft is voided; an in-transit transfer's goods return to
// source). Every leg funnels through the movement ledger, so total stock is
// conserved across source, in-transit, and destination.

import { ReceiveTransferInput } from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import { writeAuditLog } from '../audit';
import {
  InventoryConflictError,
  InventoryNotFoundError,
  InventoryOutOfStockError,
  InventoryValidationError,
} from '../errors';
import type { ServiceContext } from '../errors';
import { publishInventoryEvent } from '../events';

import { applyMovement, emitStockEvents, resolveActorType } from './ledger';
import type { MovementResult } from './ledger';
import { ensureInTransitWarehouse, loadTransferDetail } from './inventory-transfer-shared';
import type { InventoryTransferDetail } from './inventory-transfer-shared';

interface TransferLineLite {
  id: string;
  variantId: string;
  quantity: number;
  receivedQuantity: number | null;
  shipMovementId: string | null;
}

interface LegEvent {
  variantId: string;
  warehouseId: string;
  result: MovementResult;
  delta: number;
  reason: string;
}

// ─── Ship (draft → in_transit) ───────────────────────────────────────────────────

export async function shipInventoryTransfer(
  ctx: ServiceContext,
  transferId: string
): Promise<InventoryTransferDetail> {
  const inTransitId = await ensureInTransitWarehouse(ctx);

  const events = await withTenant(ctx, async (tx) => {
    const transfer = await loadTransfer(tx, transferId);
    if (transfer.status !== 'draft') {
      throw new InventoryConflictError(`Cannot ship a transfer while ${transfer.status}`, 'status');
    }
    const lines = await loadLines(tx, transferId);
    if (lines.length === 0) {
      throw new InventoryValidationError('Add at least one line before shipping the transfer');
    }

    const source = await levelMap(tx, transfer.fromWarehouseId, lines);
    assertAvailable(lines, source);

    const legs: LegEvent[] = [];
    for (const line of lines) {
      const cost = source.get(line.variantId)?.cost ?? null;
      const out = await move(tx, ctx, {
        variantId: line.variantId,
        warehouseId: transfer.fromWarehouseId,
        delta: -line.quantity,
        reason: 'transfer_out',
        transferId,
        idempotencyKey: `transfer-ship-out:${line.id}`,
      });
      await move(tx, ctx, {
        variantId: line.variantId,
        warehouseId: inTransitId,
        delta: line.quantity,
        reason: 'transfer_in',
        transferId,
        idempotencyKey: `transfer-ship-in:${line.id}`,
        unitCostCents: cost,
      });
      await tx.inventoryTransferLine.update({
        where: { id: line.id },
        data: { shipMovementId: out.movementId || null },
      });
      legs.push({
        variantId: line.variantId,
        warehouseId: transfer.fromWarehouseId,
        result: out,
        delta: out.appliedDelta,
        reason: 'transfer_out',
      });
    }

    await tx.inventoryTransfer.update({
      where: { id: transferId },
      data: { status: 'in_transit', shippedAt: new Date(), shippedBy: ctx.userId ?? null },
    });
    await audit(tx, ctx, transferId, 'inventory.transfer.shipped', {
      from: transfer.fromWarehouseId,
      to: transfer.toWarehouseId,
      lineCount: lines.length,
    });
    return legs;
  });

  await emitLegEvents(ctx, events);
  await publishInventoryEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'inventory.transfer.shipped',
    data: { transferId, lines: events.length },
  });
  return getDetail(ctx, transferId);
}

// ─── Receive (in_transit → received) ─────────────────────────────────────────────

export async function receiveInventoryTransfer(
  ctx: ServiceContext,
  transferId: string,
  rawInput: unknown
): Promise<InventoryTransferDetail> {
  const input = ReceiveTransferInput.parse(rawInput);
  const overrides = new Map((input.lines ?? []).map((l) => [l.lineId, l.receivedQuantity]));
  const inTransitId = await ensureInTransitWarehouse(ctx);

  const events = await withTenant(ctx, async (tx) => {
    const transfer = await loadTransfer(tx, transferId);
    if (transfer.status !== 'in_transit') {
      throw new InventoryConflictError(
        `Cannot receive a transfer while ${transfer.status}`,
        'status'
      );
    }
    const lines = await loadLines(tx, transferId);
    assertOverrideLines(overrides, lines);
    const cost = await levelMap(tx, inTransitId, lines);

    const legs: LegEvent[] = [];
    for (const line of lines) {
      const received = clamp(overrides.get(line.id) ?? line.quantity, 0, line.quantity);
      if (received > 0) {
        await move(tx, ctx, {
          variantId: line.variantId,
          warehouseId: inTransitId,
          delta: -received,
          reason: 'transfer_out',
          transferId,
          idempotencyKey: `transfer-recv-out:${line.id}`,
        });
        const inbound = await move(tx, ctx, {
          variantId: line.variantId,
          warehouseId: transfer.toWarehouseId,
          delta: received,
          reason: 'transfer_in',
          transferId,
          idempotencyKey: `transfer-recv-in:${line.id}`,
          unitCostCents: cost.get(line.variantId)?.cost ?? null,
        });
        await tx.inventoryTransferLine.update({
          where: { id: line.id },
          data: { receiveMovementId: inbound.movementId || null },
        });
        legs.push({
          variantId: line.variantId,
          warehouseId: transfer.toWarehouseId,
          result: inbound,
          delta: inbound.appliedDelta,
          reason: 'transfer_in',
        });
      }
      const shortfall = line.quantity - received;
      if (shortfall > 0) {
        await move(tx, ctx, {
          variantId: line.variantId,
          warehouseId: inTransitId,
          delta: -shortfall,
          reason: 'loss',
          transferId,
          idempotencyKey: `transfer-shrink:${line.id}`,
          note: 'in-transit shrinkage',
        });
      }
      await tx.inventoryTransferLine.update({
        where: { id: line.id },
        data: { receivedQuantity: received },
      });
    }

    await tx.inventoryTransfer.update({
      where: { id: transferId },
      data: { status: 'received', receivedAt: new Date(), receivedBy: ctx.userId ?? null },
    });
    await audit(tx, ctx, transferId, 'inventory.transfer.received', {
      to: transfer.toWarehouseId,
      lineCount: lines.length,
    });
    return legs;
  });

  await emitLegEvents(ctx, events);
  await publishInventoryEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'inventory.transfer.received',
    data: { transferId, lines: events.length },
  });
  return getDetail(ctx, transferId);
}

// ─── Cancel (draft → void · in_transit → return to source) ────────────────────────

export async function cancelInventoryTransfer(
  ctx: ServiceContext,
  transferId: string
): Promise<InventoryTransferDetail> {
  // Resolve the in-transit warehouse up front (only needed for the return legs).
  const inTransitId = await ensureInTransitWarehouse(ctx);

  const events = await withTenant(ctx, async (tx) => {
    const transfer = await loadTransfer(tx, transferId);
    if (transfer.status === 'received' || transfer.status === 'cancelled') {
      throw new InventoryConflictError(
        `Cannot cancel a transfer while ${transfer.status}`,
        'status'
      );
    }

    const legs: LegEvent[] = [];
    if (transfer.status === 'in_transit') {
      const lines = await loadLines(tx, transferId);
      const cost = await levelMap(tx, inTransitId, lines);
      for (const line of lines) {
        if (line.receivedQuantity !== null) continue; // already received — nothing in transit
        await move(tx, ctx, {
          variantId: line.variantId,
          warehouseId: inTransitId,
          delta: -line.quantity,
          reason: 'transfer_out',
          transferId,
          idempotencyKey: `transfer-cancel-out:${line.id}`,
        });
        const back = await move(tx, ctx, {
          variantId: line.variantId,
          warehouseId: transfer.fromWarehouseId,
          delta: line.quantity,
          reason: 'transfer_in',
          transferId,
          idempotencyKey: `transfer-cancel-in:${line.id}`,
          unitCostCents: cost.get(line.variantId)?.cost ?? null,
        });
        legs.push({
          variantId: line.variantId,
          warehouseId: transfer.fromWarehouseId,
          result: back,
          delta: back.appliedDelta,
          reason: 'transfer_in',
        });
      }
    }

    await tx.inventoryTransfer.update({
      where: { id: transferId },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });
    await audit(tx, ctx, transferId, 'inventory.transfer.cancelled', {
      returnedToSource: legs.length,
    });
    return legs;
  });

  await emitLegEvents(ctx, events);
  return getDetail(ctx, transferId);
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

interface TransferHeader {
  id: string;
  status: string;
  fromWarehouseId: string;
  toWarehouseId: string;
}

async function loadTransfer(tx: TxClient, transferId: string): Promise<TransferHeader> {
  const transfer = await tx.inventoryTransfer.findFirst({
    where: { id: transferId },
    select: { id: true, status: true, fromWarehouseId: true, toWarehouseId: true },
  });
  if (!transfer) throw new InventoryNotFoundError('InventoryTransfer', transferId);
  return transfer;
}

async function loadLines(tx: TxClient, transferId: string): Promise<TransferLineLite[]> {
  return tx.inventoryTransferLine.findMany({
    where: { transferId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      variantId: true,
      quantity: true,
      receivedQuantity: true,
      shipMovementId: true,
    },
  });
}

interface LevelInfo {
  onHand: number;
  allocated: number;
  cost: number | null;
}

/** onHand/allocated/cost for the line variants at one warehouse. */
async function levelMap(
  tx: TxClient,
  warehouseId: string,
  lines: TransferLineLite[]
): Promise<Map<string, LevelInfo>> {
  const variantIds = lines.map((l) => l.variantId);
  const levels = await tx.inventoryLevel.findMany({
    where: { warehouseId, variantId: { in: variantIds } },
    select: {
      variantId: true,
      onHand: true,
      allocated: true,
      avgCostCents: true,
      unitCostCents: true,
    },
  });
  const map = new Map<string, LevelInfo>();
  for (const l of levels) {
    map.set(l.variantId, {
      onHand: l.onHand,
      allocated: l.allocated,
      cost: l.avgCostCents ?? l.unitCostCents ?? null,
    });
  }
  return map;
}

/** Each line's source warehouse must have enough AVAILABLE (not just on-hand). */
function assertAvailable(lines: TransferLineLite[], source: Map<string, LevelInfo>): void {
  for (const line of lines) {
    const lvl = source.get(line.variantId);
    const available = (lvl?.onHand ?? 0) - (lvl?.allocated ?? 0);
    if (!lvl || available < line.quantity) {
      throw new InventoryOutOfStockError(line.variantId, line.quantity, Math.max(0, available));
    }
  }
}

function assertOverrideLines(overrides: Map<string, number>, lines: TransferLineLite[]): void {
  const valid = new Set(lines.map((l) => l.id));
  for (const lineId of overrides.keys()) {
    if (!valid.has(lineId)) {
      throw new InventoryValidationError(
        'Received quantity references a line not on this transfer',
        [{ field: 'lines', message: `unknown line ${lineId}` }]
      );
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

interface MoveParams {
  variantId: string;
  warehouseId: string;
  delta: number;
  reason: string;
  transferId: string;
  idempotencyKey: string;
  unitCostCents?: number | null;
  note?: string;
}

function move(tx: TxClient, ctx: ServiceContext, params: MoveParams): Promise<MovementResult> {
  return applyMovement(tx, {
    tenantId: ctx.tenantId,
    variantId: params.variantId,
    warehouseId: params.warehouseId,
    delta: params.delta,
    reason: params.reason,
    referenceType: 'InventoryTransfer',
    referenceId: params.transferId,
    ...(params.unitCostCents != null ? { unitCostCents: params.unitCostCents } : {}),
    ...(params.note !== undefined ? { note: params.note } : {}),
    actorType: resolveActorType(ctx),
    actorId: ctx.userId ?? null,
    idempotencyKey: params.idempotencyKey,
  });
}

async function emitLegEvents(ctx: ServiceContext, legs: LegEvent[]): Promise<void> {
  for (const leg of legs) {
    if (leg.delta !== 0) {
      await emitStockEvents(ctx, leg.variantId, leg.warehouseId, leg.result, leg.delta, leg.reason);
    }
  }
}

function audit(
  tx: TxClient,
  ctx: ServiceContext,
  transferId: string,
  action: string,
  after: Record<string, unknown>
): Promise<void> {
  return writeAuditLog({
    tx,
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    actorType: ctx.userId ? 'user' : 'system',
    action,
    entityType: 'InventoryTransfer',
    entityId: transferId,
    diff: { after },
  });
}

function getDetail(ctx: ServiceContext, transferId: string): Promise<InventoryTransferDetail> {
  return withTenant(ctx, (tx) => loadTransferDetail(tx, transferId));
}
