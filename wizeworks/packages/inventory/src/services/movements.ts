// Public stock-mutation API — manual adjustments and inter-warehouse transfers.
// Both are thin orchestrators over `applyMovement` (the ledger funnel): they
// validate input, run the movement(s) inside one transaction with an audit
// entry, and emit threshold events post-commit. They never touch onHand
// directly — the ledger is the only writer.

import { AdjustInventoryInput, TransferInventoryInput } from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { InventoryOutOfStockError, InventoryValidationError } from '../errors';
import type { ServiceContext } from '../errors';

import { ensureVariantExists, ensureWarehouseActive } from './internal';
import { applyMovement, emitStockEvents, resolveActorType } from './ledger';

export async function adjust(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ newOnHand: number; newAvailable: number; deduped: boolean }> {
  const input = AdjustInventoryInput.parse(rawInput);

  const result = await withTenant(ctx, async (tx) => {
    await ensureWarehouseActive(tx, input.warehouseId);
    await ensureVariantExists(tx, input.variantId);

    const r = await applyMovement(tx, {
      tenantId: ctx.tenantId,
      variantId: input.variantId,
      warehouseId: input.warehouseId,
      delta: input.delta,
      reason: input.reason,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      note: input.note ?? null,
      unitCostCents: input.unitCostCents ?? null,
      actorType: resolveActorType(ctx, input.actorType),
      actorId: input.actorId ?? ctx.userId ?? null,
      source: input.source ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      ...(input.binId ? { binId: input.binId } : {}),
    });

    if (!r.deduped) {
      await writeAuditLog({
        tx,
        tenantId: ctx.tenantId,
        actorId: ctx.userId ?? null,
        actorType: ctx.userId ? 'user' : 'system',
        action: 'inventory.adjusted',
        entityType: 'InventoryLevel',
        // An inventory level is keyed by (variant, warehouse), but entity_id is a
        // single UUID column — use the variant and carry the warehouse in the diff.
        entityId: input.variantId,
        diff: {
          before: { onHand: r.onHand - input.delta },
          after: { onHand: r.onHand, allocated: r.allocated, warehouseId: input.warehouseId },
        },
      });
    }

    return r;
  });

  if (!result.deduped) {
    await emitStockEvents(
      ctx,
      input.variantId,
      input.warehouseId,
      result,
      input.delta,
      input.reason
    );
  }

  return { newOnHand: result.onHand, newAvailable: result.available, deduped: result.deduped };
}

export async function transfer(ctx: ServiceContext, rawInput: unknown): Promise<void> {
  const input = TransferInventoryInput.parse(rawInput);
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new InventoryValidationError('Transfer source and destination must differ');
  }

  // Both legs in one tx so the ledger records both and total stock is invariant.
  const legs = await withTenant(ctx, async (tx) => {
    await ensureWarehouseActive(tx, input.fromWarehouseId);
    await ensureWarehouseActive(tx, input.toWarehouseId);
    await ensureVariantExists(tx, input.variantId);

    // Source must have enough AVAILABLE (not just on-hand) to cover the move.
    const source = await tx.inventoryLevel.findUnique({
      where: {
        variantId_warehouseId: {
          variantId: input.variantId,
          warehouseId: input.fromWarehouseId,
        },
      },
    });
    const sourceAvailable = (source?.onHand ?? 0) - (source?.allocated ?? 0);
    if (!source || sourceAvailable < input.quantity) {
      throw new InventoryOutOfStockError(
        input.variantId,
        input.quantity,
        Math.max(0, sourceAvailable)
      );
    }

    const actorType = resolveActorType(ctx);
    const actorId = ctx.userId ?? null;
    const note = input.note ?? null;

    const out = await applyMovement(tx, {
      tenantId: ctx.tenantId,
      variantId: input.variantId,
      warehouseId: input.fromWarehouseId,
      delta: -input.quantity,
      reason: 'transfer_out',
      referenceType: 'Warehouse',
      referenceId: input.toWarehouseId,
      note,
      actorType,
      actorId,
    });

    const inbound = await applyMovement(tx, {
      tenantId: ctx.tenantId,
      variantId: input.variantId,
      warehouseId: input.toWarehouseId,
      delta: input.quantity,
      reason: 'transfer_in',
      referenceType: 'Warehouse',
      referenceId: input.fromWarehouseId,
      note,
      // Carry the source's cost basis so total inventory value is invariant
      // across the move.
      unitCostCents: source.avgCostCents ?? source.unitCostCents ?? null,
      actorType,
      actorId,
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.transferred',
      entityType: 'InventoryLevel',
      entityId: input.variantId,
      diff: {
        after: {
          from: input.fromWarehouseId,
          to: input.toWarehouseId,
          quantity: input.quantity,
        },
      },
    });

    return { out, inbound };
  });

  await emitStockEvents(
    ctx,
    input.variantId,
    input.fromWarehouseId,
    legs.out,
    -input.quantity,
    'transfer_out'
  );
  await emitStockEvents(
    ctx,
    input.variantId,
    input.toWarehouseId,
    legs.inbound,
    input.quantity,
    'transfer_in'
  );
}
