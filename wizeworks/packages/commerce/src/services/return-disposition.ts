// Returns disposition (docs/146 Phase 9.7) — what actually happens to the goods.
//
// ── The boolean that could not carry the job ─────────────────────────────────
//
// `ReturnInspection.restockable` has always been the whole decision: true put
// the units back, false did nothing at all. That second branch is where the
// value leaked. "Not fit to sell" covers a returned pump that needs a seal, a
// jacket that needs cleaning, a batch waiting on a supplier's verdict, and a
// unit that is genuinely scrap — four different piles with four different
// futures, all recorded as the same `false` and all physically ending up
// wherever the person holding them decided.
//
// Four dispositions, each routing to a different shelf and a different meaning:
//
//   restock     back to a sellable shelf
//   quarantine  here, not sellable, decision pending
//   repair      here, not sellable, work queued
//   scrap       never re-enters stock
//
// ── Why scrap writes no movement ─────────────────────────────────────────────
//
// It looks like an omission and it is the correct accounting. The unit's cost
// was relieved as COGS when it sold. Adding it back and immediately writing it
// off posts two entries that cancel, churns the moving average, and files the
// loss under shrinkage — a report that exists to measure stock going missing
// from the warehouse, not goods a customer returned broken. Leaving the COGS
// where it is IS the answer; the inspection row is the record that it happened,
// and `dispositionNote` is why.
//
// ── Why the boolean stays ────────────────────────────────────────────────────
//
// `restockable` is kept and kept in step (restock ⇒ true, everything else ⇒
// false). The refund path reads it, tenants' existing API calls set it, and
// quietly changing what an existing column means is worse than carrying a
// redundant one.

import { SetReturnDispositionInput, dispositionEffect } from '@wizeworks/commerce-schemas';
import type { ReturnDisposition } from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import { inventoryService } from '@wizeworks/inventory';

import { writeAuditLog } from '../audit';
import { CommerceConflictError, CommerceNotFoundError } from '../errors';
import type { ServiceContext } from '../errors';

export interface ReturnDispositionRow {
  inspectionId: string;
  returnId: string;
  returnLineItemId: string;
  variantId: string | null;
  variantSku: string | null;
  variantName: string | null;
  quantity: number;
  condition: string;
  /** Null until somebody decides. There is no safe default here in either
   *  direction — `restock` puts damaged goods back on the shelf, `scrap` throws
   *  away stock that was fine — so the field stays empty and the screen asks. */
  disposition: string | null;
  dispositionBinId: string | null;
  dispositionBinCode: string | null;
  dispositionAt: string | null;
  dispositionNote: string | null;
  warehouseId: string | null;
  inspectedAt: string;
}

/**
 * Every inspected line on a return, with the decision made about it or the
 * absence of one.
 *
 * The absence is the point of the screen: a returns bench works from "what have
 * I not decided about yet", and a list that renders undecided lines the same as
 * decided ones cannot be worked from.
 */
export async function listReturnDispositions(
  ctx: ServiceContext,
  returnId: string
): Promise<ReturnDispositionRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.$queryRaw<
      {
        inspectionId: string;
        returnId: string;
        returnLineItemId: string;
        variantId: string | null;
        variantSku: string | null;
        variantName: string | null;
        quantity: number;
        condition: string;
        disposition: string | null;
        dispositionBinId: string | null;
        dispositionBinCode: string | null;
        dispositionAt: Date | null;
        dispositionNote: string | null;
        warehouseId: string | null;
        inspectedAt: Date;
      }[]
    >`
      SELECT ins.id                  AS "inspectionId",
             ins.return_id           AS "returnId",
             ins.return_line_item_id AS "returnLineItemId",
             oi.variant_id           AS "variantId",
             v.sku                   AS "variantSku",
             -- The variant's own title is blank on most catalogs, and falling
             -- through to the SKU made the decision table name the goods
             -- "THE-EVER…" while the card above it said "The Everyday Tee".
             -- The order line's frozen name is what the rest of the pane uses.
             COALESCE(v.title, oi.name) AS "variantName",
             GREATEST(rli.approved_quantity, 0) + CASE WHEN rli.approved_quantity > 0 THEN 0
                                                       ELSE rli.quantity END AS "quantity",
             ins.condition,
             ins.disposition,
             ins.disposition_bin_id  AS "dispositionBinId",
             b.code                  AS "dispositionBinCode",
             ins.disposition_at      AS "dispositionAt",
             ins.disposition_note    AS "dispositionNote",
             ins.warehouse_id        AS "warehouseId",
             ins.created_at          AS "inspectedAt"
        FROM commerce_return_inspections ins
        JOIN commerce_return_line_items rli ON rli.id = ins.return_line_item_id
        LEFT JOIN order_items oi ON oi.id = rli.order_item_id
        LEFT JOIN commerce_product_variants v ON v.id = oi.variant_id
        LEFT JOIN inventory_bins b ON b.id = ins.disposition_bin_id
       WHERE ins.tenant_id = ${ctx.tenantId}::uuid
         AND ins.return_id = ${returnId}::uuid
       ORDER BY ins.created_at ASC
    `;
    return rows.map((r) => ({
      ...r,
      dispositionAt: r.dispositionAt?.toISOString() ?? null,
      inspectedAt: r.inspectedAt.toISOString(),
    }));
  });
}

export interface SetDispositionResult {
  inspectionId: string;
  disposition: ReturnDisposition;
  /** Units that re-entered stock. Zero for `scrap`, and zero when the return
   *  line has no variant (a free-text order line has no stock to move). */
  unitsRestocked: number;
  binId: string | null;
}

/**
 * Decide what happens to one inspected line, and move the goods accordingly.
 *
 * Idempotent on the inspection, and idempotent ACROSS the two paths that can
 * restock the same goods. `issueRefund` has always restocked whatever inspection
 * marked `restockable`, keyed `return-restock:<returnId>:<inspectionId>`; a
 * `restock` disposition reuses that exact key rather than minting its own, so
 * whichever happens first wins and the second is a no-op. Two keys would mean
 * two movements and a phantom unit on the shelf — the sort of bug that shows up
 * weeks later as an unexplained count variance.
 *
 * Quarantine and repair get their own key, and cannot collide: `restockable` is
 * false for both, so the refund path never looks at them.
 *
 * CHANGING a decision is deliberately NOT supported once stock has moved. The
 * units are physically on a shelf, and moving them again is a shelf-to-shelf
 * transfer somebody should do through put-away, where it is recorded as what it
 * is rather than as a returns decision that changed its mind.
 */
export async function setReturnDisposition(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<SetDispositionResult> {
  const input = SetReturnDispositionInput.parse(rawInput);
  const effect = dispositionEffect(input.disposition);

  const resolved = await withTenant(ctx, async (tx) => {
    const inspection = await tx.returnInspection.findFirst({
      where: { id: input.inspectionId, tenantId: ctx.tenantId },
      select: {
        id: true,
        returnId: true,
        returnLineItemId: true,
        warehouseId: true,
        disposition: true,
      },
    });
    if (!inspection) throw new CommerceNotFoundError('ReturnInspection', input.inspectionId);
    if (inspection.disposition && inspection.disposition !== input.disposition) {
      throw new CommerceConflictError(
        `These goods were already dispositioned as "${inspection.disposition}". ` +
          'Move them through put-away if they need to go somewhere else.'
      );
    }

    const line = await tx.returnLineItem.findFirst({
      where: { id: inspection.returnLineItemId },
      select: { orderItemId: true, approvedQuantity: true, quantity: true },
    });
    if (!line) throw new CommerceNotFoundError('ReturnLineItem', inspection.returnLineItemId);

    const orderItem = await tx.orderItem.findFirst({
      where: { id: line.orderItemId },
      select: { variantId: true },
    });
    // The accepted-back count when there is one, else what was asked for. A
    // return of 3 where only 2 were accepted restocks 2.
    const quantity = line.approvedQuantity > 0 ? line.approvedQuantity : line.quantity;

    return {
      inspection,
      variantId: orderItem?.variantId ?? null,
      quantity,
    };
  });

  // Where the goods land. An explicitly named shelf wins — the person holding
  // them knows which one — otherwise the location's provisioned shelf of the
  // right kind. Null throughout on a location that does not use shelves, which
  // is most of them.
  const warehouseId =
    resolved.inspection.warehouseId ?? (await inventoryService.resolveDefaultWarehouseId(ctx));

  let binId: string | null = input.binId ?? null;
  if (!binId && effect.addsStock && warehouseId && effect.systemBinCode !== 'DEFAULT') {
    binId = await inventoryService.resolveSystemBin(
      ctx,
      warehouseId,
      effect.systemBinCode === 'QUARANTINE' ? 'quarantine' : 'repair'
    );
  }

  let unitsRestocked = 0;
  if (effect.addsStock && resolved.variantId && warehouseId && resolved.quantity > 0) {
    await inventoryService.adjust(ctx, {
      variantId: resolved.variantId,
      warehouseId,
      delta: resolved.quantity,
      // `return` for all three stocking dispositions: the units genuinely came
      // back from a customer, and that is what the reason names. Where they went
      // is the SHELF's job to say, not the reason code's — a `quarantine` reason
      // would fracture the returns line of the movement report into three.
      reason: 'return',
      referenceType: 'Return',
      referenceId: resolved.inspection.returnId,
      idempotencyKey:
        input.disposition === 'restock'
          ? `return-restock:${resolved.inspection.returnId}:${input.inspectionId}`
          : `return-disposition:${input.inspectionId}:${input.disposition}`,
      ...(binId ? { binId } : {}),
      ...(input.note ? { note: input.note } : {}),
    });
    unitsRestocked = resolved.quantity;
  }

  await withTenant(ctx, async (tx) => {
    await tx.returnInspection.update({
      where: { id: input.inspectionId },
      data: {
        disposition: input.disposition,
        dispositionBinId: effect.addsStock ? binId : null,
        dispositionAt: new Date(),
        dispositionBy: ctx.userId ?? null,
        dispositionNote: input.note ?? null,
        // Kept in lockstep with the decision — see the file header.
        restockable: effect.restockable,
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.return.dispositioned',
      entityType: 'ReturnInspection',
      entityId: input.inspectionId,
      diff: {
        before: { disposition: resolved.inspection.disposition },
        after: {
          disposition: input.disposition,
          binId,
          unitsRestocked,
          note: input.note ?? null,
        },
      },
    });
  });

  return {
    inspectionId: input.inspectionId,
    disposition: input.disposition,
    unitsRestocked,
    binId: effect.addsStock ? binId : null,
  };
}

export interface DispositionSummary {
  restock: number;
  quarantine: number;
  repair: number;
  scrap: number;
  /** Inspected lines nobody has decided about yet. The work list, and the reason
   *  this is a summary rather than four counters — "12 waiting" is the number
   *  that gets somebody to open the screen. */
  undecided: number;
}

/** How the last `days` of returns were dealt with. */
export async function summarizeDispositions(
  ctx: ServiceContext,
  days = 90
): Promise<DispositionSummary> {
  return withTenant(ctx, async (tx) => {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await tx.$queryRaw<{ disposition: string | null; count: number }[]>`
      SELECT disposition, COUNT(*)::int AS count
        FROM commerce_return_inspections
       WHERE tenant_id  = ${ctx.tenantId}::uuid
         AND created_at >= ${since}
       GROUP BY disposition
    `;
    const byKey = new Map(rows.map((r) => [r.disposition ?? 'undecided', r.count]));
    return {
      restock: byKey.get('restock') ?? 0,
      quarantine: byKey.get('quarantine') ?? 0,
      repair: byKey.get('repair') ?? 0,
      scrap: byKey.get('scrap') ?? 0,
      undecided: byKey.get('undecided') ?? 0,
    };
  });
}
