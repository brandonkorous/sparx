// The bin ledger — `applyMovement` one layer down (docs/146 Phase 2).
//
// Same discipline as the warehouse ledger and for the same reasons: one writer,
// row-locked, idempotent, attributed, and `binLevel.onHand == Σ(delta)` for every
// bin. If bins had been given a looser contract than the layer above them, the
// first time the two disagreed nobody would know which to believe — and the whole
// argument of Phase 1 is that we always know.
//
// ── What this does NOT do ────────────────────────────────────────────────────
//
// It never touches `inventory_levels.on_hand` and never writes to
// `inventory_movements`. The warehouse ledger is the caller's business:
// `applyMovement` writes the warehouse row and then calls `applyBinMovement` with
// the id of the row it just wrote, so the two land in one transaction and the bin
// row can point at its parent. A bin-to-bin move calls this directly, twice, with
// no parent — because nothing entered or left the building and inventing a
// warehouse movement to describe it would put a fiction in the ledger.

import type { TxClient } from '@sparx/db';

import { InventoryValidationError } from '../errors';

import { orderBinCandidates, toPickStrategy } from './pick-allocation';
import type { PickStrategy } from './pick-allocation';

export interface BinMovementInput {
  tenantId: string;
  binId: string;
  variantId: string;
  warehouseId: string;
  /** Signed change to this bin's on-hand. */
  delta: number;
  reason: string;
  /** The warehouse ledger row this accompanies, when there is one. */
  movementId?: string | null;
  fromBinId?: string | null;
  toBinId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  actorType?: string;
  actorId?: string | null;
  source?: string | null;
  idempotencyKey?: string | null;
  note?: string | null;
  /**
   * Permit a bin to go negative.
   *
   * Default FALSE, and deliberately stricter than the warehouse ledger — which
   * allows it, because a `continue`-policy sale legitimately oversells a
   * location. A bin cannot be oversold in the same sense: a shelf holding minus
   * three of something is not a business decision, it is a bad put-away or a
   * pick from the wrong shelf, and the right response is to refuse and make
   * someone look. The one exception is a location-level oversell being seated
   * somewhere, which passes this explicitly.
   */
  allowNegative?: boolean;
  /** Stamp `lastCountedAt` — a count or a put-away physically confirmed it. */
  confirmsPhysicalCount?: boolean;
}

export interface BinMovementResult {
  binMovementId: string;
  deduped: boolean;
  appliedDelta: number;
  onHand: number;
}

interface LockedBinLevel {
  on_hand: number;
}

/**
 * Apply one bin movement inside the caller's tenant transaction.
 *
 * Mirrors `applyMovement`'s shape step for step — ensure-then-lock, dedupe,
 * compute, write, append — so anyone who has read one has read both.
 */
export async function applyBinMovement(
  tx: TxClient,
  input: BinMovementInput
): Promise<BinMovementResult> {
  // 1. Ensure the bin level exists so there is something to lock. Atomic
  //    INSERT … ON CONFLICT DO NOTHING rather than an upsert, for the reason the
  //    warehouse ledger does it: Prisma's upsert is SELECT-then-INSERT, so a
  //    concurrent burst of FIRST movements into a new (variant, bin) all see "no
  //    row" and collide on the primary key.
  await tx.$executeRaw`
    INSERT INTO inventory_bin_levels (tenant_id, variant_id, bin_id, warehouse_id, on_hand, as_of, updated_at)
    VALUES (${input.tenantId}::uuid, ${input.variantId}::uuid, ${input.binId}::uuid,
            ${input.warehouseId}::uuid, 0, now(), now())
    ON CONFLICT (variant_id, bin_id) DO NOTHING
  `;

  // 2. Lock it — serializes concurrent writers on this shelf.
  const locked = await tx.$queryRaw<LockedBinLevel[]>`
    SELECT on_hand
    FROM inventory_bin_levels
    WHERE variant_id = ${input.variantId}::uuid AND bin_id = ${input.binId}::uuid
    FOR UPDATE
  `;
  const current = locked[0];
  if (!current) {
    throw new InventoryValidationError('Bin level not found while applying a bin movement');
  }

  // 3. Idempotency, with the row held.
  if (input.idempotencyKey) {
    const existing = await tx.inventoryBinMovement.findFirst({
      where: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey },
      select: { id: true },
    });
    if (existing) {
      return {
        binMovementId: existing.id,
        deduped: true,
        appliedDelta: 0,
        onHand: current.on_hand,
      };
    }
  }

  if (input.delta === 0) {
    return { binMovementId: '', deduped: true, appliedDelta: 0, onHand: current.on_hand };
  }

  const newOnHand = current.on_hand + input.delta;
  if (newOnHand < 0 && !input.allowNegative) {
    throw new InventoryValidationError(
      `A shelf cannot hold a negative quantity — this bin has ${current.on_hand} and the change is ${input.delta}. ` +
        `Check whether the stock is on a different shelf before forcing it.`
    );
  }

  await tx.inventoryBinLevel.update({
    where: { variantId_binId: { variantId: input.variantId, binId: input.binId } },
    data: {
      onHand: newOnHand,
      asOf: new Date(),
      ...(input.confirmsPhysicalCount ? { lastCountedAt: new Date() } : {}),
    },
  });

  const row = await tx.inventoryBinMovement.create({
    data: {
      tenantId: input.tenantId,
      binId: input.binId,
      variantId: input.variantId,
      warehouseId: input.warehouseId,
      delta: input.delta,
      balanceAfter: newOnHand,
      reason: input.reason,
      movementId: input.movementId ?? null,
      fromBinId: input.fromBinId ?? null,
      toBinId: input.toBinId ?? null,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      actorType: input.actorType ?? 'system',
      actorId: input.actorId ?? null,
      source: input.source ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      note: input.note ?? null,
    },
    select: { id: true },
  });

  return { binMovementId: row.id, deduped: false, appliedDelta: input.delta, onHand: newOnHand };
}

/**
 * Read a bin's on-hand with the row LOCKED, creating it at zero if absent.
 *
 * For the caller that needs "how many are on this shelf right now, and hold that
 * answer still while I decide what to do about it" — a bin-scoped count posting.
 * The lock is held for the rest of the transaction, so the subsequent write
 * through `applyBinMovement` cannot race a sale that lands mid-count.
 *
 * Returns null when the location does not use bins.
 */
export async function lockBinOnHand(
  tx: TxClient,
  input: { tenantId: string; variantId: string; binId: string; warehouseId: string }
): Promise<number | null> {
  await tx.$executeRaw`
    INSERT INTO inventory_bin_levels (tenant_id, variant_id, bin_id, warehouse_id, on_hand, as_of, updated_at)
    VALUES (${input.tenantId}::uuid, ${input.variantId}::uuid, ${input.binId}::uuid,
            ${input.warehouseId}::uuid, 0, now(), now())
    ON CONFLICT (variant_id, bin_id) DO NOTHING
  `;
  const rows = await tx.$queryRaw<LockedBinLevel[]>`
    SELECT on_hand
    FROM inventory_bin_levels
    WHERE variant_id = ${input.variantId}::uuid AND bin_id = ${input.binId}::uuid
    FOR UPDATE
  `;
  return rows[0]?.on_hand ?? null;
}

/**
 * Seat a warehouse movement into a bin.
 *
 * Called by `applyMovement` after it has written the warehouse row. Resolves
 * which shelf the change belongs on, then mirrors it down.
 *
 *   • Inbound (delta > 0) goes to the named bin, else the variant's home shelf if
 *     it is in this warehouse, else the location's DEFAULT bin.
 *   • Outbound (delta < 0) is TAKEN FROM the named bin, else drawn down across
 *     the bins that actually hold stock, IN THE LOCATION'S ALLOCATION-STRATEGY
 *     ORDER — because a sale does not know which shelf a picker used, and
 *     refusing to record it until someone says would block every checkout in a
 *     bin-enabled warehouse.
 *
 *     That draw-down IS the allocation (docs/146 Phase 4.2). A pick list does not
 *     choose shelves; it reads the ones chosen here, because by the time the list
 *     is generated these units have already left the books. Until Phase 4 this
 *     ordering was hard-coded richest-first, which quietly meant FEFO did not
 *     exist — a warehouse with dated stock shipped whatever pile was biggest.
 *
 * Returns silently when the warehouse does not use bins. That early return is
 * what keeps bins genuinely optional rather than optional-in-the-UI-only.
 */
export async function mirrorMovementToBins(
  tx: TxClient,
  input: {
    tenantId: string;
    variantId: string;
    warehouseId: string;
    delta: number;
    reason: string;
    movementId: string;
    binId?: string | null;
    referenceType?: string | null;
    referenceId?: string | null;
    actorType?: string;
    actorId?: string | null;
    source?: string | null;
    /** The location-level write allowed a negative; the bin seating must too. */
    allowNegative?: boolean;
  }
): Promise<void> {
  const warehouse = await tx.warehouse.findFirst({
    where: { id: input.warehouseId },
    select: { usesBins: true, allocationStrategy: true },
  });
  if (!warehouse?.usesBins) return;

  const common = {
    tenantId: input.tenantId,
    variantId: input.variantId,
    warehouseId: input.warehouseId,
    reason: input.reason,
    movementId: input.movementId,
    referenceType: input.referenceType ?? null,
    referenceId: input.referenceId ?? null,
    actorType: input.actorType ?? 'system',
    actorId: input.actorId ?? null,
    source: input.source ?? null,
  };

  if (input.delta > 0) {
    const binId = input.binId ?? (await resolveInboundBin(tx, input));
    await applyBinMovement(tx, { ...common, binId, delta: input.delta });
    return;
  }

  if (input.binId) {
    await applyBinMovement(tx, {
      ...common,
      binId: input.binId,
      delta: input.delta,
      ...(input.allowNegative === undefined ? {} : { allowNegative: input.allowNegative }),
    });
    return;
  }

  await drawDownAcrossBins(
    tx,
    common,
    Math.abs(input.delta),
    input.allowNegative ?? false,
    toPickStrategy(warehouse.allocationStrategy)
  );
}

/** The shelf inbound stock lands on when nobody named one. */
async function resolveInboundBin(
  tx: TxClient,
  input: { tenantId: string; variantId: string; warehouseId: string }
): Promise<string> {
  // 1. The variant's home shelf, if it is in THIS warehouse. A home shelf in
  //    another building is not an answer to "where does this go here".
  const variant = await tx.productVariant.findFirst({
    where: { id: input.variantId },
    select: { defaultBinId: true },
  });
  if (variant?.defaultBinId) {
    const home = await tx.inventoryBin.findFirst({
      where: {
        id: variant.defaultBinId,
        warehouseId: input.warehouseId,
        isActive: true,
        deletedAt: null,
        // …and still SELLABLE. A home shelf that has since been turned into a
        // quarantine or damaged shelf must not silently receive new stock:
        // availability reads the location total, so units seated on a
        // not-for-sale shelf would go on being sold while a picker sent to fetch
        // them finds a box marked "on hold".
        isSellable: true,
      },
      select: { id: true },
    });
    if (home) return home.id;
  }

  // 2. A shelf that already holds this item — the strongest signal of where it
  //    lives, and free. Richest first so a top-up joins the main pile rather than
  //    starting a third one.
  const existing = await tx.inventoryBinLevel.findFirst({
    where: {
      tenantId: input.tenantId,
      variantId: input.variantId,
      warehouseId: input.warehouseId,
      onHand: { gt: 0 },
      bin: { isActive: true, deletedAt: null, isSellable: true },
    },
    orderBy: { onHand: 'desc' },
    select: { binId: true },
  });
  if (existing) return existing.binId;

  return defaultBinFor(tx, input.warehouseId);
}

/** The location's DEFAULT bin. Every warehouse has exactly one (a partial unique
 *  index enforces it) — created with the warehouse, or by the Phase 2 backfill. */
export async function defaultBinFor(tx: TxClient, warehouseId: string): Promise<string> {
  const bin = await tx.inventoryBin.findFirst({
    where: { warehouseId, isDefault: true },
    select: { id: true },
  });
  if (!bin) {
    throw new InventoryValidationError(
      'This location has no default shelf, so there is nowhere to record the stock. Turn bins off for it, or add one.'
    );
  }
  return bin.id;
}

/**
 * Take stock off the shelves that actually have it, in the location's chosen
 * order.
 *
 * A sale does not know which shelf a picker will walk to. Refusing to record it
 * until someone says would block checkout in every bin-enabled warehouse, and
 * guessing ONE shelf would drive that shelf negative while others sat full. So
 * the ledger picks, and — since a pick list later READS this decision rather than
 * making its own (docs/146 Phase 4.2) — it picks the way the warehouse asked to
 * be picked: FIFO by default, FEFO where stock is dated, nearest-bin for the
 * shortest walk, single-bin to keep a line on one shelf. Sellable shelves before
 * quarantine and damaged ones, and the pick face before bulk, always.
 *
 * When the shelves cannot cover it — which means the location was oversold, or
 * the bin seating has drifted — the remainder lands on the DEFAULT bin and is
 * allowed to go negative there. That is deliberate: the shortfall must be visible
 * SOMEWHERE, and the alternative is a bin sum that silently stops matching the
 * location. The Phase 1 reconciliation cross-check then reports it.
 */
async function drawDownAcrossBins(
  tx: TxClient,
  common: {
    tenantId: string;
    variantId: string;
    warehouseId: string;
    reason: string;
    movementId: string;
    referenceType: string | null;
    referenceId: string | null;
    actorType: string;
    actorId: string | null;
    source: string | null;
  },
  quantity: number,
  allowNegative: boolean,
  strategy: PickStrategy
): Promise<void> {
  const holding = await orderBinCandidates(tx, {
    tenantId: common.tenantId,
    variantId: common.variantId,
    warehouseId: common.warehouseId,
    strategy,
    quantity,
    // The ledger must be able to describe stock leaving a quarantine or damaged
    // shelf — a write-off, a disposal. They rank last, never excluded.
    includeNonSellable: true,
  });

  let remaining = quantity;
  for (const level of holding) {
    if (remaining <= 0) break;
    const take = Math.min(level.onHand, remaining);
    await applyBinMovement(tx, { ...common, binId: level.binId, delta: -take });
    remaining -= take;
  }

  if (remaining > 0) {
    const fallback = await defaultBinFor(tx, common.warehouseId);
    await applyBinMovement(tx, {
      ...common,
      binId: fallback,
      delta: -remaining,
      // The location itself permitted this, or the seating has drifted. Either
      // way the shortfall is real and must be visible rather than dropped.
      allowNegative: true,
      note: allowNegative
        ? 'Sold past what the shelves held — the location allows selling below zero.'
        : 'The shelves did not add up to what left. Count this item to settle where it went.',
    });
  }
}
