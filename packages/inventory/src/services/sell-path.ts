// Sell-path seam (docs/100 §2.4, P2) — the commerce → inventory integration
// that makes stock real-time accurate and prevents oversell. Three operations:
//
//   • commitSaleOnTx  — decrement onHand for an order's lines, INSIDE the
//     checkout/approval transaction (atomic with the placement writes). Each
//     line either commits its cart soft-hold (releasing `allocated` as it pulls
//     `onHand`) or, when no hold exists, decrements directly. Every line writes a
//     `sale` movement referencing the order, idempotency-keyed so a retried
//     completion never double-decrements (decrement authority = checkout commit,
//     docs/100 §7.4).
//   • reverseOrderSale — restock a cancelled order by reversing its `sale`
//     movements (a `cancel` movement per sale), idempotent per source movement,
//     and release any lingering active holds. Driven off the ledger (not the
//     reservations) so it reverses exactly what was decremented.
//   • resolveDefaultWarehouseId — the channel-default / first-active warehouse,
//     for callers (returns restock) that have a quantity but no chosen location.
//
// All threshold events are emitted AFTER the transaction commits — callers of
// commitSaleOnTx get the per-line results back and emit; reverseOrderSale owns
// its own transaction and emits itself.

import { withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import type { ServiceContext } from '../errors';

import { applyMovement, emitStockEvents, resolveActorType } from './ledger';
import type { MovementResult } from './ledger';
import { pickWarehouseFor } from './reservations';

export interface SellLine {
  variantId: string;
  quantity: number;
  /** The cart line's soft hold, if any (null when inventory was off at add-time
   *  or the line came from an order, e.g. the B2B approval path). */
  reservationId: string | null;
  /** A stable per-line id (cart-item id at checkout, order-item id at approval).
   *  The sale movement's idempotency key is derived from it, so a re-commit of
   *  the SAME order decrements exactly once regardless of which branch runs. */
  lineKey: string;
}

export interface CommittedSale {
  variantId: string;
  warehouseId: string;
  quantity: number;
  result: MovementResult;
}

/**
 * Commit the sale for an order's lines inside the caller's tenant transaction.
 * Returns the per-line results so the caller can emit threshold events after the
 * transaction commits. Lines with no variant (free-text order items) are skipped.
 */
export async function commitSaleOnTx(
  tx: TxClient,
  ctx: ServiceContext,
  input: { orderId: string; lines: SellLine[] }
): Promise<CommittedSale[]> {
  const actorType = resolveActorType(ctx);
  const actorId = ctx.userId ?? null;
  const committed: CommittedSale[] = [];

  for (const line of input.lines) {
    if (!line.variantId || line.quantity <= 0) continue;
    const idempotencyKey = `order-commit:${input.orderId}:${line.lineKey}`;

    // Commit the soft hold if it's still active: pull onHand AND drop the
    // matching `allocated` in the one locked write, and re-key the reservation to
    // the order so a later cancel can find it.
    if (line.reservationId) {
      const res = await tx.inventoryReservation.findFirst({ where: { id: line.reservationId } });
      if (res?.status === 'active') {
        await tx.inventoryReservation.update({
          where: { id: res.id },
          data: {
            status: 'committed',
            holderType: 'order',
            holderId: input.orderId,
            releasedAt: new Date(),
          },
        });
        const result = await applyMovement(tx, {
          tenantId: ctx.tenantId,
          variantId: res.variantId,
          warehouseId: res.warehouseId,
          delta: -res.quantity,
          allocatedDelta: -res.quantity,
          reason: 'sale',
          referenceType: 'Order',
          referenceId: input.orderId,
          idempotencyKey,
          actorType,
          actorId,
          allowNegative: true,
        });
        committed.push({
          variantId: res.variantId,
          warehouseId: res.warehouseId,
          quantity: res.quantity,
          result,
        });
        continue;
      }
    }

    // No active hold — decrement directly against the allocated warehouse.
    const warehouseId = await pickWarehouseFor(tx, {
      variantId: line.variantId,
      quantity: line.quantity,
      holderType: 'order',
    });
    const result = await applyMovement(tx, {
      tenantId: ctx.tenantId,
      variantId: line.variantId,
      warehouseId,
      delta: -line.quantity,
      reason: 'sale',
      referenceType: 'Order',
      referenceId: input.orderId,
      idempotencyKey,
      actorType,
      actorId,
      allowNegative: true,
    });
    committed.push({ variantId: line.variantId, warehouseId, quantity: line.quantity, result });
  }

  return committed;
}

/** Emit the post-commit threshold events for a set of committed sales. Call
 *  AFTER the transaction that produced them commits. */
export async function emitSaleEvents(ctx: ServiceContext, sales: CommittedSale[]): Promise<void> {
  for (const s of sales) {
    if (s.result.deduped) continue;
    await emitStockEvents(ctx, s.variantId, s.warehouseId, s.result, -s.quantity, 'sale');
  }
}

/**
 * Restock a cancelled order: reverse each of its `sale` movements with a
 * compensating `cancel` movement (idempotency-keyed off the source movement, so
 * a redelivered `order.cancelled` reverses exactly once), and release any holds
 * still pointing at the order. Opens its own tenant transaction; safe to call
 * from an event consumer. Returns the number of movements reversed.
 */
export async function reverseOrderSale(
  ctx: ServiceContext,
  input: { orderId: string }
): Promise<{ reversed: number }> {
  const emissions: { variantId: string; warehouseId: string; result: MovementResult }[] = [];

  await withTenant(ctx, async (tx) => {
    const sales = await tx.inventoryMovement.findMany({
      where: { referenceType: 'Order', referenceId: input.orderId, reason: 'sale' },
      select: { id: true, variantId: true, warehouseId: true, delta: true },
    });
    for (const s of sales) {
      const result = await applyMovement(tx, {
        tenantId: ctx.tenantId,
        variantId: s.variantId,
        warehouseId: s.warehouseId,
        // sale deltas are negative; reverse to a positive restock.
        delta: -s.delta,
        reason: 'cancel',
        referenceType: 'Order',
        referenceId: input.orderId,
        idempotencyKey: `order-cancel:${input.orderId}:${s.id}`,
        actorType: 'system',
        actorId: null,
        allowNegative: true,
        // The units go back onto the layers this sale drained, at what they
        // cost then — not onto a fresh layer at today's average (docs/146
        // Phase 5.9). A cancellation is the same goods coming back, and
        // re-costing them would quietly reorder FIFO for everything behind
        // them and credit the wrong amount of cost of goods sold.
        costRestoreFromMovementId: s.id,
      });
      if (!result.deduped) {
        emissions.push({ variantId: s.variantId, warehouseId: s.warehouseId, result });
      }
    }

    // Belt + suspenders: drop any reservations still holding `allocated` for this
    // order (e.g. a hold that was re-keyed but never committed).
    const lingering = await tx.inventoryReservation.findMany({
      where: { holderType: 'order', holderId: input.orderId, status: 'active' },
      select: { id: true, variantId: true, warehouseId: true, quantity: true },
    });
    for (const r of lingering) {
      await tx.inventoryReservation.update({
        where: { id: r.id },
        data: { status: 'released', releasedAt: new Date() },
      });
      await tx.inventoryLevel.update({
        where: {
          variantId_warehouseId: { variantId: r.variantId, warehouseId: r.warehouseId },
        },
        data: { allocated: { decrement: r.quantity }, asOf: new Date() },
      });
    }
  });

  for (const e of emissions) {
    await emitStockEvents(
      ctx,
      e.variantId,
      e.warehouseId,
      e.result,
      e.result.appliedDelta,
      'cancel'
    );
  }
  return { reversed: emissions.length };
}

/**
 * The default warehouse for a channel: the channel-default active warehouse, else
 * the first active one. Returns null when the tenant has no active warehouse.
 * Used by returns restock when an inspection records no explicit location.
 */
export async function resolveDefaultWarehouseId(
  ctx: ServiceContext,
  channel = 'storefront'
): Promise<string | null> {
  return withTenant(ctx, async (tx) => {
    const candidates = await tx.warehouse.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, defaultForChannel: true },
    });
    if (candidates.length === 0) return null;
    const match = candidates.find((w) => {
      const list = Array.isArray(w.defaultForChannel) ? (w.defaultForChannel as string[]) : [];
      return list.includes(channel);
    });
    return (match ?? candidates[0])!.id;
  });
}
