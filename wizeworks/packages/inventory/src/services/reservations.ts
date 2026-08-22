// Reservations — soft (cart, TTL) and hard (order/subscription) holds against
// future fulfillment. Reserve/release/expire move only `allocated` (the
// InventoryReservation rows ARE the allocated ledger, so they write no movement
// row). Commit (the sell-path one) is the one that actually removes stock — it
// funnels the onHand decrement through `applyMovement` as a `sale`; see
// ./sell-path.ts.
//
// The tenant-tx-aware cores (`reserveOnTx` / `releaseOnTx`) are exported so the
// commerce cart seam can reserve/release ATOMICALLY with the cart-line write
// (one transaction, no window where the line exists without its hold). The
// public `reserve` / `release` wrap them in their own `withTenant`.

import { ReserveInventoryInput } from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import type { TxClient } from '@wizeworks/db';

import {
  InventoryNotFoundError,
  InventoryOutOfStockError,
  InventoryValidationError,
} from '../errors';
import type { ServiceContext } from '../errors';

import { CART_TTL_SECONDS_DEFAULT, syncProductInStock } from './internal';
import { recordOversellIncidentDetached, recordOversellIncidentOnTx } from './integrity';
import { applyMovement, emitStockEvents, resolveActorType } from './ledger';
import { assertPreorderHeadroomOnTx } from './preorders';

export interface ReservationResult {
  reservationId: string;
  warehouseId: string;
  expiresAt: string | null;
}

interface LockedLevel {
  on_hand: number;
  allocated: number;
  safety_buffer: number;
}

/**
 * The sales channel a hold belongs to.
 *
 * Shared by the warehouse allocator (which routes on it) and the oversell
 * incident recorder (which reports on it) — two callers that must agree, because
 * an incident attributed to a different channel than the one the allocator
 * routed for is worse than no attribution.
 */
export function channelForHolder(holderType: string): string {
  if (holderType === 'cart') return 'storefront';
  if (holderType === 'subscription') return 'subscription';
  return 'admin';
}

/**
 * Feed context for an incident: which external source (if any) feeds this level,
 * and how old the number was when the decision was made.
 *
 * A cluster of oversells next to a four-hour-old feed is a diagnosis; the same
 * cluster with no age attached is a mystery. Only called on the shortfall path,
 * so the extra read costs nothing on a normal reserve.
 */
async function incidentFeedContext(
  tx: TxClient,
  ctx: ServiceContext,
  variantId: string,
  warehouseId: string
): Promise<{ sourceId: string | null; stockAgeSeconds: number | null }> {
  const [link, level] = await Promise.all([
    tx.inventorySourceLink.findFirst({
      where: { tenantId: ctx.tenantId, variantId, warehouseId, status: 'active' },
      select: { sourceId: true },
    }),
    tx.inventoryLevel.findFirst({
      where: { tenantId: ctx.tenantId, variantId, warehouseId },
      select: { asOf: true },
    }),
  ]);
  return {
    sourceId: link?.sourceId ?? null,
    stockAgeSeconds: level
      ? Math.max(0, Math.floor((Date.now() - level.asOf.getTime()) / 1000))
      : null,
  };
}

/**
 * Reserve stock for a cart line, order line, or subscription occurrence —
 * INSIDE the caller's tenant transaction. Picks a warehouse if not specified
 * (the stock-aware allocator below), then locks the chosen level `FOR UPDATE`
 * before the availability check so two carts racing for the last unit can't both
 * pass under a `deny` policy. Throws InventoryOutOfStockError when stock is short
 * and the variant's inventoryPolicy is `deny`. For `continue` / `preorder`,
 * succeeds even when short (allocated may temporarily exceed onHand — surfaces as
 * a negative `available` in the dashboard).
 *
 * Returns `null` for a variant NOBODY HAS EVER COUNTED — see below. There is no
 * hold to record, exactly as under a disabled inventory module, and callers
 * already handle a line with no reservation (a dropship variant takes the same
 * path).
 */
export async function reserveOnTx(
  tx: TxClient,
  ctx: ServiceContext,
  input: ReserveInventoryInput
): Promise<ReservationResult | null> {
  const variant = await tx.productVariant.findFirst({
    where: { id: input.variantId, deletedAt: null },
    select: { id: true, inventoryPolicy: true },
  });
  if (!variant) throw new InventoryNotFoundError('Variant', input.variantId);

  // ── NEVER COUNTED → UNTRACKED, AND NO ROW IS INVENTED ─────────────────────
  //
  // A variant with no inventory_levels row anywhere has never been counted, and
  // `computeAvailability` treats that as untracked rather than as a count of
  // zero (see availability.ts). This is the same rule at the write end, and it
  // has to be here or the read end is defeated the first time anyone uses it.
  //
  // What happened without it, and it is worse than the badge it mirrors: the
  // INSERT below CREATES a 0/0 level row before judging against it. So the first
  // customer to press Add to cart on a product that had never been counted got
  // OUT_OF_STOCK — and left behind a level row that made the variant genuinely,
  // permanently sold out. One click silently converted "nobody has counted this"
  // into "there are none", and no screen anywhere in the platform said so.
  //
  // Bailing BEFORE the insert is the point: a level row must keep meaning
  // "somebody counted this". Inventing one to answer a question is what turned a
  // missing measurement into a false one.
  const counted = await tx.inventoryLevel.count({ where: { variantId: input.variantId } });
  if (counted === 0) return null;

  const warehouseId =
    input.warehouseId ??
    (await pickWarehouseFor(tx, {
      variantId: input.variantId,
      quantity: input.quantity,
      holderType: input.holderType,
    }));

  // Ensure the level row exists atomically (Prisma upsert is SELECT-then-INSERT
  // and would collide on a concurrent first reserve), then lock it FOR UPDATE so
  // the availability check + allocated bump serialize against concurrent holds.
  await tx.$executeRaw`
    INSERT INTO inventory_levels (tenant_id, variant_id, warehouse_id, on_hand, allocated, as_of, updated_at)
    VALUES (${ctx.tenantId}::uuid, ${input.variantId}::uuid, ${warehouseId}::uuid, 0, 0, now(), now())
    ON CONFLICT (variant_id, warehouse_id) DO NOTHING
  `;
  const locked = await tx.$queryRaw<LockedLevel[]>`
    SELECT on_hand, allocated, safety_buffer
    FROM inventory_levels
    WHERE variant_id = ${input.variantId}::uuid AND warehouse_id = ${warehouseId}::uuid
    FOR UPDATE
  `;
  const current = locked[0];
  if (!current) {
    throw new InventoryValidationError('Inventory level not found while reserving stock');
  }

  // Net the safety buffer (docs/28 §5.3): the last N units are withheld from sale,
  // so a `deny` variant can't be reserved into the buffer.
  const available = current.on_hand - current.allocated - current.safety_buffer;

  // Record the shortfall BEFORE deciding what to do about it (docs/146 Phase 1).
  // Both outcomes are worth a row and they are different events: `blocked` is
  // revenue we refused, `allowed` is a promise we may not be able to keep. The
  // pair is the raw material of the oversell surface, and today the only trace
  // either leaves is a customer-facing error or nothing at all.
  if (available < input.quantity) {
    const incident = {
      variantId: input.variantId,
      warehouseId,
      requestedQuantity: input.quantity,
      availableQuantity: available,
      onHandAtDecision: current.on_hand,
      allocatedAtDecision: current.allocated,
      bufferAtDecision: current.safety_buffer,
      policy: variant.inventoryPolicy,
      channel: channelForHolder(input.holderType),
      holderType: input.holderType,
      holderId: input.holderId,
      actorType: resolveActorType(ctx),
      actorId: ctx.userId ?? null,
      ...(await incidentFeedContext(tx, ctx, input.variantId, warehouseId)),
    };

    if (variant.inventoryPolicy === 'deny') {
      // The caller's transaction is about to roll back with the throw below, so
      // an in-transaction write would vanish with it — and the refused sale is
      // precisely the incident an operator most wants to see. Detached, and
      // best-effort: observability must never be able to fail a checkout.
      await recordOversellIncidentDetached(ctx, { ...incident, kind: 'blocked' });
      throw new InventoryOutOfStockError(input.variantId, input.quantity, Math.max(0, available));
    }

    // A `preorder` variant with a live WINDOW is a bounded offer, not an open
    // tap (docs/146 Phase 9.4). This is where the cap is enforced, because this
    // is the moment a customer can still be told no — refusing at commit would
    // mean refusing after they have paid. The units are COUNTED at commit, not
    // here, since a cart is not yet a commitment.
    //
    // The gap between the two is deliberate and small: a cart that clears the
    // cap and checks out ten minutes later, behind someone else's, can overshoot
    // by that cart. The overshoot is then recorded truthfully rather than
    // clamped away — `preorderState` reports zero remaining and the window
    // refuses to have its limit edited below what is already owed.
    if (variant.inventoryPolicy === 'preorder') {
      await assertPreorderHeadroomOnTx(tx, ctx, {
        variantId: input.variantId,
        quantity: input.quantity - Math.max(0, available),
      });
    }

    // `continue` / `preorder` — the hold succeeds and this transaction commits,
    // so the incident lands with the thing it describes.
    await recordOversellIncidentOnTx(tx, ctx, { ...incident, kind: 'allowed' });
  }

  await tx.inventoryLevel.update({
    where: { variantId_warehouseId: { variantId: input.variantId, warehouseId } },
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
}

/** Public reserve — opens its own tenant transaction. Null when the variant has
 *  never been counted; see `reserveOnTx`. */
export async function reserve(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<ReservationResult | null> {
  const input = ReserveInventoryInput.parse(rawInput);
  return withTenant(ctx, (tx) => reserveOnTx(tx, ctx, input));
}

/**
 * Release an active reservation INSIDE the caller's transaction. Returns the
 * freed quantity to `allocated`. Idempotent — a non-active reservation no-ops,
 * and an unknown id no-ops (the line may point at a reaped hold).
 */
export async function releaseOnTx(
  tx: TxClient,
  _ctx: ServiceContext,
  reservationId: string
): Promise<void> {
  const reservation = await tx.inventoryReservation.findFirst({ where: { id: reservationId } });
  if (reservation?.status !== 'active') return;

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
}

// ─── Reading holds ────────────────────────────────────────────────────
//
// `allocated` on a level is a NUMBER; these rows are the itemization of it. The
// question an operator actually asks on a stock screen is not "how many are
// allocated" but "allocated to WHAT, and when does that free up" — a cart hold
// that expires in ten minutes and an order hold that never will are the same
// integer and completely different situations.

export interface ReservationRow {
  id: string;
  variantId: string;
  variantSku: string | null;
  productId: string | null;
  warehouseId: string;
  warehouseName: string | null;
  warehouseCode: string | null;
  quantity: number;
  /** What is holding it: `cart` | `order` | `subscription`. */
  holderType: string;
  holderId: string;
  /** `active` | `released` | `committed` | `expired`. */
  status: string;
  /** When a soft (cart) hold lapses on its own. Null on a hard hold. */
  expiresAt: string | null;
  createdAt: string;
  releasedAt: string | null;
}

export interface ListReservationsFilter {
  variantId?: string;
  /** Every hold against ONE product in a single request — the product-scoped
   *  stock view's read, batched for the same reason `listInventory`'s is. */
  productId?: string;
  warehouseId?: string;
  holderType?: string;
  /** Defaults to `active` only: released/committed/expired holds are history,
   *  and they are what makes an unfiltered list unreadable on a busy variant. */
  status?: string;
  take?: number;
  skip?: number;
}

export async function listReservations(
  ctx: ServiceContext,
  filter: ListReservationsFilter = {}
): Promise<{ items: ReservationRow[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    // Explicit tenant scope as well as RLS: the local `sparx_owner` is a
    // SUPERUSER and bypasses RLS, so a broad scan would cross tenants in tests.
    const where = {
      tenantId: ctx.tenantId,
      status: filter.status ?? 'active',
      ...(filter.variantId ? { variantId: filter.variantId } : {}),
      ...(filter.productId ? { variant: { productId: filter.productId } } : {}),
      ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
      ...(filter.holderType ? { holderType: filter.holderType } : {}),
    };
    const include = {
      variant: { select: { sku: true, productId: true } },
      warehouse: { select: { name: true, code: true } },
    };
    const [rows, total] = await Promise.all([
      tx.inventoryReservation.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        take: Math.min(filter.take ?? 50, 250),
        skip: filter.skip ?? 0,
      }),
      tx.inventoryReservation.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        variantId: r.variantId,
        variantSku: r.variant?.sku ?? null,
        productId: r.variant?.productId ?? null,
        warehouseId: r.warehouseId,
        warehouseName: r.warehouse?.name ?? null,
        warehouseCode: r.warehouse?.code ?? null,
        quantity: r.quantity,
        holderType: r.holderType,
        holderId: r.holderId,
        status: r.status,
        expiresAt: r.expiresAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        releasedAt: r.releasedAt?.toISOString() ?? null,
      })),
      total,
    };
  });
}

/** Public release — opens its own tenant transaction. Throws on an unknown id
 *  (the explicit API contract); the cart seam uses `releaseOnTx`, which no-ops. */
export async function release(ctx: ServiceContext, reservationId: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const reservation = await tx.inventoryReservation.findFirst({ where: { id: reservationId } });
    if (!reservation) throw new InventoryNotFoundError('InventoryReservation', reservationId);
    await releaseOnTx(tx, ctx, reservationId);
  });
}

/**
 * Commit an active reservation — the goods have left the building. Funnels the
 * onHand decrement through the ledger (`sale` movement) and drops `allocated`
 * in the same locked write, then emits threshold events. `idempotencyKey` lets
 * a redelivered fulfillment/order event commit exactly once. (The sell-path
 * commit that runs inside the checkout tx lives in ./sell-path.ts; this is the
 * standalone form for callers committing a single hard hold.)
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

/**
 * Stock-aware single-source allocator. Resolves the channel from the holder, then
 * prefers an active warehouse that (a) defaults for the channel AND can fulfill
 * the quantity, else (b) any warehouse that can fulfill, else (c) the channel
 * default (a backorder under a continue/preorder policy), else (d) the first
 * active warehouse. Multi-warehouse split + proximity/cost routing layer on top
 * of this once the location geo/cost model lands (docs/100 P5) — this is the
 * deterministic single-source floor the sell path needs today.
 */
export async function pickWarehouseFor(
  tx: TxClient,
  input: { variantId: string; quantity: number; holderType: string }
): Promise<string> {
  const channel = channelForHolder(input.holderType);

  const candidates = await tx.warehouse.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, defaultForChannel: true },
  });
  if (candidates.length === 0) {
    throw new InventoryValidationError(
      'No active warehouses exist — create one before reserving stock'
    );
  }

  const channelMatches = candidates.filter((w) => {
    const list = Array.isArray(w.defaultForChannel) ? (w.defaultForChannel as string[]) : [];
    return list.includes(channel);
  });

  // Available stock for this variant across the candidate warehouses, net of each
  // level's safety buffer (the allocator won't pick a warehouse it can only fill
  // by dipping into the withheld buffer).
  const levels = await tx.inventoryLevel.findMany({
    where: { variantId: input.variantId, warehouseId: { in: candidates.map((w) => w.id) } },
    select: { warehouseId: true, onHand: true, allocated: true, safetyBuffer: true },
  });
  const availableBy = new Map(
    levels.map((l) => [l.warehouseId, l.onHand - l.allocated - l.safetyBuffer])
  );
  const canFulfill = (id: string): boolean => (availableBy.get(id) ?? 0) >= input.quantity;

  // (a) channel-default warehouse that can fulfill, richest first.
  const channelFulfilling = channelMatches
    .filter((w) => canFulfill(w.id))
    .sort((a, b) => (availableBy.get(b.id) ?? 0) - (availableBy.get(a.id) ?? 0));
  if (channelFulfilling[0]) return channelFulfilling[0].id;

  // (b) any warehouse that can fulfill, richest first.
  const anyFulfilling = candidates
    .filter((w) => canFulfill(w.id))
    .sort((a, b) => (availableBy.get(b.id) ?? 0) - (availableBy.get(a.id) ?? 0));
  if (anyFulfilling[0]) return anyFulfilling[0].id;

  // (c) channel default (backorder), then (d) first active.
  return (channelMatches[0] ?? candidates[0])!.id;
}
