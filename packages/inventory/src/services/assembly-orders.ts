// Assembly orders — building things, and taking them apart (docs/146 Phase 6.5, 6.6).
//
// ── Everything moves through the one ledger ──────────────────────────────────
//
// Completing a run writes ordinary `applyMovement` calls in a single
// transaction: one `assembly_out` per component and one `assembly_in` for what
// came out. No second writer of `on_hand`, no bespoke arithmetic, and the
// movement feed reads "twelve left because we built something" rather than going
// quiet at the one moment stock changes shape.
//
// A disassembly is the same two reasons the other way round — `assembly_out` on
// the finished unit, `assembly_in` on each component. One vocabulary, because it
// is one event with the arrows reversed.
//
// ── Releasing HOLDS; completing CONSUMES ─────────────────────────────────────
//
// A released run reserves its components rather than taking them. That is the
// whole point of having a state between "planned" and "done": the parts a
// scheduled build needs stop being sellable the moment the build is committed
// to, and nobody discovers at the bench that the last four hinges went out on an
// order this morning. Cancelling releases the hold and consumes nothing.
//
// ── The cost is real, not estimated ──────────────────────────────────────────
//
// Each component's `assembly_out` is stamped with `cost_consumed_cents` by the
// cost ledger (Phase 5), per the tenant's costing method. So the finished unit's
// cost is the SUM OF WHAT ACTUALLY LEFT THE SHELF plus labour, divided by how
// many came out. Before Phase 5 this would have had to guess from a price list;
// the recipe's own estimate is still shown next to it, and the difference
// between the two is worth looking at.

import {
  CancelAssemblyOrderInput,
  CompleteAssemblyOrderInput,
  CreateAssemblyOrderInput,
  UpdateAssemblyOrderInput,
  requiredForRun,
} from '@sparx/commerce-schemas';
import type { AssemblyKind, AssemblyStatus } from '@sparx/commerce-schemas';
import { Prisma, withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import { writeAuditLog } from '../audit';
import {
  InventoryConflictError,
  InventoryNotFoundError,
  InventoryValidationError,
} from '../errors';
import type { ServiceContext } from '../errors';
import { publishInventoryEvent } from '../events';

import { applyMovement, emitStockEvents, resolveActorType } from './ledger';
import type { MovementResult } from './ledger';

// ─── Row shapes ────────────────────────────────────────────────────────────────

export interface AssemblyLineRow {
  id: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  quantityPerBatch: number;
  scrapPercent: number;
  quantityRequired: number;
  quantityConsumed: number;
  costConsumedCents: number;
  movementId: string | null;
  position: number;
}

export interface AssemblyOrderRow {
  id: string;
  number: string;
  kind: AssemblyKind;
  status: AssemblyStatus;
  bomId: string | null;
  bomName: string | null;
  outputVariantId: string;
  outputSku: string | null;
  outputTitle: string | null;
  warehouseId: string;
  warehouseName: string | null;
  quantityPlanned: number;
  quantityCompleted: number;
  laborCostCents: number;
  outputUnitCostCents: number | null;
  totalCostCents: number | null;
  notes: string | null;
  plannedFor: string | null;
  releasedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledReason: string | null;
  createdAt: string;
}

export interface AssemblyOrderDetail extends AssemblyOrderRow {
  lines: AssemblyLineRow[];
}

const DETAIL_INCLUDE = {
  bom: { select: { name: true } },
  outputVariant: { select: { sku: true, product: { select: { title: true } } } },
  warehouse: { select: { name: true } },
  lines: {
    orderBy: { position: 'asc' },
    include: { variant: { select: { sku: true, product: { select: { title: true } } } } },
  },
} satisfies Prisma.AssemblyOrderInclude;

type OrderWithAll = Prisma.AssemblyOrderGetPayload<{ include: typeof DETAIL_INCLUDE }>;

// ─── Reads ─────────────────────────────────────────────────────────────────────

export async function listAssemblyOrders(
  ctx: ServiceContext,
  filter: {
    q?: string;
    status?: AssemblyStatus;
    kind?: AssemblyKind;
    warehouseId?: string;
    take?: number;
    skip?: number;
  } = {}
): Promise<{ items: AssemblyOrderRow[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const where: Prisma.AssemblyOrderWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.kind ? { kind: filter.kind } : {}),
      ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
      ...(filter.q
        ? {
            OR: [
              { number: { contains: filter.q, mode: 'insensitive' } },
              { outputVariant: { sku: { contains: filter.q, mode: 'insensitive' } } },
              {
                outputVariant: { product: { title: { contains: filter.q, mode: 'insensitive' } } },
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      tx.assemblyOrder.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        take: Math.min(filter.take ?? 50, 250),
        skip: filter.skip ?? 0,
        include: DETAIL_INCLUDE,
      }),
      tx.assemblyOrder.count({ where }),
    ]);
    return { items: rows.map(serializeRow), total };
  });
}

export async function getAssemblyOrder(
  ctx: ServiceContext,
  id: string
): Promise<AssemblyOrderDetail> {
  return withTenant(ctx, (tx) => loadDetail(tx, id));
}

// ─── Planning a run ────────────────────────────────────────────────────────────

/**
 * Plan a run. Nothing moves and nothing is held — this is the paper stage.
 *
 * The recipe is SNAPSHOT onto the lines here rather than read at completion, so
 * editing the bill tomorrow cannot change what a run already committed to. That
 * is the same reason a purchase order snapshots its prices.
 */
export async function createAssemblyOrder(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<AssemblyOrderDetail> {
  const input = CreateAssemblyOrderInput.parse(rawInput);
  const kind = input.kind ?? 'assemble';

  // The number is allocated count+1; a lost race trips the unique constraint and
  // poisons the transaction, so the WHOLE attempt retries.
  let created: string | undefined;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      created = await createOnce(ctx, input, kind);
      break;
    } catch (err) {
      if (isUniqueViolation(err) && attempt < 4) continue;
      throw err;
    }
  }
  if (!created) throw new InventoryValidationError('Could not allocate an assembly number');
  return getAssemblyOrder(ctx, created);
}

async function createOnce(
  ctx: ServiceContext,
  input: CreateAssemblyOrderInput,
  kind: AssemblyKind
): Promise<string> {
  return withTenant(ctx, async (tx) => {
    const bom = input.bomId
      ? await tx.billOfMaterials.findFirst({
          where: { id: input.bomId },
          include: { components: { orderBy: { position: 'asc' } } },
        })
      : null;
    if (input.bomId && !bom) throw new InventoryNotFoundError('BillOfMaterials', input.bomId);

    const outputVariantId = bom?.outputVariantId ?? input.outputVariantId;
    if (!outputVariantId) {
      throw new InventoryValidationError(
        'Say what is being made — either pick a recipe or name the item.',
        [{ field: 'outputVariantId', message: 'no output' }]
      );
    }
    // Building something needs a recipe. Taking something apart does not always:
    // the bill may have been archived since, and refusing would mean
    // un-archiving a recipe to disassemble one unit.
    if (kind === 'assemble' && !bom) {
      throw new InventoryValidationError(
        'Building something needs a recipe — pick the bill of materials to build to.',
        [{ field: 'bomId', message: 'required for an assembly' }]
      );
    }
    if (bom?.status === 'draft') {
      throw new InventoryConflictError(
        `${bom.name} is still a draft. Mark it active before building to it, so everyone is building to the same recipe.`,
        'bomId'
      );
    }

    const warehouse = await tx.warehouse.findFirst({
      where: { id: input.warehouseId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!warehouse) throw new InventoryNotFoundError('Warehouse', input.warehouseId);

    const number = await nextAssemblyNumber(tx, ctx.tenantId);
    const order = await tx.assemblyOrder.create({
      data: {
        tenantId: ctx.tenantId,
        number,
        kind,
        bomId: bom?.id ?? null,
        outputVariantId,
        warehouseId: input.warehouseId,
        quantityPlanned: input.quantity,
        laborCostCents: input.laborCostCents ?? bom?.laborCostCents ?? 0,
        plannedFor: input.plannedFor ? new Date(input.plannedFor) : null,
        notes: input.notes ?? null,
        createdBy: ctx.userId ?? null,
      },
      select: { id: true, number: true },
    });

    for (const [index, c] of (bom?.components ?? []).entries()) {
      const scrapPercent = Number(c.scrapPercent);
      await tx.assemblyOrderLine.create({
        data: {
          tenantId: ctx.tenantId,
          assemblyOrderId: order.id,
          variantId: c.variantId,
          quantityPerBatch: c.quantityPer,
          scrapPercent: new Prisma.Decimal(scrapPercent),
          quantityRequired: requiredForRun({
            quantityPerBatch: c.quantityPer,
            outputPerBatch: bom?.outputQuantity ?? 1,
            runQuantity: input.quantity,
            // A disassembly recovers what is IN the unit — the scrap was lost
            // when it was made and does not come back out. Adding it would
            // create stock that never existed.
            ...(kind === 'assemble' ? { scrapPercent } : {}),
          }),
          position: index,
        },
      });
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.assembly_order.created',
      entityType: 'AssemblyOrder',
      entityId: order.id,
      diff: { after: { number: order.number, kind, quantity: input.quantity } },
    });

    return order.id;
  });
}

export async function updateAssemblyOrder(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<AssemblyOrderDetail> {
  const input = UpdateAssemblyOrderInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const order = await loadWorkable(tx, id, ['planned']);

    // Changing the run size changes what every line needs, so the requirements
    // are recomputed from the SNAPSHOT recipe rather than re-read from the bill
    // — the run stays committed to the recipe it was planned against.
    if (input.quantity !== undefined && input.quantity !== order.quantityPlanned) {
      const lines = await tx.assemblyOrderLine.findMany({
        where: { assemblyOrderId: id },
        select: { id: true, quantityPerBatch: true, scrapPercent: true },
      });
      const bom = order.bomId
        ? await tx.billOfMaterials.findFirst({
            where: { id: order.bomId },
            select: { outputQuantity: true },
          })
        : null;
      for (const line of lines) {
        await tx.assemblyOrderLine.update({
          where: { id: line.id },
          data: {
            quantityRequired: requiredForRun({
              quantityPerBatch: line.quantityPerBatch,
              outputPerBatch: bom?.outputQuantity ?? 1,
              runQuantity: input.quantity,
              ...(order.kind === 'assemble' ? { scrapPercent: Number(line.scrapPercent) } : {}),
            }),
          },
        });
      }
    }

    await tx.assemblyOrder.update({
      where: { id },
      data: {
        ...(input.quantity !== undefined ? { quantityPlanned: input.quantity } : {}),
        ...(input.laborCostCents !== undefined ? { laborCostCents: input.laborCostCents } : {}),
        ...(input.plannedFor !== undefined
          ? { plannedFor: input.plannedFor ? new Date(input.plannedFor) : null }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });

    return loadDetail(tx, id);
  });
}

// ─── Release: hold what the run needs ──────────────────────────────────────────

/**
 * Commit to the run: hold every component it needs.
 *
 * A hold rather than a consumption. The parts stop being sellable the moment the
 * build is committed to, so nobody discovers at the bench that the last four
 * hinges went out on an order this morning — and nothing has actually moved, so
 * cancelling costs nothing.
 *
 * On a DISASSEMBLY the thing held is the finished unit itself, for the same
 * reason: you cannot sell the cabinet you have promised to take apart.
 */
export async function releaseAssemblyOrder(
  ctx: ServiceContext,
  id: string
): Promise<AssemblyOrderDetail> {
  return withTenant(ctx, async (tx) => {
    const order = await loadWorkable(tx, id, ['planned']);

    const holds =
      order.kind === 'assemble'
        ? (
            await tx.assemblyOrderLine.findMany({
              where: { assemblyOrderId: id },
              select: { id: true, variantId: true, quantityRequired: true },
            })
          ).map((l) => ({ lineId: l.id, variantId: l.variantId, quantity: l.quantityRequired }))
        : [
            {
              lineId: null,
              variantId: order.outputVariantId,
              quantity: order.quantityPlanned,
            },
          ];

    for (const hold of holds) {
      if (hold.quantity <= 0) continue;
      await assertEnoughAvailable(tx, {
        variantId: hold.variantId,
        warehouseId: order.warehouseId,
        quantity: hold.quantity,
      });
      const reservation = await tx.inventoryReservation.create({
        data: {
          tenantId: ctx.tenantId,
          variantId: hold.variantId,
          warehouseId: order.warehouseId,
          quantity: hold.quantity,
          // A first-class holder type alongside cart / order / subscription: a
          // scheduled build is as real a claim on stock as a placed order.
          holderType: 'assembly',
          holderId: order.id,
          status: 'active',
        },
        select: { id: true },
      });
      await tx.inventoryLevel.update({
        where: {
          variantId_warehouseId: {
            variantId: hold.variantId,
            warehouseId: order.warehouseId,
          },
        },
        data: { allocated: { increment: hold.quantity }, asOf: new Date() },
      });
      if (hold.lineId) {
        await tx.assemblyOrderLine.update({
          where: { id: hold.lineId },
          data: { reservationId: reservation.id },
        });
      }
    }

    await tx.assemblyOrder.update({
      where: { id },
      data: { status: 'released', releasedAt: new Date() },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.assembly_order.released',
      entityType: 'AssemblyOrder',
      entityId: id,
      diff: { after: { holds: holds.length } },
    });

    return loadDetail(tx, id);
  });
}

// ─── Complete: the moment stock changes shape ──────────────────────────────────

/**
 * Finish the run and write the movements.
 *
 * The one function in the phase that moves stock. Everything happens in a single
 * transaction: the holds come off, each component leaves, the finished goods
 * arrive, and the cost is settled from what actually left. A failure anywhere
 * rolls all of it back, so there is no state where the components are gone and
 * the product never appeared.
 */
export async function completeAssemblyOrder(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown = {}
): Promise<AssemblyOrderDetail> {
  const input = CompleteAssemblyOrderInput.parse(rawInput);
  const emissions: {
    variantId: string;
    warehouseId: string;
    result: MovementResult;
    delta: number;
    reason: string;
  }[] = [];
  let completedNumber = '';
  let completedQuantity = 0;
  let unitCost = 0;

  await withTenant(ctx, async (tx) => {
    const order = await loadWorkable(tx, id, ['planned', 'released']);
    completedNumber = order.number;

    const quantity = input.quantity ?? order.quantityPlanned;
    if (quantity > order.quantityPlanned) {
      throw new InventoryValidationError(
        `This run was planned for ${String(order.quantityPlanned)}. To make more, raise another run — a run that quietly grew is one nobody scheduled the parts for.`,
        [{ field: 'quantity', message: 'more than planned' }]
      );
    }
    completedQuantity = quantity;

    const laborCostCents = input.laborCostCents ?? order.laborCostCents;
    const overrides = new Map((input.consumed ?? []).map((c) => [c.variantId, c.quantity]));
    const actorType = resolveActorType(ctx);
    const lines = await tx.assemblyOrderLine.findMany({
      where: { assemblyOrderId: id },
      orderBy: { position: 'asc' },
    });

    // The holds come off FIRST. Consuming while the same units are still counted
    // as allocated would leave `allocated` overstated for the rest of time.
    await releaseHolds(tx, order.id);

    if (order.kind === 'assemble') {
      let componentCostCents = 0;

      for (const line of lines) {
        // A part-completed run pulls proportionally less. An override wins: the
        // bench saw what actually went in, and that number is the useful one.
        const planned = scaleToRun(line.quantityRequired, quantity, order.quantityPlanned);
        const consumed = overrides.get(line.variantId) ?? planned;
        if (consumed <= 0) continue;

        const result = await applyMovement(tx, {
          tenantId: ctx.tenantId,
          variantId: line.variantId,
          warehouseId: order.warehouseId,
          delta: -consumed,
          reason: 'assembly_out',
          referenceType: 'AssemblyOrder',
          referenceId: order.id,
          actorType,
          actorId: ctx.userId ?? null,
          idempotencyKey: `assembly-consume:${line.id}`,
          // Building with parts you do not have is a data error, not a policy
          // choice — unlike a sale, there is no customer to keep waiting.
          allowNegative: false,
        });
        // The cost the LEDGER worked out, not a price list — this is the whole
        // reason the finished unit's cost is exact (docs/146 Phase 5.9).
        const cost = result.costConsumedCents ?? 0;
        componentCostCents += cost;

        await tx.assemblyOrderLine.update({
          where: { id: line.id },
          data: {
            quantityConsumed: consumed,
            costConsumedCents: cost,
            movementId: result.movementId || null,
          },
        });
        emissions.push({
          variantId: line.variantId,
          warehouseId: order.warehouseId,
          result,
          delta: -consumed,
          reason: 'assembly_out',
        });
      }

      const totalCostCents = componentCostCents + laborCostCents;
      unitCost = Math.round(totalCostCents / Math.max(1, quantity));

      const produced = await applyMovement(tx, {
        tenantId: ctx.tenantId,
        variantId: order.outputVariantId,
        warehouseId: order.warehouseId,
        delta: quantity,
        reason: 'assembly_in',
        referenceType: 'AssemblyOrder',
        referenceId: order.id,
        unitCostCents: unitCost,
        // What the PARTS cost, before labour — so a landed-cost style breakdown
        // can separate materials from time.
        goodsUnitCostCents: Math.round(componentCostCents / Math.max(1, quantity)),
        actorType,
        actorId: ctx.userId ?? null,
        idempotencyKey: `assembly-produce:${order.id}`,
        layerSource: 'assembly',
        layerSourceId: order.id,
      });
      emissions.push({
        variantId: order.outputVariantId,
        warehouseId: order.warehouseId,
        result: produced,
        delta: quantity,
        reason: 'assembly_in',
      });

      await tx.assemblyOrder.update({
        where: { id },
        data: {
          status: 'completed',
          quantityCompleted: quantity,
          laborCostCents,
          outputUnitCostCents: unitCost,
          totalCostCents,
          completedAt: new Date(),
        },
      });
    } else {
      await completeDisassembly(tx, ctx, {
        order,
        quantity,
        laborCostCents,
        lines,
        emissions,
      });
      const reread = await tx.assemblyOrder.findFirst({
        where: { id },
        select: { outputUnitCostCents: true },
      });
      unitCost = reread?.outputUnitCostCents ?? 0;
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.assembly_order.completed',
      entityType: 'AssemblyOrder',
      entityId: id,
      diff: { after: { quantity, kind: order.kind, note: input.note ?? null } },
    });
  });

  // Post-commit, like every other threshold event in the module.
  for (const e of emissions) {
    if (e.result.deduped) continue;
    await emitStockEvents(ctx, e.variantId, e.warehouseId, e.result, e.delta, e.reason);
  }
  await publishInventoryEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'inventory.assembly.completed',
    data: {
      assemblyOrderId: id,
      number: completedNumber,
      quantity: completedQuantity,
      outputUnitCostCents: unitCost,
    },
  });

  return getAssemblyOrder(ctx, id);
}

/**
 * Take a finished unit apart.
 *
 * The finished unit leaves at what IT cost; the components arrive, and that cost
 * is split across them in proportion to their catalogue cost. A proportional
 * split rather than an equal one because a cabinet is mostly panel and barely
 * screw, and splitting evenly would make the screws absurdly valuable and the
 * panel free. Where no component has a catalogue cost there is nothing to weigh
 * with, so it falls back to splitting by quantity — stated here rather than
 * silently producing zeros.
 */
async function completeDisassembly(
  tx: TxClient,
  ctx: ServiceContext,
  params: {
    order: WorkableOrder;
    quantity: number;
    laborCostCents: number;
    lines: {
      id: string;
      variantId: string;
      quantityRequired: number;
      quantityPerBatch: number;
    }[];
    emissions: {
      variantId: string;
      warehouseId: string;
      result: MovementResult;
      delta: number;
      reason: string;
    }[];
  }
): Promise<void> {
  const { order, quantity, laborCostCents, lines, emissions } = params;
  const actorType = resolveActorType(ctx);

  const consumed = await applyMovement(tx, {
    tenantId: ctx.tenantId,
    variantId: order.outputVariantId,
    warehouseId: order.warehouseId,
    delta: -quantity,
    reason: 'assembly_out',
    referenceType: 'AssemblyOrder',
    referenceId: order.id,
    actorType,
    actorId: ctx.userId ?? null,
    idempotencyKey: `assembly-teardown:${order.id}`,
    allowNegative: false,
  });
  emissions.push({
    variantId: order.outputVariantId,
    warehouseId: order.warehouseId,
    result: consumed,
    delta: -quantity,
    reason: 'assembly_out',
  });

  // What came out of the unit, plus what it cost to do the taking-apart.
  const recoverableCents = (consumed.costConsumedCents ?? 0) + laborCostCents;

  const outputs = lines.map((l) => ({
    ...l,
    quantity: scaleToRun(l.quantityRequired, quantity, order.quantityPlanned),
  }));
  const catalogueCosts = await tx.productVariant.findMany({
    where: { id: { in: outputs.map((o) => o.variantId) } },
    select: { id: true, costCents: true },
  });
  const costByVariant = new Map(catalogueCosts.map((v) => [v.id, v.costCents ?? 0]));

  const weights = outputs.map((o) => o.quantity * (costByVariant.get(o.variantId) ?? 0));
  const weightTotal = weights.reduce((s, w) => s + w, 0);
  const quantityTotal = outputs.reduce((s, o) => s + o.quantity, 0);

  let assigned = 0;
  for (const [index, out] of outputs.entries()) {
    if (out.quantity <= 0) continue;
    const isLast = index === outputs.length - 1;
    const share =
      weightTotal > 0
        ? (weights[index] ?? 0) / weightTotal
        : quantityTotal > 0
          ? out.quantity / quantityTotal
          : 0;
    // The last component takes the remainder, so the value that went in comes
    // back out to the penny rather than evaporating into rounding.
    const valueCents = isLast ? recoverableCents - assigned : Math.round(recoverableCents * share);
    assigned += valueCents;

    const result = await applyMovement(tx, {
      tenantId: ctx.tenantId,
      variantId: out.variantId,
      warehouseId: order.warehouseId,
      delta: out.quantity,
      reason: 'assembly_in',
      referenceType: 'AssemblyOrder',
      referenceId: order.id,
      unitCostCents: Math.max(0, Math.round(valueCents / out.quantity)),
      actorType,
      actorId: ctx.userId ?? null,
      idempotencyKey: `assembly-recover:${out.id}`,
      layerSource: 'assembly',
      layerSourceId: order.id,
    });
    await tx.assemblyOrderLine.update({
      where: { id: out.id },
      data: {
        quantityConsumed: out.quantity,
        // Negative: on a disassembly this line RECEIVED value rather than giving
        // it up, and recording it positive would make the run look twice as
        // expensive as it was.
        costConsumedCents: -valueCents,
        movementId: result.movementId || null,
      },
    });
    emissions.push({
      variantId: out.variantId,
      warehouseId: order.warehouseId,
      result,
      delta: out.quantity,
      reason: 'assembly_in',
    });
  }

  await tx.assemblyOrder.update({
    where: { id: order.id },
    data: {
      status: 'completed',
      quantityCompleted: quantity,
      laborCostCents,
      outputUnitCostCents: Math.round(recoverableCents / Math.max(1, quantity)),
      totalCostCents: recoverableCents,
      completedAt: new Date(),
    },
  });
}

// ─── Cancel ────────────────────────────────────────────────────────────────────

export async function cancelAssemblyOrder(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown = {}
): Promise<AssemblyOrderDetail> {
  const input = CancelAssemblyOrderInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const order = await loadWorkable(tx, id, ['planned', 'released']);
    await releaseHolds(tx, order.id);
    await tx.assemblyOrder.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledReason: input.reason ?? null,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.assembly_order.cancelled',
      entityType: 'AssemblyOrder',
      entityId: id,
      diff: { after: { reason: input.reason ?? null } },
    });
    return loadDetail(tx, id);
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

interface WorkableOrder {
  id: string;
  number: string;
  kind: AssemblyKind;
  status: AssemblyStatus;
  bomId: string | null;
  outputVariantId: string;
  warehouseId: string;
  quantityPlanned: number;
  laborCostCents: number;
}

async function loadWorkable(
  tx: TxClient,
  id: string,
  allowed: AssemblyStatus[]
): Promise<WorkableOrder> {
  const order = await tx.assemblyOrder.findFirst({
    where: { id },
    select: {
      id: true,
      number: true,
      kind: true,
      status: true,
      bomId: true,
      outputVariantId: true,
      warehouseId: true,
      quantityPlanned: true,
      laborCostCents: true,
    },
  });
  if (!order) throw new InventoryNotFoundError('AssemblyOrder', id);
  if (!allowed.includes(order.status as AssemblyStatus)) {
    throw new InventoryConflictError(
      order.status === 'completed'
        ? `${order.number} is finished. A correction is a new run or a stock count, not a change here.`
        : `${order.number} was cancelled and can no longer be worked.`,
      'status'
    );
  }
  return {
    id: order.id,
    number: order.number,
    kind: order.kind as AssemblyKind,
    status: order.status as AssemblyStatus,
    bomId: order.bomId,
    outputVariantId: order.outputVariantId,
    warehouseId: order.warehouseId,
    quantityPlanned: order.quantityPlanned,
    laborCostCents: order.laborCostCents,
  };
}

/** Drop every hold this run placed, and give `allocated` back. Idempotent: only
 *  ACTIVE reservations are touched, so completing after a partial failure or
 *  cancelling an already-cancelled run releases nothing twice. */
async function releaseHolds(tx: TxClient, assemblyOrderId: string): Promise<void> {
  const holds = await tx.inventoryReservation.findMany({
    where: { holderType: 'assembly', holderId: assemblyOrderId, status: 'active' },
    select: { id: true, variantId: true, warehouseId: true, quantity: true },
  });
  for (const hold of holds) {
    await tx.inventoryReservation.update({
      where: { id: hold.id },
      data: { status: 'released', releasedAt: new Date() },
    });
    await tx.inventoryLevel.update({
      where: {
        variantId_warehouseId: { variantId: hold.variantId, warehouseId: hold.warehouseId },
      },
      data: { allocated: { decrement: hold.quantity }, asOf: new Date() },
    });
  }
}

/** Refuse a hold the shelf cannot cover, and say by how much. "Not enough
 *  stock" without a number sends someone to count it themselves. */
async function assertEnoughAvailable(
  tx: TxClient,
  params: { variantId: string; warehouseId: string; quantity: number }
): Promise<void> {
  const level = await tx.inventoryLevel.findUnique({
    where: {
      variantId_warehouseId: { variantId: params.variantId, warehouseId: params.warehouseId },
    },
    select: { onHand: true, allocated: true, safetyBuffer: true, unsellableOnHand: true },
  });
  const available = Math.max(
    0,
    (level?.onHand ?? 0) - (level?.allocated ?? 0) - (level?.safetyBuffer ?? 0)
  );
  if (available < params.quantity) {
    const variant = await tx.productVariant.findFirst({
      where: { id: params.variantId },
      select: { sku: true },
    });
    throw new InventoryConflictError(
      `Not enough ${variant?.sku ?? 'stock'} to commit to this run — it needs ${String(params.quantity)} and ${String(available)} ${available === 1 ? 'is' : 'are'} free here.`,
      'quantity'
    );
  }
}

/** A part-completed run pulls proportionally less, rounded up: pulling short and
 *  finding out at the bench is the failure this avoids. */
function scaleToRun(requiredForPlanned: number, completed: number, planned: number): number {
  if (planned <= 0 || completed >= planned) return requiredForPlanned;
  return Math.ceil((requiredForPlanned * completed) / planned);
}

async function nextAssemblyNumber(tx: TxClient, tenantId: string): Promise<string> {
  const count = await tx.assemblyOrder.count({ where: { tenantId } });
  return `ASM-${(count + 1).toString().padStart(6, '0')}`;
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

async function loadDetail(tx: TxClient, id: string): Promise<AssemblyOrderDetail> {
  const order = await tx.assemblyOrder.findFirst({ where: { id }, include: DETAIL_INCLUDE });
  if (!order) throw new InventoryNotFoundError('AssemblyOrder', id);
  return serializeDetail(order);
}

function serializeRow(order: OrderWithAll): AssemblyOrderRow {
  return {
    id: order.id,
    number: order.number,
    kind: order.kind as AssemblyKind,
    status: order.status as AssemblyStatus,
    bomId: order.bomId,
    bomName: order.bom?.name ?? null,
    outputVariantId: order.outputVariantId,
    outputSku: order.outputVariant?.sku ?? null,
    outputTitle: order.outputVariant?.product?.title ?? null,
    warehouseId: order.warehouseId,
    warehouseName: order.warehouse?.name ?? null,
    quantityPlanned: order.quantityPlanned,
    quantityCompleted: order.quantityCompleted,
    laborCostCents: order.laborCostCents,
    outputUnitCostCents: order.outputUnitCostCents,
    totalCostCents: order.totalCostCents,
    notes: order.notes,
    plannedFor: order.plannedFor?.toISOString() ?? null,
    releasedAt: order.releasedAt?.toISOString() ?? null,
    completedAt: order.completedAt?.toISOString() ?? null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    cancelledReason: order.cancelledReason,
    createdAt: order.createdAt.toISOString(),
  };
}

function serializeDetail(order: OrderWithAll): AssemblyOrderDetail {
  return {
    ...serializeRow(order),
    lines: order.lines.map((l) => ({
      id: l.id,
      variantId: l.variantId,
      variantSku: l.variant?.sku ?? null,
      productTitle: l.variant?.product?.title ?? null,
      quantityPerBatch: l.quantityPerBatch,
      scrapPercent: Number(l.scrapPercent),
      quantityRequired: l.quantityRequired,
      quantityConsumed: l.quantityConsumed,
      costConsumedCents: l.costConsumedCents,
      movementId: l.movementId,
      position: l.position,
    })),
  };
}
