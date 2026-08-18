// Inventory transfers (docs/100 P4) — shared row shapes, query includes, the
// per-tenant number allocator, the in-transit-warehouse provisioner, and the
// detail loader. Split out so the CRUD/lines module (./inventory-transfers) and
// the lifecycle module (./inventory-transfer-lifecycle) share one serializer +
// detail shape.

import { Prisma, withTenant } from '@wizeworks/db';
import type { TxClient } from '@wizeworks/db';

import { InventoryNotFoundError, InventoryValidationError } from '../errors';
import type { ServiceContext } from '../errors';

// ─── Row shapes ────────────────────────────────────────────────────────────────

export interface InventoryTransferLineRow {
  id: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  quantity: number;
  /** Units actually received at the destination; null until the transfer is received. */
  receivedQuantity: number | null;
  shipMovementId: string | null;
  receiveMovementId: string | null;
  note: string | null;
}

export interface InventoryTransferRow {
  id: string;
  number: string;
  fromWarehouseId: string;
  fromWarehouseName: string | null;
  fromWarehouseCode: string | null;
  toWarehouseId: string;
  toWarehouseName: string | null;
  toWarehouseCode: string | null;
  status: 'draft' | 'in_transit' | 'received' | 'cancelled';
  note: string | null;
  lineCount: number;
  totalQuantity: number;
  shippedAt: string | null;
  shippedBy: string | null;
  receivedAt: string | null;
  receivedBy: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export interface InventoryTransferDetail extends InventoryTransferRow {
  lines: InventoryTransferLineRow[];
}

const FROM = { select: { name: true, code: true } };
const TO = { select: { name: true, code: true } };

export const LIST_INCLUDE = {
  fromWarehouse: FROM,
  toWarehouse: TO,
  lines: { select: { quantity: true } },
} satisfies Prisma.InventoryTransferInclude;

export const DETAIL_INCLUDE = {
  fromWarehouse: FROM,
  toWarehouse: TO,
  lines: {
    orderBy: { createdAt: 'asc' },
    include: {
      variant: { select: { sku: true, product: { select: { title: true } } } },
    },
  },
} satisfies Prisma.InventoryTransferInclude;

type TransferWithLineQtys = Prisma.InventoryTransferGetPayload<{ include: typeof LIST_INCLUDE }>;
type TransferWithLines = Prisma.InventoryTransferGetPayload<{ include: typeof DETAIL_INCLUDE }>;

// ─── Helpers ───────────────────────────────────────────────────────────────────

export const IN_TRANSIT_NAME = 'In transit';

export async function nextTransferNumber(tx: TxClient, tenantId: string): Promise<string> {
  const count = await tx.inventoryTransfer.count({ where: { tenantId } });
  return `TRF-${(count + 1).toString().padStart(6, '0')}`;
}

export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/**
 * Find-or-create the tenant's single in-transit holding warehouse — the location
 * shipped units sit in between leaving the source and arriving at the destination,
 * so total stock is conserved while in motion. Runs each attempt in its own tx so a
 * unique-violation (a concurrent ship racing the create, or a pre-existing user
 * warehouse owning the candidate code) poisons only that attempt; the next attempt
 * re-finds the now-committed system warehouse.
 */
export async function ensureInTransitWarehouse(ctx: ServiceContext): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = attempt === 0 ? 'IN-TRANSIT' : `IN-TRANSIT-${attempt}`;
    const result = await withTenant(ctx, async (tx) => {
      const existing = await tx.warehouse.findFirst({
        where: { isSystem: true, deletedAt: null },
        select: { id: true },
      });
      if (existing) return existing.id;
      const created = await tx.warehouse.create({
        data: {
          tenantId: ctx.tenantId,
          name: IN_TRANSIT_NAME,
          code,
          type: 'virtual',
          isSystem: true,
        },
        select: { id: true },
      });
      return created.id;
    }).catch((err: unknown) => {
      // A lost race (another writer created it) or a code collision — retry; the
      // next attempt's find sees the committed row or tries the next code.
      if (isUniqueViolation(err)) return null;
      throw err;
    });
    if (result) return result;
  }
  throw new InventoryValidationError('Could not provision an in-transit location');
}

export async function loadTransferDetail(
  tx: TxClient,
  id: string
): Promise<InventoryTransferDetail> {
  const row = await tx.inventoryTransfer.findFirst({ where: { id }, include: DETAIL_INCLUDE });
  if (!row) throw new InventoryNotFoundError('InventoryTransfer', id);
  return serializeDetail(row);
}

// ─── Serializers ─────────────────────────────────────────────────────────────

export function serializeRow(r: TransferWithLineQtys): InventoryTransferRow {
  return {
    id: r.id,
    number: r.number,
    fromWarehouseId: r.fromWarehouseId,
    fromWarehouseName: r.fromWarehouse?.name ?? null,
    fromWarehouseCode: r.fromWarehouse?.code ?? null,
    toWarehouseId: r.toWarehouseId,
    toWarehouseName: r.toWarehouse?.name ?? null,
    toWarehouseCode: r.toWarehouse?.code ?? null,
    status: r.status as InventoryTransferRow['status'],
    note: r.note,
    lineCount: r.lines.length,
    totalQuantity: r.lines.reduce((sum, l) => sum + l.quantity, 0),
    shippedAt: r.shippedAt?.toISOString() ?? null,
    shippedBy: r.shippedBy,
    receivedAt: r.receivedAt?.toISOString() ?? null,
    receivedBy: r.receivedBy,
    cancelledAt: r.cancelledAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

export function serializeDetail(r: TransferWithLines): InventoryTransferDetail {
  const base = serializeRow({ ...r, lines: r.lines.map((l) => ({ quantity: l.quantity })) });
  return {
    ...base,
    lines: r.lines.map((l) => ({
      id: l.id,
      variantId: l.variantId,
      variantSku: l.variant?.sku ?? null,
      productTitle: l.variant?.product?.title ?? null,
      quantity: l.quantity,
      receivedQuantity: l.receivedQuantity,
      shipMovementId: l.shipMovementId,
      receiveMovementId: l.receiveMovementId,
      note: l.note,
    })),
  };
}
