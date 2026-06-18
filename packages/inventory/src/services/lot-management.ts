// Lot/serial management reads + status mutations (docs/100 P4d). The basic
// primitives (create lot, create serial, initiate recall, expiring feed) live in
// ./lots; this module adds the management surface the dashboard needs — a
// filterable lot list, a lot detail with its serial roster, per-serial status
// changes, and clearing a recall. Lot/serial quantities are traceability
// metadata; authoritative on-hand stays on the (variant, warehouse) level.

import { UpdateSerialStatusInput } from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import type { Prisma } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { InventoryConflictError, InventoryNotFoundError } from '../errors';
import type { ServiceContext } from '../errors';

// ─── Row shapes ────────────────────────────────────────────────────────────────

export interface LotRow {
  id: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  warehouseId: string;
  warehouseCode: string | null;
  warehouseName: string | null;
  lotNumber: string;
  manufacturedAt: string | null;
  expiresAt: string | null;
  quantity: number;
  hazmatClass: string;
  recallStatus: string | null;
  recallReason: string | null;
  recalledAt: string | null;
  supplierBatchRef: string | null;
  serialCount: number;
  createdAt: string;
}

export interface LotDetail extends LotRow {
  /** Serial roster broken down by status (in_stock / sold / scrapped / …). */
  serialCounts: { status: string; count: number }[];
}

export interface SerialRow {
  id: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  warehouseId: string;
  warehouseCode: string | null;
  lotBatchId: string | null;
  lotNumber: string | null;
  serial: string;
  status: string;
  soldOnOrderItemId: string | null;
  soldAt: string | null;
  createdAt: string;
}

const LOT_INCLUDE = {
  variant: { select: { sku: true, product: { select: { title: true } } } },
  warehouse: { select: { code: true, name: true } },
  _count: { select: { serialUnits: true } },
} satisfies Prisma.LotBatchInclude;

const SERIAL_INCLUDE = {
  variant: { select: { sku: true, product: { select: { title: true } } } },
  warehouse: { select: { code: true } },
  lotBatch: { select: { lotNumber: true } },
} satisfies Prisma.SerialUnitInclude;

type LotWith = Prisma.LotBatchGetPayload<{ include: typeof LOT_INCLUDE }>;
type SerialWith = Prisma.SerialUnitGetPayload<{ include: typeof SERIAL_INCLUDE }>;

// ─── Lots ────────────────────────────────────────────────────────────────────

export interface ListLotsFilter {
  variantId?: string;
  warehouseId?: string;
  recallStatus?: string;
  /** When set, only lots that expire on/before this ISO instant (and have an expiry). */
  expiringBefore?: string;
  /** Lot-number contains (case-insensitive). */
  q?: string;
  take?: number;
  skip?: number;
}

export async function listLots(
  ctx: ServiceContext,
  filter: ListLotsFilter = {}
): Promise<{ items: LotRow[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    // Scope tenant_id explicitly — the local superuser bypasses RLS (see the
    // movement-log / reorder precedent); defense-in-depth in prod.
    const where: Prisma.LotBatchWhereInput = {
      tenantId: ctx.tenantId,
      ...(filter.variantId ? { variantId: filter.variantId } : {}),
      ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
      ...(filter.recallStatus ? { recallStatus: filter.recallStatus } : {}),
      ...(filter.expiringBefore
        ? { expiresAt: { not: null, lte: new Date(filter.expiringBefore) } }
        : {}),
      ...(filter.q ? { lotNumber: { contains: filter.q, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      tx.lotBatch.findMany({
        where,
        orderBy: [{ recallStatus: 'desc' }, { expiresAt: 'asc' }, { createdAt: 'desc' }],
        take: Math.min(filter.take ?? 50, 250),
        skip: filter.skip ?? 0,
        include: LOT_INCLUDE,
      }),
      tx.lotBatch.count({ where }),
    ]);
    return { items: rows.map(serializeLot), total };
  });
}

export async function getLotBatch(ctx: ServiceContext, id: string): Promise<LotDetail> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.lotBatch.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: LOT_INCLUDE,
    });
    if (!row) throw new InventoryNotFoundError('LotBatch', id);
    const grouped = await tx.serialUnit.groupBy({
      by: ['status'],
      where: { lotBatchId: id, tenantId: ctx.tenantId },
      _count: { _all: true },
    });
    return {
      ...serializeLot(row),
      serialCounts: grouped.map((g) => ({ status: g.status, count: g._count._all })),
    };
  });
}

// ─── Serials ───────────────────────────────────────────────────────────────────

export interface ListSerialsFilter {
  lotBatchId?: string;
  variantId?: string;
  warehouseId?: string;
  status?: string;
  q?: string;
  take?: number;
  skip?: number;
}

export async function listSerials(
  ctx: ServiceContext,
  filter: ListSerialsFilter = {}
): Promise<{ items: SerialRow[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const where: Prisma.SerialUnitWhereInput = {
      tenantId: ctx.tenantId,
      ...(filter.lotBatchId ? { lotBatchId: filter.lotBatchId } : {}),
      ...(filter.variantId ? { variantId: filter.variantId } : {}),
      ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.q ? { serial: { contains: filter.q, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      tx.serialUnit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(filter.take ?? 100, 500),
        skip: filter.skip ?? 0,
        include: SERIAL_INCLUDE,
      }),
      tx.serialUnit.count({ where }),
    ]);
    return { items: rows.map(serializeSerial), total };
  });
}

export async function updateSerialStatus(
  ctx: ServiceContext,
  serialId: string,
  rawInput: unknown
): Promise<SerialRow> {
  const input = UpdateSerialStatusInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const before = await tx.serialUnit.findFirst({
      where: { id: serialId, tenantId: ctx.tenantId },
      select: { id: true, status: true },
    });
    if (!before) throw new InventoryNotFoundError('SerialUnit', serialId);

    const updated = await tx.serialUnit.update({
      where: { id: serialId },
      data: { status: input.status },
      include: SERIAL_INCLUDE,
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.serial.status_changed',
      entityType: 'SerialUnit',
      entityId: serialId,
      diff: { before: { status: before.status }, after: { status: input.status } },
    });
    return serializeSerial(updated);
  });
}

// ─── Recall lifecycle ──────────────────────────────────────────────────────────

/** Clear an active/pending recall on a lot (sets `recall_status` = 'cleared'). */
export async function clearRecall(ctx: ServiceContext, lotId: string): Promise<LotDetail> {
  await withTenant(ctx, async (tx) => {
    const lot = await tx.lotBatch.findFirst({
      where: { id: lotId, tenantId: ctx.tenantId },
      select: { id: true, recallStatus: true },
    });
    if (!lot) throw new InventoryNotFoundError('LotBatch', lotId);
    if (lot.recallStatus !== 'active' && lot.recallStatus !== 'pending') {
      throw new InventoryConflictError('This lot has no open recall to clear', 'recallStatus');
    }
    await tx.lotBatch.update({ where: { id: lotId }, data: { recallStatus: 'cleared' } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.lot.recall_cleared',
      entityType: 'LotBatch',
      entityId: lotId,
      diff: { before: { recallStatus: lot.recallStatus }, after: { recallStatus: 'cleared' } },
    });
  });
  return getLotBatch(ctx, lotId);
}

// ─── Serializers ─────────────────────────────────────────────────────────────

function serializeLot(l: LotWith): LotRow {
  return {
    id: l.id,
    variantId: l.variantId,
    variantSku: l.variant?.sku ?? null,
    productTitle: l.variant?.product?.title ?? null,
    warehouseId: l.warehouseId,
    warehouseCode: l.warehouse?.code ?? null,
    warehouseName: l.warehouse?.name ?? null,
    lotNumber: l.lotNumber,
    manufacturedAt: l.manufacturedAt?.toISOString() ?? null,
    expiresAt: l.expiresAt?.toISOString() ?? null,
    quantity: l.quantity,
    hazmatClass: l.hazmatClass,
    recallStatus: l.recallStatus,
    recallReason: l.recallReason,
    recalledAt: l.recalledAt?.toISOString() ?? null,
    supplierBatchRef: l.supplierBatchRef,
    serialCount: l._count.serialUnits,
    createdAt: l.createdAt.toISOString(),
  };
}

function serializeSerial(s: SerialWith): SerialRow {
  return {
    id: s.id,
    variantId: s.variantId,
    variantSku: s.variant?.sku ?? null,
    productTitle: s.variant?.product?.title ?? null,
    warehouseId: s.warehouseId,
    warehouseCode: s.warehouse?.code ?? null,
    lotBatchId: s.lotBatchId,
    lotNumber: s.lotBatch?.lotNumber ?? null,
    serial: s.serial,
    status: s.status,
    soldOnOrderItemId: s.soldOnOrderItemId,
    soldAt: s.soldAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  };
}
