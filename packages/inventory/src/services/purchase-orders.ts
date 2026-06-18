// Purchase orders — CRUD + queries (docs/100 P3b). A PO is the inbound order:
// who we're buying from (supplier), where it lands (warehouse), and what
// (lines). Created as a `draft`, edited freely while draft, then submitted
// (lifecycle.ts); receiving (P3c) drives partial/received. Line mutations live
// in ./purchase-order-lines; transitions in ./purchase-order-lifecycle; both
// build on ./purchase-order-shared, as does this file.

import { CreatePurchaseOrderInput, UpdatePurchaseOrderInput } from '@sparx/commerce-schemas';
import type { PurchaseOrderLineInput } from '@sparx/commerce-schemas';
import { Prisma, withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { InventoryNotFoundError, InventoryValidationError } from '../errors';
import type { ServiceContext } from '../errors';

import {
  assertStatus,
  ensurePurchaseOrder,
  LIST_INCLUDE,
  loadPurchaseOrderDetail,
  nextPurchaseOrderNumber,
  recomputeTotals,
  resolveLineData,
  serializePurchaseOrderRow,
} from './purchase-order-shared';
import type { PurchaseOrderDetail, PurchaseOrderRow } from './purchase-order-shared';

export interface ListPurchaseOrderFilter {
  status?: string;
  supplierId?: string;
  search?: string;
  take?: number;
  skip?: number;
}

export async function listPurchaseOrders(
  ctx: ServiceContext,
  filter: ListPurchaseOrderFilter = {}
): Promise<{ items: PurchaseOrderRow[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const where: Prisma.PurchaseOrderWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.supplierId ? { supplierId: filter.supplierId } : {}),
      ...(filter.search
        ? {
            OR: [
              { number: { contains: filter.search, mode: 'insensitive' } },
              { reference: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      tx.purchaseOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(filter.take ?? 50, 250),
        skip: filter.skip ?? 0,
        include: LIST_INCLUDE,
      }),
      tx.purchaseOrder.count({ where }),
    ]);
    return { items: rows.map(serializePurchaseOrderRow), total };
  });
}

export async function getPurchaseOrder(
  ctx: ServiceContext,
  id: string
): Promise<PurchaseOrderDetail> {
  return withTenant(ctx, (tx) => loadPurchaseOrderDetail(tx, id));
}

export async function createPurchaseOrder(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<PurchaseOrderDetail> {
  const input = CreatePurchaseOrderInput.parse(rawInput);
  assertNoDuplicateVariants(input.lines);

  // The PO number is allocated count+1; a lost race trips the unique constraint.
  // A failed statement poisons the Postgres tx, so the WHOLE attempt retries.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await createOnce(ctx, input);
    } catch (err) {
      if (isUniqueViolation(err) && attempt < 4) continue;
      throw err;
    }
  }
  throw new InventoryValidationError('Could not allocate a purchase-order number');
}

async function createOnce(
  ctx: ServiceContext,
  input: CreatePurchaseOrderInput
): Promise<PurchaseOrderDetail> {
  return withTenant(ctx, (tx) => createPurchaseOrderOnTx(tx, ctx, input));
}

/** The PO-creation core, on a caller-supplied transaction. Exposed so callers
 *  that already own a tenant tx (the reorder engine drafting inside the
 *  automation run's transaction) create a PO without nesting `withTenant`. The
 *  number-collision retry lives in `createPurchaseOrder` (whole-tx), so a caller
 *  on a shared tx that hits the (tenant, number) unique constraint surfaces the
 *  P2002 for its own delivery layer to retry — single-supplier auto-draft is
 *  low-contention, so a lost race here is rare. */
export async function createPurchaseOrderOnTx(
  tx: TxClient,
  ctx: ServiceContext,
  input: CreatePurchaseOrderInput
): Promise<PurchaseOrderDetail> {
  const supplier = await tx.supplier.findFirst({
    where: { id: input.supplierId, deletedAt: null },
    select: { id: true, paymentTerms: true },
  });
  if (!supplier) throw new InventoryNotFoundError('Supplier', input.supplierId);
  const warehouse = await tx.warehouse.findFirst({
    where: { id: input.warehouseId, deletedAt: null },
    select: { id: true },
  });
  if (!warehouse) throw new InventoryNotFoundError('Warehouse', input.warehouseId);

  const lineData = await Promise.all(
    input.lines.map((line) => resolveLineData(tx, input.supplierId, line))
  );

  const number = await nextPurchaseOrderNumber(tx, ctx.tenantId);
  const po = await tx.purchaseOrder.create({
    data: {
      tenantId: ctx.tenantId,
      number,
      status: 'draft',
      supplierId: input.supplierId,
      warehouseId: input.warehouseId,
      currency: input.currency,
      paymentTerms: input.paymentTerms ?? supplier.paymentTerms ?? null,
      reference: input.reference ?? null,
      expectedArrivalAt: input.expectedArrivalAt ? new Date(input.expectedArrivalAt) : null,
      shippingCents: input.shippingCents,
      notes: input.notes ?? null,
    },
    select: { id: true, number: true },
  });

  if (lineData.length > 0) {
    await tx.purchaseOrderLine.createMany({
      data: lineData.map((d) => ({ tenantId: ctx.tenantId, purchaseOrderId: po.id, ...d })),
    });
  }
  await recomputeTotals(tx, po.id);

  await writeAuditLog({
    tx,
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    actorType: ctx.userId ? 'user' : 'system',
    action: 'inventory.purchase_order.created',
    entityType: 'PurchaseOrder',
    entityId: po.id,
    diff: {
      after: { number: po.number, supplierId: input.supplierId, lineCount: lineData.length },
    },
  });

  return loadPurchaseOrderDetail(tx, po.id);
}

export async function updatePurchaseOrder(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<PurchaseOrderDetail> {
  const input = UpdatePurchaseOrderInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const po = await ensurePurchaseOrder(tx, id);
    assertStatus(po, ['draft'], 'edited');

    if (input.warehouseId !== undefined && input.warehouseId !== po.warehouseId) {
      const wh = await tx.warehouse.findFirst({
        where: { id: input.warehouseId, deletedAt: null },
        select: { id: true },
      });
      if (!wh) throw new InventoryNotFoundError('Warehouse', input.warehouseId);
    }

    await tx.purchaseOrder.update({
      where: { id },
      data: {
        ...(input.warehouseId !== undefined ? { warehouseId: input.warehouseId } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.paymentTerms !== undefined ? { paymentTerms: input.paymentTerms } : {}),
        ...(input.reference !== undefined ? { reference: input.reference } : {}),
        ...(input.expectedArrivalAt !== undefined
          ? {
              expectedArrivalAt: input.expectedArrivalAt ? new Date(input.expectedArrivalAt) : null,
            }
          : {}),
        ...(input.shippingCents !== undefined ? { shippingCents: input.shippingCents } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
    if (input.shippingCents !== undefined) await recomputeTotals(tx, id);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.purchase_order.updated',
      entityType: 'PurchaseOrder',
      entityId: id,
      diff: { after: { id } },
    });

    return loadPurchaseOrderDetail(tx, id);
  });
}

/** Hard-delete a DRAFT PO (cascades its lines). Submitted+ POs are cancelled, not
 *  deleted (lifecycle.ts), so the audit/number trail of a real order survives. */
export async function deletePurchaseOrder(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const po = await ensurePurchaseOrder(tx, id);
    assertStatus(po, ['draft'], 'deleted');
    await tx.purchaseOrder.delete({ where: { id } });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.purchase_order.deleted',
      entityType: 'PurchaseOrder',
      entityId: id,
      diff: { before: { number: po.number } },
    });
  });
}

function assertNoDuplicateVariants(lines: PurchaseOrderLineInput[]): void {
  const seen = new Set<string>();
  for (const line of lines) {
    if (seen.has(line.variantId)) {
      throw new InventoryValidationError(
        'A variant appears more than once — combine the quantities into a single line',
        [{ field: 'lines', message: `duplicate variant ${line.variantId}` }]
      );
    }
    seen.add(line.variantId);
  }
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/** Shared with the reorder engine, which retries its whole-batch draft on a lost
 *  PO-number race the same way `createPurchaseOrder` does. */
export function isReorderUniqueViolation(err: unknown): boolean {
  return isUniqueViolation(err);
}

// Re-exported so a single `from './purchase-orders'` import pulls the helpers a
// caller composing its own tx (the seed, receiving in P3c) needs.
export type { PurchaseOrderDetail, PurchaseOrderRow };
export { ensurePurchaseOrder, resolveLineData, recomputeTotals } from './purchase-order-shared';
export type { TxClient };
