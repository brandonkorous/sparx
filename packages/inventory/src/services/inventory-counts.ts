// Inventory counts (docs/100 P4) — the editable phase: create a counting session,
// add/remove lines, and enter counted quantities. A count is scoped to one
// warehouse; each line snapshots the expected on-hand at line creation. The
// lifecycle (submit → approve → post → recount movements) lives in
// ./inventory-count-lifecycle. Owned by @sparx/inventory; standalone-usable.

import {
  AddCountLineInput,
  CreateInventoryCountInput,
  EnterCountsInput,
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
  loadCountDetail,
  nextCountNumber,
  serializeRow,
} from './inventory-count-shared';
import type { InventoryCountDetail, InventoryCountRow } from './inventory-count-shared';

// ─── Queries ───────────────────────────────────────────────────────────────────

export async function listInventoryCounts(
  ctx: ServiceContext,
  filter: { status?: string; warehouseId?: string; take?: number; skip?: number } = {}
): Promise<{ items: InventoryCountRow[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const where: Prisma.InventoryCountWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
    };
    const [rows, total] = await Promise.all([
      tx.inventoryCount.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(filter.take ?? 50, 250),
        skip: filter.skip ?? 0,
        include: LIST_INCLUDE,
      }),
      tx.inventoryCount.count({ where }),
    ]);
    return { items: rows.map(serializeRow), total };
  });
}

export async function getInventoryCount(
  ctx: ServiceContext,
  id: string
): Promise<InventoryCountDetail> {
  return withTenant(ctx, (tx) => loadCountDetail(tx, id));
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createInventoryCount(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<InventoryCountDetail> {
  const input = CreateInventoryCountInput.parse(rawInput);

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
  if (!id) throw new InventoryValidationError('Could not allocate an inventory-count number');
  return getInventoryCount(ctx, id);
}

async function createOnce(ctx: ServiceContext, input: CreateInventoryCountInput): Promise<string> {
  return withTenant(ctx, async (tx) => {
    await ensureWarehouseActive(tx, input.warehouseId);
    const lines = await buildInitialLines(tx, input);

    const number = await nextCountNumber(tx, ctx.tenantId);
    const count = await tx.inventoryCount.create({
      data: {
        tenantId: ctx.tenantId,
        number,
        warehouseId: input.warehouseId,
        type: input.type,
        status: 'counting',
        note: input.note ?? null,
        ...(input.approvalThresholdCents !== undefined
          ? { approvalThresholdCents: input.approvalThresholdCents }
          : {}),
      },
      select: { id: true, number: true },
    });

    if (lines.length > 0) {
      await tx.inventoryCountLine.createMany({
        data: lines.map((l) => ({
          tenantId: ctx.tenantId,
          countId: count.id,
          variantId: l.variantId,
          expectedQuantity: l.expected,
        })),
      });
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.count.created',
      entityType: 'InventoryCount',
      entityId: count.id,
      diff: { after: { number: count.number, type: input.type, lineCount: lines.length } },
    });

    return count.id;
  });
}

/** Snapshot the expected on-hand for the count's lines: every live level in the
 *  warehouse for a `full` count, or the given variants for a `cycle` count. */
async function buildInitialLines(
  tx: TxClient,
  input: CreateInventoryCountInput
): Promise<{ variantId: string; expected: number }[]> {
  if (input.type === 'full') {
    const levels = await tx.inventoryLevel.findMany({
      where: { warehouseId: input.warehouseId, variant: { deletedAt: null } },
      select: { variantId: true, onHand: true },
    });
    return levels.map((l) => ({ variantId: l.variantId, expected: l.onHand }));
  }

  const variantIds = [...new Set(input.variantIds ?? [])];
  if (variantIds.length === 0) return [];
  const variants = await tx.productVariant.findMany({
    where: { id: { in: variantIds }, deletedAt: null },
    select: { id: true },
  });
  const found = new Set(variants.map((v) => v.id));
  for (const id of variantIds) {
    if (!found.has(id)) {
      throw new InventoryValidationError('Unknown variant on the count', [
        { field: 'variantIds', message: `unknown variant ${id}` },
      ]);
    }
  }
  const levels = await tx.inventoryLevel.findMany({
    where: { warehouseId: input.warehouseId, variantId: { in: variantIds } },
    select: { variantId: true, onHand: true },
  });
  const onHand = new Map(levels.map((l) => [l.variantId, l.onHand]));
  return variantIds.map((variantId) => ({ variantId, expected: onHand.get(variantId) ?? 0 }));
}

// ─── Lines (counting phase only) ─────────────────────────────────────────────

export async function addCountLine(
  ctx: ServiceContext,
  countId: string,
  rawInput: unknown
): Promise<InventoryCountDetail> {
  const input = AddCountLineInput.parse(rawInput);
  await withTenant(ctx, async (tx) => {
    const count = await loadCountForEdit(tx, countId);
    await ensureVariantExists(tx, input.variantId);

    const existing = await tx.inventoryCountLine.findFirst({
      where: { countId, variantId: input.variantId },
      select: { id: true },
    });
    if (existing) {
      throw new InventoryConflictError('That variant is already on the count', 'variantId');
    }

    const level = await tx.inventoryLevel.findUnique({
      where: {
        variantId_warehouseId: { variantId: input.variantId, warehouseId: count.warehouseId },
      },
      select: { onHand: true },
    });
    await tx.inventoryCountLine.create({
      data: {
        tenantId: ctx.tenantId,
        countId,
        variantId: input.variantId,
        expectedQuantity: level?.onHand ?? 0,
      },
    });
  });
  return getInventoryCount(ctx, countId);
}

export async function removeCountLine(
  ctx: ServiceContext,
  countId: string,
  lineId: string
): Promise<InventoryCountDetail> {
  await withTenant(ctx, async (tx) => {
    await loadCountForEdit(tx, countId);
    const line = await tx.inventoryCountLine.findFirst({
      where: { id: lineId, countId },
      select: { id: true },
    });
    if (!line) throw new InventoryNotFoundError('InventoryCountLine', lineId);
    await tx.inventoryCountLine.delete({ where: { id: lineId } });
  });
  return getInventoryCount(ctx, countId);
}

export async function enterCounts(
  ctx: ServiceContext,
  countId: string,
  rawInput: unknown
): Promise<InventoryCountDetail> {
  const input = EnterCountsInput.parse(rawInput);
  await withTenant(ctx, async (tx) => {
    await loadCountForEdit(tx, countId);
    const lines = await tx.inventoryCountLine.findMany({
      where: { countId },
      select: { id: true },
    });
    const valid = new Set(lines.map((l) => l.id));
    for (const e of input.entries) {
      if (!valid.has(e.lineId)) {
        throw new InventoryValidationError('Entry references a line not on this count', [
          { field: 'entries', message: `unknown line ${e.lineId}` },
        ]);
      }
    }
    for (const e of input.entries) {
      await tx.inventoryCountLine.update({
        where: { id: e.lineId },
        data: {
          countedQuantity: e.countedQuantity,
          ...(e.note !== undefined ? { note: e.note } : {}),
        },
      });
    }
  });
  return getInventoryCount(ctx, countId);
}

/** Load a count that must be in the editable `counting` state. */
async function loadCountForEdit(
  tx: TxClient,
  countId: string
): Promise<{ id: string; warehouseId: string }> {
  const count = await tx.inventoryCount.findFirst({
    where: { id: countId },
    select: { id: true, status: true, warehouseId: true },
  });
  if (!count) throw new InventoryNotFoundError('InventoryCount', countId);
  if (count.status !== 'counting') {
    throw new InventoryConflictError(
      `Cannot edit a count while ${count.status} — it is no longer being counted`,
      'status'
    );
  }
  return { id: count.id, warehouseId: count.warehouseId };
}
