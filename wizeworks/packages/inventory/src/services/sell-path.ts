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
//   • holdStockForOrderOnTx / releaseOrderHoldsOnTx: a held order's stock, set
//     aside as an ORDER hold while it waits for a sign-off, committed from by
//     the approval and let go when it is turned down (see "A held order's
//     stock" below).
//
// It is also where a BACKORDER is written down (docs/146 Phase 9.1), and this is
// the only place that happens. A commit is the exact moment an order stops being
// a browsing artefact and becomes a promise to a person, and the sale movement's
// resulting balance says precisely how much of that promise the shelves could
// not cover. Recording it at reserve time instead would catch carts that are
// abandoned; recording it in both places would count a B2B order twice.
//
// All threshold events are emitted AFTER the transaction commits — callers of
// commitSaleOnTx get the per-line results back and emit; reverseOrderSale owns
// its own transaction and emits itself.

import { withTenant } from '@wizeworks/db';
import type { TxClient } from '@wizeworks/db';

import type { ServiceContext } from '../errors';
import { publishInventoryEvent } from '../events';

import { cancelBackordersForHolderOnTx, recordBackorderOnTx } from './backorders';
import { CHANNEL_CANDIDATE_SELECT, channelDefaultId } from './channel-default';
import { recordOversellIncidentOnTx } from './integrity';
import { consumePreorderOnTx } from './preorders';
import { applyMovement, emitStockEvents, resolveActorType } from './ledger';
import type { MovementResult } from './ledger';
import { channelForHolder, pickWarehouseFor, releaseOnTx, reserveOnTx } from './reservations';

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
  /** Units of this line the shelves could not cover, and which are therefore
   *  owed to the customer (docs/146 Phase 9.1). Zero on the ordinary path. */
  backorderedQuantity: number;
  /** The commitment row written for that shortfall, when there was one. */
  backorderId: string | null;
  /** Units this line took that were not free to sell when it took them: not on
   *  the shelf, or on it and already set aside for somebody else. Only a line
   *  with no hold of its own can do that; one committing its hold took stock
   *  that was set aside for it. Zero on the ordinary path. The units owed to
   *  THIS customer are `backorderedQuantity`; the difference, when there is
   *  one, is stock another order was holding. */
  shortQuantity: number;
}

/** Statuses of an order whose goods have left, or are leaving, the shelves. A
 *  held order (waiting on a sign-off) commits when it is approved, and a
 *  canceled or refunded one never does. */
const SELLING_ORDER_STATUSES = new Set(['placed', 'fulfilled', 'delivered']);

export interface OrderForSale {
  status: string;
  items: {
    id: string;
    variantId: string | null;
    quantity: number;
    variant: { dropshipSourceId: string | null } | null;
  }[];
}

/**
 * The lines of a placed order still to come off the shelves, or none.
 *
 * Checkout, the marketplace import and the sign-off on a held order each take
 * their stock as they write the order. Every OTHER way an order is written did
 * not: a sale at the counter, a quote turned into an order, an order typed in
 * by hand. MEASURED 2026-10-02 on Gillett Diesel: nine orders, one stock
 * movement, the web order's; six counter sales and two quote orders, 16 units,
 * took nothing (sparx persona issue 084). So an order that has no sale yet
 * takes it here, line by line, keyed on the order line so a repeat takes it
 * once. An order that already has one was taken by its own writer and is left
 * alone, which is what keeps checkout from being counted twice.
 */
export function linesToSellForOrder(order: OrderForSale, alreadySold: boolean): SellLine[] {
  if (alreadySold || !SELLING_ORDER_STATUSES.has(order.status)) return [];
  return order.items.flatMap((item) =>
    item.variantId && item.quantity > 0 && !item.variant?.dropshipSourceId
      ? [
          {
            variantId: item.variantId,
            quantity: item.quantity,
            reservationId: null,
            lineKey: item.id,
          },
        ]
      : []
  );
}

/** Take a placed order's stock if nothing has yet (see `linesToSellForOrder`).
 *  Emits the stock events after the transaction, as checkout does. */
export async function commitPlacedOrderSale(
  ctx: ServiceContext,
  input: { orderId: string }
): Promise<CommittedSale[]> {
  const committed = await withTenant(ctx, async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: input.orderId, tenantId: ctx.tenantId },
      select: {
        status: true,
        items: {
          select: {
            id: true,
            variantId: true,
            quantity: true,
            variant: { select: { dropshipSourceId: true } },
          },
        },
      },
    });
    if (!order) return [];
    const sold = await tx.inventoryMovement.findFirst({
      where: { referenceType: 'Order', referenceId: input.orderId, reason: 'sale' },
      select: { id: true },
    });
    const lines = linesToSellForOrder(order, sold !== null);
    if (lines.length === 0) return [];
    return commitSaleOnTx(tx, ctx, { orderId: input.orderId, lines });
  });
  if (committed.length > 0) await emitSaleEvents(ctx, committed);
  return committed;
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

  // Read once, outside the line loop. A backorder is a promise to a PERSON, and
  // a queue that cannot say whose commitment a row is cannot be worked from.
  // Null is tolerated — a guest order is a real order — and the row still
  // carries the order it belongs to.
  const order = await tx.order.findFirst({
    where: { id: input.orderId, tenantId: ctx.tenantId },
    select: { customerId: true },
  });

  // The order's own line ids, by variant.
  //
  // `SellLine.lineKey` is deliberately NOT used for this: at checkout it is the
  // CART item's id, and writing that into `order_item_id` would fill the column
  // with ids that point at rows in a different table and are deleted with the
  // cart. It is a perfectly good idempotency key and a completely wrong foreign
  // key. Resolved from the order instead, which is the only place the answer
  // actually lives.
  const orderItems = await tx.orderItem.findMany({
    where: { orderId: input.orderId },
    select: { id: true, variantId: true },
  });
  const orderItemByVariant = new Map(
    orderItems.filter((i) => i.variantId).map((i) => [i.variantId!, i.id])
  );

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
          ...(await noteShortfall(tx, ctx, {
            result,
            quantity: res.quantity,
            variantId: res.variantId,
            warehouseId: res.warehouseId,
            orderId: input.orderId,
            orderItemId: orderItemByVariant.get(res.variantId) ?? null,
            customerId: order?.customerId ?? null,
          })),
          shortQuantity: 0,
        });
        continue;
      }
    }

    // A line already taken (a retried completion, a repeated approval) goes
    // straight to the decrement below, whose idempotency key makes it a no-op
    // and reports it `deduped`, exactly as it always has. Checked FIRST so a
    // hold the order took after it was sold (a short pick puts units back and
    // holds them for the order) is never mistaken for one to commit.
    const alreadySold =
      (await tx.inventoryMovement.findFirst({
        where: { idempotencyKey },
        select: { id: true },
      })) !== null;

    // The order's OWN holds: the stock a held order set aside while it waited
    // for a sign-off (`holdStockForOrderOnTx`). Approving it commits from them,
    // the same way checkout commits a cart's hold, so the units it takes are
    // the ones kept for it and not whatever happens to be on a shelf by then.
    // Before this, the approval passed no hold and decremented "directly", and
    // the hold checkout had taken was left behind: on Gillett Diesel's O-000014
    // the CP4 kits came off the shelf AND stayed allocated, so three kits were
    // counted out twice and the item read sold out (2026-10-03).
    let remaining = line.quantity;
    let canonicalUsed = false;
    if (!alreadySold) {
      const holds = await tx.inventoryReservation.findMany({
        where: {
          holderType: 'order',
          holderId: input.orderId,
          variantId: line.variantId,
          status: 'active',
        },
        orderBy: { createdAt: 'asc' },
      });
      for (const hold of holds) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, hold.quantity);
        // A hold larger than this line (two lines of one item) keeps the rest
        // for the next line rather than being committed whole.
        await tx.inventoryReservation.update({
          where: { id: hold.id },
          data:
            take === hold.quantity
              ? { status: 'committed', releasedAt: new Date() }
              : { quantity: hold.quantity - take },
        });
        const result = await applyMovement(tx, {
          tenantId: ctx.tenantId,
          variantId: hold.variantId,
          warehouseId: hold.warehouseId,
          delta: -take,
          allocatedDelta: -take,
          reason: 'sale',
          referenceType: 'Order',
          referenceId: input.orderId,
          // The first movement of a line carries the line's own key, so the
          // `alreadySold` read above finds it on a retry; a line split across
          // two holds keys the second by the hold.
          idempotencyKey: canonicalUsed ? `${idempotencyKey}:${hold.id}` : idempotencyKey,
          actorType,
          actorId,
          allowNegative: true,
        });
        canonicalUsed = true;
        committed.push({
          variantId: hold.variantId,
          warehouseId: hold.warehouseId,
          quantity: take,
          result,
          ...(await noteShortfall(tx, ctx, {
            result,
            quantity: take,
            variantId: hold.variantId,
            warehouseId: hold.warehouseId,
            orderId: input.orderId,
            orderItemId: orderItemByVariant.get(hold.variantId) ?? null,
            customerId: order?.customerId ?? null,
          })),
          shortQuantity: 0,
        });
        remaining -= take;
      }
      if (remaining <= 0) continue;

      // Nobody has ever counted this item and it is not sold past zero: it is
      // untracked, exactly as `reserveOnTx` and `computeAvailability` treat
      // it, and there is no stock to take it from. A sale here used to INSERT a
      // level row at minus the quantity, which turned "nobody has counted
      // this" into "there are none" and put the item out of stock for good.
      // MEASURED 2026-10-03: four level rows on the local database were born
      // from a sale, three of them on `deny` items.
      //
      // An item sold past zero on purpose (`continue`, `preorder`) still takes
      // its sale: that is a promise the business chose to make before the
      // stock exists, and the negative balance is how the backorder queue and
      // a preorder window count it.
      const counted = await tx.inventoryLevel.count({ where: { variantId: line.variantId } });
      if (counted === 0) {
        const variant = await tx.productVariant.findFirst({
          where: { id: line.variantId },
          select: { inventoryPolicy: true },
        });
        if ((variant?.inventoryPolicy ?? 'deny') === 'deny') continue;
      }
    }

    // No hold (left) for these units: take them from the location the
    // allocator picks. `pickWarehouseFor` never hands back a location that has
    // never stocked the item while one that has exists, so a short line is
    // booked where the item actually lives.
    const warehouseId = await pickWarehouseFor(tx, {
      variantId: line.variantId,
      quantity: remaining,
      holderType: 'order',
    });
    const shortQuantity = alreadySold
      ? 0
      : await noteUnheldOversell(tx, ctx, {
          variantId: line.variantId,
          warehouseId,
          quantity: remaining,
          orderId: input.orderId,
          actorType,
          actorId,
        });
    const result = await applyMovement(tx, {
      tenantId: ctx.tenantId,
      variantId: line.variantId,
      warehouseId,
      delta: -remaining,
      reason: 'sale',
      referenceType: 'Order',
      referenceId: input.orderId,
      idempotencyKey: canonicalUsed ? `${idempotencyKey}:unheld` : idempotencyKey,
      actorType,
      actorId,
      allowNegative: true,
    });
    committed.push({
      variantId: line.variantId,
      warehouseId,
      quantity: remaining,
      result,
      ...(await noteShortfall(tx, ctx, {
        result,
        quantity: remaining,
        variantId: line.variantId,
        warehouseId,
        orderId: input.orderId,
        orderItemId: orderItemByVariant.get(line.variantId) ?? null,
        customerId: order?.customerId ?? null,
      })),
      shortQuantity,
    });
  }

  return committed;
}

/**
 * Write down a sale that takes units which were not free to sell, before it
 * takes them. Returns how many units that was.
 *
 * A line with no hold of its own takes stock "directly". When the location's
 * free stock (on hand, less what is allocated, the withheld buffer and the
 * quarantine shelf) is short of the line, the sale is an oversell: either the
 * units are not there, or they are and somebody else's cart or order is holding
 * them. The ledger already records the first shape when the sale drives on-hand
 * below zero (`negative_on_hand`, in `applyMovement`). The second left no trace
 * at all: on-hand stayed at or above zero, nothing threw, and the only sign was
 * an `allocated` larger than what was there. It is recorded here as `allowed`,
 * the kind `reserveOnTx` writes when a hold goes ahead past what is free, so the
 * oversell report (`get_oversell_incidents`) shows the approval that did it.
 *
 * Not written when the ledger is about to write its own `negative_on_hand` row
 * for the same sale, so one oversell is one row.
 */
async function noteUnheldOversell(
  tx: TxClient,
  ctx: ServiceContext,
  input: {
    variantId: string;
    warehouseId: string;
    quantity: number;
    orderId: string;
    actorType: ReturnType<typeof resolveActorType>;
    actorId: string | null;
  }
): Promise<number> {
  const level = await tx.inventoryLevel.findUnique({
    where: {
      variantId_warehouseId: { variantId: input.variantId, warehouseId: input.warehouseId },
    },
    select: { onHand: true, allocated: true, safetyBuffer: true, unsellableOnHand: true },
  });
  const onHand = level?.onHand ?? 0;
  const allocated = level?.allocated ?? 0;
  const buffer = level?.safetyBuffer ?? 0;
  const free = onHand - allocated - buffer - (level?.unsellableOnHand ?? 0);
  const short = Math.max(0, input.quantity - Math.max(0, free));
  if (short === 0) return 0;

  const ledgerRecordsIt = onHand >= 0 && onHand - input.quantity < 0;
  if (!ledgerRecordsIt) {
    const variant = await tx.productVariant.findFirst({
      where: { id: input.variantId },
      select: { inventoryPolicy: true },
    });
    await recordOversellIncidentOnTx(tx, ctx, {
      variantId: input.variantId,
      warehouseId: input.warehouseId,
      kind: 'allowed',
      requestedQuantity: input.quantity,
      availableQuantity: free,
      onHandAtDecision: onHand,
      allocatedAtDecision: allocated,
      bufferAtDecision: buffer,
      policy: variant?.inventoryPolicy ?? 'deny',
      channel: channelForHolder('order'),
      holderType: 'order',
      holderId: input.orderId,
      actorType: input.actorType,
      actorId: input.actorId,
    });
  }
  return short;
}

// ─── A held order's stock ─────────────────────────────────────────────────
//
// An order over a spending limit is written as `pending_approval` and waits,
// sometimes for hours, for somebody to sign it off. Its stock has to wait with
// it. Checkout used to leave the cart's hold where it was: still keyed to the
// cart, on the cart's thirty-minute timer, and pointed at by a cart line the
// shopper could still edit. So either the reaper let it go half an hour later
// and the units were anybody's again, or (with no reaper running) it sat there
// forever and the approval, which committed without it, counted the same units
// out a second time. Both happened to the same order on Gillett Diesel
// (O-000014, 2026-10-03).
//
// A held order now holds its stock as an ORDER: holder `order`, no expiry, so
// the reaper never touches it and no cart write can release it. Approving it
// commits from that hold (`commitSaleOnTx`); turning it down or cancelling it
// releases it (`releaseOrderHoldsOnTx`).

export interface HoldLine {
  variantId: string;
  quantity: number;
  /** The cart line's hold, if it had one. Moved to the order as it is. */
  reservationId: string | null;
}

export interface HeldOrderStock {
  /** Every hold now set aside for the order. */
  reservationIds: string[];
  /** Units that could not be set aside, because they were not free to sell at
   *  any one location. The approval decides what happens to them. */
  unheldQuantity: number;
}

/**
 * Set a held order's stock aside for it, inside the caller's transaction.
 *
 * A line whose cart hold is still active keeps that exact hold, re-keyed to the
 * order with its timer removed: the units the buyer was promised at the basket
 * are the ones kept. A line with no hold (its cart hold lapsed, or the order
 * was made from a quote and never had one) takes a fresh one for what is free
 * to sell at the location the allocator picks, and never more: a hold past
 * what is there would be an oversell recorded before anybody agreed to one.
 * What it cannot cover is left for the approval to settle.
 *
 * Idempotent: units the order already holds are counted first, so calling this
 * twice for one order holds once.
 */
export async function holdStockForOrderOnTx(
  tx: TxClient,
  ctx: ServiceContext,
  input: { orderId: string; lines: HoldLine[] }
): Promise<HeldOrderStock> {
  const existing = await tx.inventoryReservation.findMany({
    where: { holderType: 'order', holderId: input.orderId, status: 'active' },
    select: { id: true, variantId: true, quantity: true },
  });
  const reservationIds = existing.map((r) => r.id);
  // What the order already holds, spent line by line.
  const alreadyHeld = new Map<string, number>();
  for (const r of existing) {
    alreadyHeld.set(r.variantId, (alreadyHeld.get(r.variantId) ?? 0) + r.quantity);
  }

  let unheldQuantity = 0;
  for (const line of input.lines) {
    if (!line.variantId || line.quantity <= 0) continue;
    const counted = Math.min(line.quantity, alreadyHeld.get(line.variantId) ?? 0);
    alreadyHeld.set(line.variantId, (alreadyHeld.get(line.variantId) ?? 0) - counted);
    let need = line.quantity - counted;
    if (need <= 0) continue;

    if (line.reservationId) {
      const hold = await tx.inventoryReservation.findFirst({ where: { id: line.reservationId } });
      if (
        hold?.status === 'active' &&
        hold.holderType !== 'order' &&
        hold.variantId === line.variantId
      ) {
        await tx.inventoryReservation.update({
          where: { id: hold.id },
          data: { holderType: 'order', holderId: input.orderId, expiresAt: null },
        });
        reservationIds.push(hold.id);
        need -= hold.quantity;
      }
    }
    if (need <= 0) continue;

    // Nobody has counted it: untracked, nothing to set aside.
    const levels = await tx.inventoryLevel.count({ where: { variantId: line.variantId } });
    if (levels === 0) continue;

    const warehouseId = await pickWarehouseFor(tx, {
      variantId: line.variantId,
      quantity: need,
      holderType: 'order',
    });
    // Locked, so the figure this reads is the figure the hold below is taken
    // against: `reserveOnTx` locks the same row again in this transaction and
    // cannot see it move in between.
    const locked = await tx.$queryRaw<
      { on_hand: number; allocated: number; safety_buffer: number; unsellable_on_hand: number }[]
    >`
      SELECT on_hand, allocated, safety_buffer, unsellable_on_hand
      FROM inventory_levels
      WHERE variant_id = ${line.variantId}::uuid AND warehouse_id = ${warehouseId}::uuid
      FOR UPDATE
    `;
    const level = locked[0];
    const free = level
      ? level.on_hand - level.allocated - level.safety_buffer - level.unsellable_on_hand
      : 0;
    const take = Math.min(need, Math.max(0, free));
    if (take > 0) {
      const held = await reserveOnTx(tx, ctx, {
        variantId: line.variantId,
        warehouseId,
        quantity: take,
        holderType: 'order',
        holderId: input.orderId,
      });
      if (held) reservationIds.push(held.reservationId);
      need -= take;
    }
    unheldQuantity += need;
  }

  return { reservationIds, unheldQuantity };
}

/**
 * Set aside the stock of an order that is waiting for a sign-off and was not
 * written by checkout: a quote accepted over a spending limit. Opens its own
 * transaction; safe to call more than once and after the order has moved on
 * (an order no longer waiting is left alone).
 *
 * The order row is locked first, so this and an approval cannot interleave:
 * whichever runs second sees what the first one did.
 */
export async function holdHeldOrderStock(
  ctx: ServiceContext,
  input: { orderId: string }
): Promise<HeldOrderStock | null> {
  return withTenant(ctx, async (tx) => {
    const locked = await tx.$queryRaw<{ status: string }[]>`
      SELECT status FROM orders
      WHERE id = ${input.orderId}::uuid AND tenant_id = ${ctx.tenantId}::uuid
      FOR UPDATE
    `;
    if (locked[0]?.status !== 'pending_approval') return null;
    const items = await tx.orderItem.findMany({
      where: { orderId: input.orderId },
      select: {
        variantId: true,
        quantity: true,
        variant: { select: { dropshipSourceId: true } },
      },
    });
    return holdStockForOrderOnTx(tx, ctx, {
      orderId: input.orderId,
      lines: items.flatMap((item) =>
        item.variantId && item.quantity > 0 && !item.variant?.dropshipSourceId
          ? [{ variantId: item.variantId, quantity: item.quantity, reservationId: null }]
          : []
      ),
    });
  });
}

/**
 * Let go of everything an order is holding, inside the caller's transaction:
 * a held order turned down, or any order cancelled. Each hold goes back through
 * `releaseOnTx`, so `allocated` and the product's in-stock flag move with it.
 * Returns how many holds were released.
 */
export async function releaseOrderHoldsOnTx(
  tx: TxClient,
  ctx: ServiceContext,
  input: { orderId: string }
): Promise<number> {
  const holds = await tx.inventoryReservation.findMany({
    where: { holderType: 'order', holderId: input.orderId, status: 'active' },
    select: { id: true },
  });
  for (const hold of holds) await releaseOnTx(tx, ctx, hold.id);
  return holds.length;
}

/** One line of an approved order that the shelves could not fully cover. */
export interface OrderStockShortLine {
  variantId: string;
  sku: string | null;
  name: string;
  /** Units of it on the order. */
  ordered: number;
  /** Units taken that were not free to sell when the order was approved. */
  notFree: number;
  /** Units now owed to this customer (written to the backorder queue). */
  owed: number;
}

export interface OrderStockOutcome {
  lines: OrderStockShortLine[];
  /** What happened, for the person who just approved it. */
  note: string;
}

/**
 * The note an approval shows when the order could not be filled from stock set
 * aside for it. Pure, so the words are tested on their own.
 *
 * Owed units are named as owed, because that is what the backorder queue now
 * says about them. Units taken that were not free but are NOT owed to this
 * customer were on a shelf and held for somebody else, and that other order is
 * now the short one; the note says so, because nothing else on the screen
 * will.
 */
export function orderStockNote(lines: readonly OrderStockShortLine[]): string {
  return lines
    .map((line) => {
      const parts: string[] = [];
      if (line.owed > 0) {
        parts.push(
          `${String(line.owed)} of ${String(line.ordered)} ${
            line.owed === 1 ? 'was' : 'were'
          } not in stock, so ${line.owed === 1 ? 'it is' : 'they are'} owed to the customer and will go out when more arrive.`
        );
      }
      const heldForOthers = line.notFree - line.owed;
      if (heldForOthers > 0) {
        parts.push(
          `${String(heldForOthers)} ${
            heldForOthers === 1 ? 'was' : 'were'
          } already set aside for another order, which is now short.`
        );
      }
      return parts.length > 0 ? `${line.name}: ${parts.join(' ')}` : '';
    })
    .filter((s) => s.length > 0)
    .join(' ');
}

/**
 * What an approval's stock commit came to, for the person who approved it, or
 * null when every unit came from stock set aside for the order. Read inside the
 * approval's transaction, off the commit it just made.
 */
export async function orderStockOutcomeOnTx(
  tx: TxClient,
  input: { orderId: string; committed: readonly CommittedSale[] }
): Promise<OrderStockOutcome | null> {
  const byVariant = new Map<string, { notFree: number; owed: number }>();
  for (const sale of input.committed) {
    if (sale.result.deduped) continue;
    const row = byVariant.get(sale.variantId) ?? { notFree: 0, owed: 0 };
    row.notFree += sale.shortQuantity;
    row.owed += sale.backorderedQuantity;
    byVariant.set(sale.variantId, row);
  }
  const short = [...byVariant].filter(([, row]) => row.notFree > 0 || row.owed > 0);
  if (short.length === 0) return null;

  const items = await tx.orderItem.findMany({
    where: { orderId: input.orderId, variantId: { in: short.map(([id]) => id) } },
    select: { variantId: true, sku: true, name: true, quantity: true },
  });
  const lines = short.map(([variantId, row]): OrderStockShortLine => {
    const mine = items.filter((i) => i.variantId === variantId);
    return {
      variantId,
      // An order line with no code carries '', which is not a code.
      sku: (mine[0]?.sku ?? '').trim() === '' ? null : (mine[0]?.sku ?? null),
      name: mine[0]?.name ?? 'items',
      ordered: mine.reduce((sum, i) => sum + i.quantity, 0),
      // Never fewer not-free than owed: a hold committed against a level that
      // had since been counted down is owed without having been "taken".
      notFree: Math.max(row.notFree, row.owed),
      owed: row.owed,
    };
  });
  return { lines, note: orderStockNote(lines) };
}

/**
 * How much of a line the shelves could not cover, written down as a commitment.
 *
 * The measure is the sale movement's own resulting balance, which is the only
 * number that is true after every concurrent writer has had its turn: on-hand at
 * −6 after the movement means six units were sold that were not there. Clamped
 * to the line quantity, because a level that was ALREADY negative before this
 * order arrived is somebody else's shortfall, not this customer's.
 *
 * A deduplicated movement records nothing. That is the retry guard: the same
 * order completing twice writes one sale and therefore one commitment, without
 * needing a second idempotency scheme of its own.
 */
async function noteShortfall(
  tx: TxClient,
  ctx: ServiceContext,
  params: {
    result: MovementResult;
    quantity: number;
    variantId: string;
    warehouseId: string;
    orderId: string;
    orderItemId: string | null;
    customerId: string | null;
  }
): Promise<{ backorderedQuantity: number; backorderId: string | null }> {
  if (params.result.deduped) return { backorderedQuantity: 0, backorderId: null };

  const shortfall = Math.min(params.quantity, Math.max(0, -params.result.onHand));
  if (shortfall <= 0) return { backorderedQuantity: 0, backorderId: null };

  // Count the units against a live preorder window, if there is one (docs/146
  // Phase 9.4). The cap was already enforced at reserve, where the customer
  // could still be told no; this is the counting, and it is locked because the
  // stored total is what the next customer's headroom is measured against.
  await consumePreorderOnTx(tx, ctx, {
    variantId: params.variantId,
    quantity: shortfall,
  }).catch(() => null);

  const recorded = await recordBackorderOnTx(tx, ctx, {
    variantId: params.variantId,
    warehouseId: params.warehouseId,
    shortfall,
    holderType: 'order',
    holderId: params.orderId,
    orderItemId: params.orderItemId,
    customerId: params.customerId,
  });

  return { backorderedQuantity: shortfall, backorderId: recorded?.backorderId ?? null };
}

/** Emit the post-commit threshold events for a set of committed sales. Call
 *  AFTER the transaction that produced them commits. */
export async function emitSaleEvents(ctx: ServiceContext, sales: CommittedSale[]): Promise<void> {
  for (const s of sales) {
    if (s.result.deduped) continue;
    await emitStockEvents(ctx, s.variantId, s.warehouseId, s.result, -s.quantity, 'sale');

    // A commitment nobody can cover. Fired at the moment of the promise rather
    // than by a nightly pass, because what reacts to it is a purchase decision —
    // a buyer wants to know a customer is waiting before tonight. Deliberately
    // carries no date: whether one can honestly be promised is resolved
    // separately, and the answer is often no.
    if (s.backorderId) {
      await publishInventoryEvent({
        tenantId: ctx.tenantId,
        actorId: ctx.userId ?? null,
        topic: 'inventory.backorder.created',
        data: {
          backorderId: s.backorderId,
          variantId: s.variantId,
          warehouseId: s.warehouseId,
          quantity: s.backorderedQuantity,
        },
      });
    }
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

    // Drop any reservations still holding `allocated` for this order: a held
    // order cancelled while it waited for a sign-off (it holds its stock as an
    // order, see `holdStockForOrderOnTx`), or units a short pick put back and
    // held. Through `releaseOrderHoldsOnTx`, the one way an order lets go, so
    // the product's in-stock flag moves with the stock.
    await releaseOrderHoldsOnTx(tx, ctx, { orderId: input.orderId });

    // Drop the customer commitments too (docs/146 Phase 9.1). Cancelling the
    // order without this leaves the queue claiming somebody is waiting for
    // units they no longer want — which then holds a delivery for a customer
    // who has already been refunded, ahead of one who has not.
    await cancelBackordersForHolderOnTx(tx, ctx, {
      holderType: 'order',
      holderId: input.orderId,
      reason: 'The order was canceled.',
    });
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
 * The location a channel ships from: the one named for it, else a settled
 * fallback (see `channelDefaultId`). Returns null when the tenant has no active
 * location. Postage, labels and returns read their ship-from address through
 * this, and the Locations screen marks the same row, so the two cannot
 * disagree. It used to end in `candidates[0]` of an unordered query (issue 929).
 */
export async function resolveDefaultWarehouseId(
  ctx: ServiceContext,
  channel = 'storefront'
): Promise<string | null> {
  return withTenant(ctx, async (tx) => {
    const candidates = await tx.warehouse.findMany({
      where: { isActive: true, deletedAt: null },
      select: CHANNEL_CANDIDATE_SELECT,
    });
    return channelDefaultId(candidates, channel);
  });
}
