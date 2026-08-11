// Provenance — why is this number what it is (docs/146 Phase 1, D1).
//
// This is the read the whole trust pillar rests on. Every competitor in this
// category shows an operator a quantity and asks to be believed. We already
// record enough to be CHECKED instead: `applyMovement()` is the only writer of
// `on_hand`, and it stamps every row with an actor, a source, a reference and a
// running balance. Nobody has surfaced it because nobody else has it.
//
// One call answers, for one (variant, warehouse):
//
//   • What is the number, and how does it decompose — on-hand, allocated,
//     buffer, and the sellable figure that falls out of them.
//   • Where did the on-hand come from — Σ of the ledger, and the recent rows
//     that moved it, each attributed.
//   • Who is holding the allocated units, and when does each hold free up.
//   • How OLD is the number, which source last touched it, and is that source
//     inside its freshness promise.
//   • Does the ledger still add up — recorded vs derived, right now.
//
// It is deliberately ONE call. The value is being able to answer "why" without
// a research project, and four round trips to four surfaces is a research project.

import { withTenant } from '@sparx/db';

import { InventoryNotFoundError } from '../errors';
import type { ServiceContext } from '../errors';

import { resolveChannelBufferOnTx } from './channel-buffers';
import { resolveStalenessPenaltyOnTx } from './freshness';
import type { StalenessPenalty } from './freshness';

export interface ProvenanceMovement {
  id: string;
  delta: number;
  balanceAfter: number | null;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  actorType: string;
  actorId: string | null;
  source: string | null;
  note: string | null;
  createdAt: string;
}

export interface ProvenanceHold {
  id: string;
  quantity: number;
  holderType: string;
  holderId: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface ProvenanceSource {
  sourceId: string;
  name: string;
  type: string;
  lastSyncAt: string | null;
  isStale: boolean;
  staleSince: string | null;
  expectedIntervalSec: number;
  externalSku: string;
  externalLocation: string | null;
  /** Feed rows are often in a pack UoM; this is the multiplier applied. */
  unitsPerExternal: number;
  linkLastSeenAt: string | null;
  linkIsStale: boolean;
}

export interface StockProvenance {
  variantId: string;
  variantSku: string | null;
  productId: string | null;
  productTitle: string | null;
  warehouseId: string;
  warehouseName: string | null;
  warehouseCode: string | null;

  // ── The number, decomposed ──
  onHand: number;
  allocated: number;
  safetyBuffer: number;
  /** on_hand − allocated − buffer. What a `deny` variant may actually sell. */
  sellable: number;
  /** Per-channel resolution when a channel was asked about. */
  channel: {
    channel: string;
    buffer: number;
    bufferSource: 'override' | 'channel_default' | 'level';
    /** Extra units withheld right now because a feed is in breach of its SLO. */
    stalenessExtraBuffer: number;
    /** Sellable on THIS channel, after both cushions. */
    sellable: number;
    /** External channel selling is currently suspended for this level. */
    channelsPaused: boolean;
  } | null;

  // ── Where it came from ──
  /** Σ(delta) over the whole ledger for this level, computed now. */
  derivedOnHand: number;
  /** true when recorded == derived. The claim, checked. */
  reconciles: boolean;
  movementCount: number;
  recentMovements: ProvenanceMovement[];

  // ── Who is holding it ──
  holds: ProvenanceHold[];

  // ── How fresh it is ──
  asOf: string;
  ageSeconds: number;
  updatedAt: string;
  lastMovementAt: string | null;
  sources: ProvenanceSource[];
  staleness: StalenessPenalty;

  // ── Cost basis, because valuation questions arrive with the same click ──
  avgCostCents: number | null;
  unitCostCents: number | null;
}

export interface ProvenanceOptions {
  /** Resolve the per-channel cushion for this channel as well as the base level. */
  channel?: string;
  /** How many ledger rows to return. The drawer shows a handful; the full history
   *  is the movements list, which this deliberately does not duplicate. */
  movementLimit?: number;
}

interface DerivedRow {
  derived: number;
  movementCount: number;
  lastMovementAt: Date | null;
}

/**
 * Explain one (variant, warehouse) stock number.
 *
 * Throws NOT_FOUND when no level row exists — which is a real answer, not an
 * error to paper over: it means nothing has ever moved this item at this
 * location, and showing zeros as though they were measured would be a lie.
 */
export async function stockProvenance(
  ctx: ServiceContext,
  input: { variantId: string; warehouseId: string },
  opts: ProvenanceOptions = {}
): Promise<StockProvenance> {
  const movementLimit = Math.min(Math.max(opts.movementLimit ?? 20, 1), 100);

  return withTenant(ctx, async (tx) => {
    const level = await tx.inventoryLevel.findFirst({
      where: {
        tenantId: ctx.tenantId,
        variantId: input.variantId,
        warehouseId: input.warehouseId,
      },
      include: {
        variant: {
          select: { sku: true, title: true, productId: true, product: { select: { title: true } } },
        },
        warehouse: { select: { name: true, code: true } },
      },
    });
    if (!level) {
      throw new InventoryNotFoundError('InventoryLevel', `${input.variantId}@${input.warehouseId}`);
    }

    // Σ(delta) recomputed here rather than read from a cached reconciliation run:
    // the point of the drawer is to answer "is this right NOW", and a number from
    // last night's job cannot do that.
    const derivedRows = await tx.$queryRaw<DerivedRow[]>`
      SELECT COALESCE(SUM(delta), 0)::int AS "derived",
             COUNT(*)::int                AS "movementCount",
             MAX(created_at)              AS "lastMovementAt"
        FROM inventory_movements
       WHERE tenant_id = ${ctx.tenantId}::uuid
         AND variant_id = ${input.variantId}::uuid
         AND warehouse_id = ${input.warehouseId}::uuid
    `;
    const derived = derivedRows[0] ?? { derived: 0, movementCount: 0, lastMovementAt: null };

    const [movements, holds, sourceLinks, staleness] = await Promise.all([
      tx.inventoryMovement.findMany({
        where: {
          tenantId: ctx.tenantId,
          variantId: input.variantId,
          warehouseId: input.warehouseId,
        },
        orderBy: { createdAt: 'desc' },
        take: movementLimit,
      }),
      tx.inventoryReservation.findMany({
        where: {
          tenantId: ctx.tenantId,
          variantId: input.variantId,
          warehouseId: input.warehouseId,
          status: 'active',
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      tx.inventorySourceLink.findMany({
        where: {
          tenantId: ctx.tenantId,
          variantId: input.variantId,
          warehouseId: input.warehouseId,
          status: 'active',
        },
        include: {
          source: {
            select: {
              id: true,
              name: true,
              type: true,
              lastSyncAt: true,
              isStale: true,
              staleSince: true,
              expectedIntervalSec: true,
              deletedAt: true,
            },
          },
        },
      }),
      resolveStalenessPenaltyOnTx(tx, ctx, input),
    ]);

    const sellable = level.onHand - level.allocated - level.safetyBuffer;

    let channel: StockProvenance['channel'] = null;
    if (opts.channel) {
      const resolved = await resolveChannelBufferOnTx(tx, ctx, {
        variantId: input.variantId,
        warehouseId: input.warehouseId,
        channel: opts.channel,
        levelSafetyBuffer: level.safetyBuffer,
      });
      channel = {
        channel: resolved.channel,
        buffer: resolved.buffer,
        bufferSource: resolved.source,
        stalenessExtraBuffer: staleness.extraBuffer,
        sellable: level.onHand - level.allocated - resolved.buffer - staleness.extraBuffer,
        channelsPaused: staleness.pauseChannels,
      };
    }

    const asOf = level.asOf;
    return {
      variantId: level.variantId,
      variantSku: level.variant?.sku ?? null,
      productId: level.variant?.productId ?? null,
      productTitle: level.variant?.product?.title ?? level.variant?.title ?? null,
      warehouseId: level.warehouseId,
      warehouseName: level.warehouse?.name ?? null,
      warehouseCode: level.warehouse?.code ?? null,

      onHand: level.onHand,
      allocated: level.allocated,
      safetyBuffer: level.safetyBuffer,
      sellable,
      channel,

      derivedOnHand: derived.derived,
      reconciles: level.onHand === derived.derived,
      movementCount: derived.movementCount,
      recentMovements: movements.map((m) => ({
        id: m.id,
        delta: m.delta,
        balanceAfter: m.balanceAfter,
        reason: m.reason,
        referenceType: m.referenceType,
        referenceId: m.referenceId,
        actorType: m.actorType,
        actorId: m.actorId,
        source: m.source,
        note: m.note,
        createdAt: m.createdAt.toISOString(),
      })),

      holds: holds.map((h) => ({
        id: h.id,
        quantity: h.quantity,
        holderType: h.holderType,
        holderId: h.holderId,
        expiresAt: h.expiresAt?.toISOString() ?? null,
        createdAt: h.createdAt.toISOString(),
      })),

      asOf: asOf.toISOString(),
      ageSeconds: Math.max(0, Math.floor((Date.now() - asOf.getTime()) / 1000)),
      updatedAt: level.updatedAt.toISOString(),
      lastMovementAt: derived.lastMovementAt?.toISOString() ?? null,
      // A soft-deleted source keeps its links (the rows are history), but it is
      // not something that still feeds this level, so it must not appear as one.
      sources: sourceLinks.flatMap((l) => {
        const s = l.source;
        if (s?.deletedAt !== null) return [];
        return [
          {
            sourceId: s.id,
            name: s.name,
            type: s.type,
            lastSyncAt: s.lastSyncAt?.toISOString() ?? null,
            isStale: s.isStale,
            staleSince: s.staleSince?.toISOString() ?? null,
            expectedIntervalSec: s.expectedIntervalSec,
            externalSku: l.externalSku,
            externalLocation: l.externalLocation,
            unitsPerExternal: l.unitsPerExternal,
            linkLastSeenAt: l.lastSeenAt?.toISOString() ?? null,
            linkIsStale: l.isStale,
          },
        ];
      }),
      staleness,

      avgCostCents: level.avgCostCents,
      unitCostCents: level.unitCostCents,
    };
  });
}
