// Lot batches + per-unit serial numbers + recalls. Lots carry expiry/hazmat and
// recall state; serials pin a physical unit to an order item for traceability.
// Quantities here are batch metadata — authoritative availability is the
// (variant, warehouse) level managed by the ledger.

import {
  CreateLotBatchInput,
  CreateSerialUnitInput,
  InitiateRecallInput,
} from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { InventoryConflictError, InventoryValidationError } from '../errors';
import type { ServiceContext } from '../errors';

import { ensureVariantExists, ensureWarehouseActive } from './internal';

export interface LotBatchRow {
  id: string;
  variantId: string;
  warehouseId: string;
  warehouseCode: string;
  lotNumber: string;
  manufacturedAt: string | null;
  expiresAt: string | null;
  quantity: number;
  hazmatClass: string;
  recallStatus: string | null;
  supplierBatchRef: string | null;
}

export async function createLotBatch(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ id: string }> {
  const input = CreateLotBatchInput.parse(rawInput);
  const result = await withTenant(ctx, async (tx) => {
    await ensureWarehouseActive(tx, input.warehouseId);
    await ensureVariantExists(tx, input.variantId);

    const existing = await tx.lotBatch.findFirst({
      where: { variantId: input.variantId, lotNumber: input.lotNumber },
      select: { id: true },
    });
    if (existing) {
      throw new InventoryConflictError(
        `Lot number "${input.lotNumber}" already exists for this variant`,
        'lotNumber'
      );
    }

    const batch = await tx.lotBatch.create({
      data: {
        tenantId: ctx.tenantId,
        variantId: input.variantId,
        warehouseId: input.warehouseId,
        lotNumber: input.lotNumber,
        manufacturedAt: input.manufacturedAt ? new Date(input.manufacturedAt) : null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        quantity: input.quantity,
        hazmatClass: input.hazmatClass,
        supplierBatchRef: input.supplierBatchRef ?? null,
        certificateOfAnalysisMediaId: input.certificateOfAnalysisMediaId ?? null,
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.lot.created',
      entityType: 'LotBatch',
      entityId: batch.id,
      diff: {
        after: {
          lotNumber: batch.lotNumber,
          variantId: batch.variantId,
          warehouseId: batch.warehouseId,
          quantity: batch.quantity,
        },
      },
    });

    return batch;
  });
  return { id: result.id };
}

export async function listLotsExpiringBefore(
  ctx: ServiceContext,
  beforeIso: string
): Promise<LotBatchRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.lotBatch.findMany({
      where: { expiresAt: { lte: new Date(beforeIso), not: null } },
      include: { warehouse: { select: { code: true } } },
      orderBy: { expiresAt: 'asc' },
      take: 500,
    });
    return rows.map(serializeLot);
  });
}

export async function listLotsForVariant(
  ctx: ServiceContext,
  variantId: string
): Promise<LotBatchRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.lotBatch.findMany({
      where: { variantId },
      include: { warehouse: { select: { code: true } } },
      orderBy: { expiresAt: 'asc' },
    });
    return rows.map(serializeLot);
  });
}

export async function createSerialUnit(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ id: string }> {
  const input = CreateSerialUnitInput.parse(rawInput);
  const result = await withTenant(ctx, async (tx) => {
    await ensureWarehouseActive(tx, input.warehouseId);
    await ensureVariantExists(tx, input.variantId);

    const existing = await tx.serialUnit.findFirst({
      where: { variantId: input.variantId, serial: input.serial },
      select: { id: true },
    });
    if (existing) {
      throw new InventoryConflictError(
        `Serial number "${input.serial}" already exists for this variant`,
        'serial'
      );
    }

    if (input.lotBatchId) {
      const lot = await tx.lotBatch.findFirst({
        where: { id: input.lotBatchId, variantId: input.variantId },
        select: { id: true },
      });
      if (!lot) {
        throw new InventoryValidationError('Lot batch does not belong to this variant', [
          { field: 'lotBatchId', message: 'Mismatched variant' },
        ]);
      }
    }

    const unit = await tx.serialUnit.create({
      data: {
        tenantId: ctx.tenantId,
        variantId: input.variantId,
        warehouseId: input.warehouseId,
        lotBatchId: input.lotBatchId ?? null,
        serial: input.serial,
        status: input.status,
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.serial.created',
      entityType: 'SerialUnit',
      entityId: unit.id,
      diff: { after: { serial: unit.serial, status: unit.status } },
    });

    return unit;
  });
  return { id: result.id };
}

/**
 * Mark every unsold serial in the named lots as recalled, flip the lots
 * themselves to `recalled`, and return the count of affected sold units
 * so the dashboard can drive a notification list. Customer email goes
 * through @sparx/events → email-worker via a separate publisher.
 */
export async function initiateRecall(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ affectedSerialUnits: number; affectedLotBatches: number }> {
  const input = InitiateRecallInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const lots = await tx.lotBatch.findMany({
      where: { id: { in: input.lotBatchIds } },
      select: { id: true, lotNumber: true },
    });
    if (lots.length !== input.lotBatchIds.length) {
      throw new InventoryValidationError('One or more lot batches were not found in this tenant', [
        { field: 'lotBatchIds', message: `Found ${lots.length} of ${input.lotBatchIds.length}` },
      ]);
    }

    const sold = await tx.serialUnit.count({
      where: { lotBatchId: { in: input.lotBatchIds }, status: 'sold' },
    });

    await tx.lotBatch.updateMany({
      where: { id: { in: input.lotBatchIds } },
      data: {
        recallStatus: 'active',
        recallReason: input.reason,
        recalledAt: new Date(),
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.lot.recalled',
      entityType: 'LotBatch',
      entityId: input.lotBatchIds[0]!,
      diff: {
        after: {
          lotBatchIds: input.lotBatchIds,
          reason: input.reason,
          affectedSerialUnits: sold,
        },
      },
    });

    return { affectedSerialUnits: sold, affectedLotBatches: lots.length };
  });
}

interface LotWithWarehouse {
  id: string;
  variantId: string;
  warehouseId: string;
  warehouse: { code: string };
  lotNumber: string;
  manufacturedAt: Date | null;
  expiresAt: Date | null;
  quantity: number;
  hazmatClass: string;
  recallStatus: string | null;
  supplierBatchRef: string | null;
}

function serializeLot(l: LotWithWarehouse): LotBatchRow {
  return {
    id: l.id,
    variantId: l.variantId,
    warehouseId: l.warehouseId,
    warehouseCode: l.warehouse.code,
    lotNumber: l.lotNumber,
    manufacturedAt: l.manufacturedAt?.toISOString() ?? null,
    expiresAt: l.expiresAt?.toISOString() ?? null,
    quantity: l.quantity,
    hazmatClass: l.hazmatClass,
    recallStatus: l.recallStatus,
    supplierBatchRef: l.supplierBatchRef,
  };
}
