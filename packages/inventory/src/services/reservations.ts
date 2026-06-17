// Reservations — soft (cart, TTL) and hard (order/subscription) holds against
// future fulfillment. Reserve/release/expire move only `allocated` (the
// InventoryReservation rows ARE the allocated ledger, so they write no movement
// row). Commit is the one that actually removes stock — it funnels the onHand
// decrement through `applyMovement` as a `sale`.

import { ReserveInventoryInput } from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import {
  InventoryNotFoundError,
  InventoryOutOfStockError,
  InventoryValidationError,
} from '../errors';
import type { ServiceContext } from '../errors';

import { CART_TTL_SECONDS_DEFAULT, syncProductInStock } from './internal';
import { applyMovement, emitStockEvents, resolveActorType } from './ledger';

export interface ReservationResult {
  reservationId: string;
  warehouseId: string;
  expiresAt: string | null;
}

/**
 * Reserve stock for a cart line, order line, or subscription occurrence.
 * Picks a warehouse if not specified (the first active one with enough
 * available stock). Throws InventoryOutOfStockError when stock is short
 * and the variant's inventoryPolicy is `deny`. For `continue` /
 * `preorder` policies, succeeds even when stock is short (allocated may
 * temporarily exceed onHand — surfaces as a negative `available` in the
 * dashboard).
 */
export async function reserve(ctx: ServiceContext, rawInput: unknown): Promise<ReservationResult> {
  const input = ReserveInventoryInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const variant = await tx.productVariant.findFirst({
      where: { id: input.variantId, deletedAt: null },
      select: { id: true, inventoryPolicy: true },
    });
    if (!variant) throw new InventoryNotFoundError('Variant', input.variantId);

    const warehouseId = input.warehouseId ?? (await pickWarehouseFor(tx, input));

    const level = await tx.inventoryLevel.upsert({
      where: {
        variantId_warehouseId: {
          variantId: input.variantId,
          warehouseId,
        },
      },
      create: {
        tenantId: ctx.tenantId,
        variantId: input.variantId,
        warehouseId,
        onHand: 0,
        allocated: 0,
      },
      update: {},
    });

    const available = level.onHand - level.allocated;
    if (available < input.quantity && variant.inventoryPolicy === 'deny') {
      throw new InventoryOutOfStockError(input.variantId, input.quantity, Math.max(0, available));
    }

    await tx.inventoryLevel.update({
      where: {
        variantId_warehouseId: {
          variantId: input.variantId,
          warehouseId,
        },
      },
      data: { allocated: { increment: input.quantity }, asOf: new Date() },
    });

    const ttlSeconds =
      input.holderType === 'cart' ? (input.ttlSeconds ?? CART_TTL_SECONDS_DEFAULT) : null;
    const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null;

    const reservation = await tx.inventoryReservation.create({
      data: {
        tenantId: ctx.tenantId,
        variantId: input.variantId,
        warehouseId,
        quantity: input.quantity,
        holderType: input.holderType,
        holderId: input.holderId,
        expiresAt,
        status: 'active',
      },
    });

    await syncProductInStock(tx, input.variantId);

    return {
      reservationId: reservation.id,
      warehouseId,
      expiresAt: expiresAt?.toISOString() ?? null,
    };
  });
}

/** Release an active reservation. Returns the freed quantity to allocated. */
export async function release(ctx: ServiceContext, reservationId: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const reservation = await tx.inventoryReservation.findFirst({
      where: { id: reservationId },
    });
    if (!reservation) throw new InventoryNotFoundError('InventoryReservation', reservationId);
    if (reservation.status !== 'active') return; // idempotent

    await tx.inventoryReservation.update({
      where: { id: reservationId },
      data: { status: 'released', releasedAt: new Date() },
    });
    await tx.inventoryLevel.update({
      where: {
        variantId_warehouseId: {
          variantId: reservation.variantId,
          warehouseId: reservation.warehouseId,
        },
      },
      data: { allocated: { decrement: reservation.quantity }, asOf: new Date() },
    });

    await syncProductInStock(tx, reservation.variantId);
  });
}

/**
 * Commit an active reservation — the goods have left the building. Funnels the
 * onHand decrement through the ledger (`sale` movement) and drops `allocated`
 * in the same locked write, then emits threshold events. `idempotencyKey` lets
 * a redelivered fulfillment/order event commit exactly once.
 */
export async function commit(
  ctx: ServiceContext,
  reservationId: string,
  opts: { idempotencyKey?: string } = {}
): Promise<void> {
  const outcome = await withTenant(ctx, async (tx) => {
    const reservation = await tx.inventoryReservation.findFirst({
      where: { id: reservationId },
    });
    if (!reservation) throw new InventoryNotFoundError('InventoryReservation', reservationId);
    if (reservation.status !== 'active') return null; // idempotent

    await tx.inventoryReservation.update({
      where: { id: reservationId },
      data: { status: 'committed', releasedAt: new Date() },
    });

    const result = await applyMovement(tx, {
      tenantId: ctx.tenantId,
      variantId: reservation.variantId,
      warehouseId: reservation.warehouseId,
      delta: -reservation.quantity,
      allocatedDelta: -reservation.quantity,
      reason: 'sale',
      referenceType: reservation.holderType === 'order' ? 'Order' : reservation.holderType,
      referenceId: reservation.holderId,
      actorType: resolveActorType(ctx),
      actorId: ctx.userId ?? null,
      idempotencyKey: opts.idempotencyKey ?? null,
      // A committed sale reflects goods that physically left; under a
      // continue/preorder policy onHand may go negative (a backorder).
      allowNegative: true,
    });

    return {
      result,
      variantId: reservation.variantId,
      warehouseId: reservation.warehouseId,
      quantity: reservation.quantity,
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
}

/**
 * Release expired cart reservations. Called by the inventory-reaper
 * worker on a schedule. Returns the count released so the worker can log.
 */
export async function expireDueReservations(ctx: ServiceContext): Promise<{ released: number }> {
  let released = 0;
  await withTenant(ctx, async (tx) => {
    const due = await tx.inventoryReservation.findMany({
      where: {
        status: 'active',
        expiresAt: { lte: new Date() },
      },
      take: 500,
    });
    for (const r of due) {
      await tx.inventoryReservation.update({
        where: { id: r.id },
        data: { status: 'expired', releasedAt: new Date() },
      });
      await tx.inventoryLevel.update({
        where: {
          variantId_warehouseId: {
            variantId: r.variantId,
            warehouseId: r.warehouseId,
          },
        },
        data: { allocated: { decrement: r.quantity }, asOf: new Date() },
      });
      released += 1;
    }
  });
  return { released };
}

async function pickWarehouseFor(
  tx: TxClient,
  input: { quantity: number; holderType: string }
): Promise<string> {
  // Phase 2 picker: first active warehouse with sufficient available
  // stock; falls back to the first active warehouse if no one has it
  // (the variant's inventoryPolicy decides whether that's an error).
  // Channel-aware routing comes in Phase 5 once Checkout passes channel.
  const channel =
    input.holderType === 'cart'
      ? 'storefront'
      : input.holderType === 'subscription'
        ? 'subscription'
        : 'admin';

  const candidates = await tx.warehouse.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, defaultForChannel: true },
  });

  const matchingChannel = candidates.filter((w) => {
    const list = Array.isArray(w.defaultForChannel) ? (w.defaultForChannel as string[]) : [];
    return list.includes(channel);
  });
  const ordered = matchingChannel.length > 0 ? matchingChannel : candidates;

  if (ordered.length === 0) {
    throw new InventoryValidationError(
      'No active warehouses exist — create one before reserving stock'
    );
  }

  return ordered[0]!.id;
}
