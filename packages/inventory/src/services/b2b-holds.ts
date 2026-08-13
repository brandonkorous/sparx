// B2B inventory consumer (docs/100 P6d) — fleet / work-order holds + account-
// scoped availability. Inventory owns the supply engine; this is the B2B-specific
// scoping on top (docs/99 §4.0). A hold reserves stock against the master for an
// account's work order via the reservation engine (holderType `work_order`), so
// total stock is conserved (allocated, never on_hand). Release frees the
// reservation; consume commits it to a `sale` through the ledger.

import { AccountAvailabilityInput, CreateFleetHoldInput } from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import { InventoryNotFoundError, InventoryValidationError } from '../errors';
import type { ServiceContext } from '../errors';

import { ensureVariantExists } from './internal';
import { applyMovement, emitStockEvents, resolveActorType } from './ledger';
import { reserveOnTx, releaseOnTx, pickWarehouseFor } from './reservations';

export interface FleetHoldRow {
  id: string;
  companyId: string;
  variantId: string;
  sku: string | null;
  title: string | null;
  warehouseId: string;
  warehouseCode: string;
  quantity: number;
  workOrderRef: string;
  note: string | null;
  status: string;
  reservationId: string | null;
  heldByCustomerId: string | null;
  createdAt: string;
  releasedAt: string | null;
}

export interface AccountAvailabilityRow {
  variantId: string;
  sku: string | null;
  title: string | null;
  /** Master available to reserve, net of allocations + safety buffer. */
  available: number;
  /** Units this account already holds (active fleet holds). */
  heldForAccount: number;
  minOrderQty: number | null;
  maxOrderQty: number | null;
}

interface HoldWithJoins {
  id: string;
  companyId: string;
  variantId: string;
  warehouseId: string;
  quantity: number;
  workOrderRef: string;
  note: string | null;
  status: string;
  reservationId: string | null;
  heldByCustomerId: string | null;
  createdAt: Date;
  releasedAt: Date | null;
  variant: { sku: string | null; product: { title: string | null } | null } | null;
  warehouse: { code: string } | null;
}

function serializeHold(h: HoldWithJoins): FleetHoldRow {
  return {
    id: h.id,
    companyId: h.companyId,
    variantId: h.variantId,
    sku: h.variant?.sku ?? null,
    title: h.variant?.product?.title ?? null,
    warehouseId: h.warehouseId,
    warehouseCode: h.warehouse?.code ?? '',
    quantity: h.quantity,
    workOrderRef: h.workOrderRef,
    note: h.note,
    status: h.status,
    reservationId: h.reservationId,
    heldByCustomerId: h.heldByCustomerId,
    createdAt: h.createdAt.toISOString(),
    releasedAt: h.releasedAt ? h.releasedAt.toISOString() : null,
  };
}

const HOLD_INCLUDE = {
  variant: { select: { sku: true, product: { select: { title: true } } } },
  warehouse: { select: { code: true } },
} as const;

async function ensureAccount(tx: TxClient, ctx: ServiceContext, accountId: string): Promise<void> {
  const account = await tx.company.findFirst({
    where: { id: accountId, tenantId: ctx.tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!account) throw new InventoryNotFoundError('Company', accountId);
}

async function loadOverride(
  tx: TxClient,
  ctx: ServiceContext,
  accountId: string,
  variantId: string
): Promise<{ minOrderQty: number | null; maxOrderQty: number | null }> {
  const row = await tx.b2bAccountProductOverride.findFirst({
    where: { tenantId: ctx.tenantId, accountId, variantId },
    select: { minOrderQty: true, maxOrderQty: true },
  });
  return { minOrderQty: row?.minOrderQty ?? null, maxOrderQty: row?.maxOrderQty ?? null };
}

function assertWithinLimits(
  quantity: number,
  limits: { minOrderQty: number | null; maxOrderQty: number | null }
): void {
  if (limits.minOrderQty !== null && quantity < limits.minOrderQty) {
    throw new InventoryValidationError(
      `Quantity ${quantity} is below this account's minimum order quantity of ${limits.minOrderQty}.`
    );
  }
  if (limits.maxOrderQty !== null && quantity > limits.maxOrderQty) {
    throw new InventoryValidationError(
      `Quantity ${quantity} exceeds this account's maximum order quantity of ${limits.maxOrderQty}.`
    );
  }
}

/**
 * Account-scoped availability for a set of variants: master available to reserve
 * (net of safety buffer), how much this account already holds, and the account's
 * per-variant min/max purchasing limits. Explicitly tenant-scoped (superuser-
 * bypasses-RLS precedent).
 */
export async function accountAvailability(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<AccountAvailabilityRow[]> {
  const input = AccountAvailabilityInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    await ensureAccount(tx, ctx, input.accountId);

    const [variants, levels, heldGroups, overrides] = await Promise.all([
      tx.productVariant.findMany({
        where: { id: { in: input.variantIds }, tenantId: ctx.tenantId, deletedAt: null },
        select: { id: true, sku: true, product: { select: { title: true } } },
      }),
      tx.inventoryLevel.findMany({
        where: {
          variantId: { in: input.variantIds },
          tenantId: ctx.tenantId,
          ...(input.warehouseId ? { warehouseId: input.warehouseId } : {}),
        },
        select: {
          variantId: true,
          onHand: true,
          allocated: true,
          safetyBuffer: true,
          unsellableOnHand: true,
        },
      }),
      tx.b2bFleetHold.groupBy({
        by: ['variantId'],
        where: { tenantId: ctx.tenantId, companyId: input.accountId, status: 'active' },
        _sum: { quantity: true },
      }),
      tx.b2bAccountProductOverride.findMany({
        where: {
          tenantId: ctx.tenantId,
          accountId: input.accountId,
          variantId: { in: input.variantIds },
        },
        select: { variantId: true, minOrderQty: true, maxOrderQty: true },
      }),
    ]);

    const availableBy = new Map<string, number>();
    for (const l of levels) {
      const net = l.onHand - l.allocated - l.safetyBuffer - l.unsellableOnHand;
      availableBy.set(l.variantId, (availableBy.get(l.variantId) ?? 0) + net);
    }
    const heldBy = new Map(heldGroups.map((g) => [g.variantId, g._sum.quantity ?? 0]));
    const overrideBy = new Map(overrides.map((o) => [o.variantId, o]));

    return variants.map((v) => {
      const o = overrideBy.get(v.id);
      return {
        variantId: v.id,
        sku: v.sku,
        title: v.product?.title ?? null,
        available: Math.max(0, availableBy.get(v.id) ?? 0),
        heldForAccount: heldBy.get(v.id) ?? 0,
        minOrderQty: o?.minOrderQty ?? null,
        maxOrderQty: o?.maxOrderQty ?? null,
      };
    });
  });
}

/**
 * Place a fleet / work-order hold for a B2B account: enforce the account's min/max
 * limits, reserve the stock through the reservation engine, and record the hold.
 * Throws InventoryOutOfStockError if stock is short under a `deny` policy.
 */
export async function createFleetHold(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<FleetHoldRow> {
  const input = CreateFleetHoldInput.parse(rawInput);

  const holdId = await withTenant(ctx, async (tx) => {
    await ensureAccount(tx, ctx, input.accountId);
    await ensureVariantExists(tx, input.variantId);
    assertWithinLimits(
      input.quantity,
      await loadOverride(tx, ctx, input.accountId, input.variantId)
    );

    const warehouseId =
      input.warehouseId ??
      (await pickWarehouseFor(tx, {
        variantId: input.variantId,
        quantity: input.quantity,
        holderType: 'work_order',
      }));

    const hold = await tx.b2bFleetHold.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: input.accountId,
        variantId: input.variantId,
        warehouseId,
        quantity: input.quantity,
        workOrderRef: input.workOrderRef,
        note: input.note ?? null,
        heldByCustomerId: input.heldByCustomerId ?? null,
        status: 'active',
      },
    });

    const reservation = await reserveOnTx(tx, ctx, {
      variantId: input.variantId,
      warehouseId,
      quantity: input.quantity,
      holderType: 'work_order',
      holderId: hold.id,
    });

    await tx.b2bFleetHold.update({
      where: { id: hold.id },
      data: { reservationId: reservation.reservationId },
    });
    return hold.id;
  });

  return getFleetHold(ctx, holdId);
}

/** Release an active hold — frees the reservation back to available. Idempotent. */
export async function releaseFleetHold(ctx: ServiceContext, holdId: string): Promise<FleetHoldRow> {
  await withTenant(ctx, async (tx) => {
    const hold = await tx.b2bFleetHold.findFirst({
      where: { id: holdId, tenantId: ctx.tenantId },
      select: { id: true, status: true, reservationId: true },
    });
    if (!hold) throw new InventoryNotFoundError('B2bFleetHold', holdId);
    if (hold.status !== 'active') return;

    if (hold.reservationId) await releaseOnTx(tx, ctx, hold.reservationId);
    await tx.b2bFleetHold.update({
      where: { id: holdId },
      data: { status: 'released', releasedAt: new Date() },
    });
  });
  return getFleetHold(ctx, holdId);
}

/**
 * Consume an active hold — the work order shipped, so the held stock leaves. Drops
 * onHand through the ledger (`sale`) and clears the allocation in one locked write.
 * Idempotent via the order-style idempotency key on the movement.
 */
export async function consumeFleetHold(ctx: ServiceContext, holdId: string): Promise<FleetHoldRow> {
  const outcome = await withTenant(ctx, async (tx) => {
    const hold = await tx.b2bFleetHold.findFirst({
      where: { id: holdId, tenantId: ctx.tenantId },
    });
    if (!hold) throw new InventoryNotFoundError('B2bFleetHold', holdId);
    if (hold.status !== 'active') return null;

    // Mark the reservation committed (it carries the `allocated` units), then
    // funnel the onHand decrement through the ledger in the same tx.
    if (hold.reservationId) {
      await tx.inventoryReservation.updateMany({
        where: { id: hold.reservationId, status: 'active' },
        data: { status: 'committed', releasedAt: new Date() },
      });
    }
    const result = await applyMovement(tx, {
      tenantId: ctx.tenantId,
      variantId: hold.variantId,
      warehouseId: hold.warehouseId,
      delta: -hold.quantity,
      allocatedDelta: hold.reservationId ? -hold.quantity : 0,
      reason: 'sale',
      referenceType: 'B2bFleetHold',
      referenceId: hold.id,
      idempotencyKey: `fleet-hold-consume:${hold.id}`,
      actorType: resolveActorType(ctx),
      actorId: ctx.userId ?? null,
      allowNegative: true,
    });

    await tx.b2bFleetHold.update({
      where: { id: holdId },
      data: { status: 'consumed', releasedAt: new Date() },
    });
    return {
      result,
      variantId: hold.variantId,
      warehouseId: hold.warehouseId,
      quantity: hold.quantity,
    };
  });

  if (outcome && !outcome.result.deduped) {
    await emitStockEvents(
      ctx,
      outcome.variantId,
      outcome.warehouseId,
      outcome.result,
      -outcome.quantity,
      'sale'
    );
  }
  return getFleetHold(ctx, holdId);
}

export async function getFleetHold(ctx: ServiceContext, holdId: string): Promise<FleetHoldRow> {
  const hold = await withTenant(ctx, (tx) =>
    tx.b2bFleetHold.findFirst({
      where: { id: holdId, tenantId: ctx.tenantId },
      include: HOLD_INCLUDE,
    })
  );
  if (!hold) throw new InventoryNotFoundError('B2bFleetHold', holdId);
  return serializeHold(hold);
}

export interface ListFleetHoldsFilter {
  accountId?: string;
  variantId?: string;
  status?: string;
  take?: number;
  skip?: number;
}

export async function listFleetHolds(
  ctx: ServiceContext,
  filter: ListFleetHoldsFilter = {}
): Promise<{ items: FleetHoldRow[]; total: number }> {
  const take = Math.min(filter.take ?? 50, 200);
  const skip = filter.skip ?? 0;
  const where = {
    tenantId: ctx.tenantId,
    ...(filter.accountId ? { companyId: filter.accountId } : {}),
    ...(filter.variantId ? { variantId: filter.variantId } : {}),
    ...(filter.status ? { status: filter.status } : {}),
  };
  return withTenant(ctx, async (tx) => {
    const [rows, total] = await Promise.all([
      tx.b2bFleetHold.findMany({
        where,
        include: HOLD_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      tx.b2bFleetHold.count({ where }),
    ]);
    return { items: rows.map(serializeHold), total };
  });
}
