// Inventory transfers (docs/100 P4) — the editable phase: create a transfer
// between two warehouses and compose its lines while it's a `draft`. Shipping,
// receiving, and cancelling live in ./inventory-transfer-lifecycle. A transfer
// moves stock through an in-transit holding location so total stock is conserved
// while units are in motion. Owned by @sparx/inventory; standalone-usable.

import {
  AddTransferLineInput,
  CreateInventoryTransferInput,
  UpdateTransferLineInput,
} from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import type { Prisma, TxClient } from '@sparx/db';

import { writeAuditLog } from '../audit';
import {
  InventoryConflictError,
  InventoryNotFoundError,
  InventoryValidationError,
} from '../errors';
import type { ServiceContext } from '../errors';

import { ensureVariantExists, ensureWarehouseActive } from './internal';
import {
  LIST_INCLUDE,
  isUniqueViolation,
  loadTransferDetail,
  nextTransferNumber,
  serializeRow,
} from './inventory-transfer-shared';
import type { InventoryTransferDetail, InventoryTransferRow } from './inventory-transfer-shared';

// ─── Queries ───────────────────────────────────────────────────────────────────

export async function listInventoryTransfers(
  ctx: ServiceContext,
  filter: {
    q?: string;
    status?: string;
    warehouseId?: string;
    take?: number;
    skip?: number;
  } = {}
): Promise<{ items: InventoryTransferRow[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const where: Prisma.InventoryTransferWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      // A warehouse filter matches either leg — stock leaving or arriving here.
      // AND'd (via separate keys, not merged into one OR) with the text search
      // below so the two conditions narrow independently rather than either
      // one satisfying the whole where clause.
      ...(filter.warehouseId
        ? {
            OR: [{ fromWarehouseId: filter.warehouseId }, { toWarehouseId: filter.warehouseId }],
          }
        : {}),
      ...(filter.q
        ? {
            AND: [
              {
                OR: [
                  { number: { contains: filter.q, mode: 'insensitive' } },
                  { fromWarehouse: { name: { contains: filter.q, mode: 'insensitive' } } },
                  { fromWarehouse: { code: { contains: filter.q, mode: 'insensitive' } } },
                  { toWarehouse: { name: { contains: filter.q, mode: 'insensitive' } } },
                  { toWarehouse: { code: { contains: filter.q, mode: 'insensitive' } } },
                ],
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      tx.inventoryTransfer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(filter.take ?? 50, 250),
        skip: filter.skip ?? 0,
        include: LIST_INCLUDE,
      }),
      tx.inventoryTransfer.count({ where }),
    ]);
    return { items: rows.map(serializeRow), total };
  });
}

export async function getInventoryTransfer(
  ctx: ServiceContext,
  id: string
): Promise<InventoryTransferDetail> {
  return withTenant(ctx, (tx) => loadTransferDetail(tx, id));
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createInventoryTransfer(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<InventoryTransferDetail> {
  const input = CreateInventoryTransferInput.parse(rawInput);
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new InventoryValidationError('Transfer source and destination must differ');
  }

  // The number is allocated count+1; a lost race trips the unique constraint and
  // poisons the pg tx, so the WHOLE attempt retries.
  let id: string | undefined;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      id = await createOnce(ctx, input);
      break;
    } catch (err) {
      if (isUniqueViolation(err) && attempt < 4) continue;
      throw err;
    }
  }
  if (!id) throw new InventoryValidationError('Could not allocate a transfer number');
  return getInventoryTransfer(ctx, id);
}

async function createOnce(
  ctx: ServiceContext,
  input: CreateInventoryTransferInput
): Promise<string> {
  return withTenant(ctx, async (tx) => {
    await ensureWarehouseActive(tx, input.fromWarehouseId);
    await ensureWarehouseActive(tx, input.toWarehouseId);
    await assertVariantsExist(
      tx,
      input.lines.map((l) => l.variantId)
    );

    const number = await nextTransferNumber(tx, ctx.tenantId);
    const transfer = await tx.inventoryTransfer.create({
      data: {
        tenantId: ctx.tenantId,
        number,
        fromWarehouseId: input.fromWarehouseId,
        toWarehouseId: input.toWarehouseId,
        status: 'draft',
        note: input.note ?? null,
      },
      select: { id: true, number: true },
    });

    if (input.lines.length > 0) {
      await tx.inventoryTransferLine.createMany({
        data: dedupeLines(input.lines).map((l) => ({
          tenantId: ctx.tenantId,
          transferId: transfer.id,
          variantId: l.variantId,
          quantity: l.quantity,
        })),
      });
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.transfer.created',
      entityType: 'InventoryTransfer',
      entityId: transfer.id,
      diff: {
        after: { number: transfer.number, lineCount: input.lines.length },
      },
    });

    return transfer.id;
  });
}

/** Collapse duplicate variant lines on create — last quantity wins (the unique
 *  (transfer, variant) constraint forbids two rows for one variant). */
function dedupeLines(
  lines: { variantId: string; quantity: number }[]
): { variantId: string; quantity: number }[] {
  const map = new Map<string, number>();
  for (const l of lines) map.set(l.variantId, l.quantity);
  return [...map.entries()].map(([variantId, quantity]) => ({ variantId, quantity }));
}

async function assertVariantsExist(tx: TxClient, variantIds: string[]): Promise<void> {
  for (const id of [...new Set(variantIds)]) await ensureVariantExists(tx, id);
}

// ─── Lines (draft only) ────────────────────────────────────────────────────────

export async function addTransferLine(
  ctx: ServiceContext,
  transferId: string,
  rawInput: unknown
): Promise<InventoryTransferDetail> {
  const input = AddTransferLineInput.parse(rawInput);
  await withTenant(ctx, async (tx) => {
    await loadTransferForEdit(tx, transferId);
    await ensureVariantExists(tx, input.variantId);

    const existing = await tx.inventoryTransferLine.findFirst({
      where: { transferId, variantId: input.variantId },
      select: { id: true },
    });
    if (existing) {
      throw new InventoryConflictError('That variant is already on the transfer', 'variantId');
    }

    await tx.inventoryTransferLine.create({
      data: {
        tenantId: ctx.tenantId,
        transferId,
        variantId: input.variantId,
        quantity: input.quantity,
      },
    });
  });
  return getInventoryTransfer(ctx, transferId);
}

export async function updateTransferLine(
  ctx: ServiceContext,
  transferId: string,
  lineId: string,
  rawInput: unknown
): Promise<InventoryTransferDetail> {
  const input = UpdateTransferLineInput.parse(rawInput);
  await withTenant(ctx, async (tx) => {
    await loadTransferForEdit(tx, transferId);
    const line = await tx.inventoryTransferLine.findFirst({
      where: { id: lineId, transferId },
      select: { id: true },
    });
    if (!line) throw new InventoryNotFoundError('InventoryTransferLine', lineId);
    await tx.inventoryTransferLine.update({
      where: { id: lineId },
      data: { quantity: input.quantity },
    });
  });
  return getInventoryTransfer(ctx, transferId);
}

export async function removeTransferLine(
  ctx: ServiceContext,
  transferId: string,
  lineId: string
): Promise<InventoryTransferDetail> {
  await withTenant(ctx, async (tx) => {
    await loadTransferForEdit(tx, transferId);
    const line = await tx.inventoryTransferLine.findFirst({
      where: { id: lineId, transferId },
      select: { id: true },
    });
    if (!line) throw new InventoryNotFoundError('InventoryTransferLine', lineId);
    await tx.inventoryTransferLine.delete({ where: { id: lineId } });
  });
  return getInventoryTransfer(ctx, transferId);
}

// ─── Delete (draft only) ───────────────────────────────────────────────────────

export async function deleteInventoryTransfer(
  ctx: ServiceContext,
  transferId: string
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const transfer = await loadTransferForEdit(tx, transferId);
    await tx.inventoryTransfer.delete({ where: { id: transfer.id } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.transfer.deleted',
      entityType: 'InventoryTransfer',
      entityId: transferId,
      diff: { before: { id: transferId } },
    });
  });
}

/** Load a transfer that must be in the editable `draft` state. */
async function loadTransferForEdit(
  tx: TxClient,
  transferId: string
): Promise<{ id: string; fromWarehouseId: string; toWarehouseId: string }> {
  const transfer = await tx.inventoryTransfer.findFirst({
    where: { id: transferId },
    select: { id: true, status: true, fromWarehouseId: true, toWarehouseId: true },
  });
  if (!transfer) throw new InventoryNotFoundError('InventoryTransfer', transferId);
  if (transfer.status !== 'draft') {
    throw new InventoryConflictError(
      `Cannot edit a transfer while ${transfer.status} — it has already shipped`,
      'status'
    );
  }
  return {
    id: transfer.id,
    fromWarehouseId: transfer.fromWarehouseId,
    toWarehouseId: transfer.toWarehouseId,
  };
}
