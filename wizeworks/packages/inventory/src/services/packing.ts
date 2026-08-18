// Packing — what actually goes in the box (docs/146 Phase 4.4).
//
// ── The box is a record, not a step ──────────────────────────────────────────
//
// A `ShipmentPackage` exists from the moment someone starts filling it, which is
// what lets the pack bench be interrupted: a half-packed box survives a shift
// change, a reload, and the phone ringing. Contrast an `OrderFulfillment`, which
// is created when the box is CLOSED — it is the shipping record, it carries a
// carrier and a tracking number, and it should not exist for a box that might
// still be being filled.
//
// ── Verification is a refusal, not a warning ─────────────────────────────────
//
// Scanning something the order does not contain is rejected outright (see
// `pick-scan.ts`). Closing a box whose contents do not match what was picked
// requires an explicit `allowPartial`. A pack bench that warns and continues has
// replaced a control with a notification, and the whole reason to spend a second
// per item at the bench is that the control is real.
//
// Nothing here touches a stock number. The units left the ledger at checkout and
// left the shelf at picking; putting them in a box moves them from a tote to a
// carton, which the inventory ledger has no opinion about and should not.

import {
  ClosePackageInput,
  CreatePackageInput,
  ListPackagesQuery,
  PackItemInput,
  UpdatePackageInput,
} from '@wizeworks/commerce-schemas';
import { Prisma, withTenant } from '@wizeworks/db';
import type { TxClient } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import {
  InventoryConflictError,
  InventoryNotFoundError,
  InventoryValidationError,
} from '../errors';
import type { ServiceContext } from '../errors';
import { publishInventoryEvent } from '../events';

// ─── Shapes ────────────────────────────────────────────────────────────────────

export interface PackageLineRow {
  id: string;
  orderItemId: string;
  variantId: string | null;
  sku: string;
  name: string;
  quantity: number;
  scannedQuantity: number;
  /** On the order. */
  ordered: number;
  /** In other boxes on the same order. */
  packedElsewhere: number;
}

export interface PackageRow {
  id: string;
  number: string;
  orderId: string;
  orderNumber: string;
  pickListId: string | null;
  pickListNumber: string | null;
  status: string;
  weightGrams: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  packagingType: string | null;
  fulfillmentId: string | null;
  note: string | null;
  unitCount: number;
  scannedCount: number;
  packedAt: string | null;
  packedBy: string | null;
  createdAt: string;
}

export interface PackageDetail extends PackageRow {
  lines: PackageLineRow[];
  /** Order lines with units still owed a box. Empty means the order is complete. */
  outstanding: { orderItemId: string; sku: string; name: string; remaining: number }[];
  /** Every unit the order wants is in this box or another one. */
  orderFullyPacked: boolean;
}

// ─── Create / update ───────────────────────────────────────────────────────────

export async function createPackage(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<PackageDetail> {
  const input = CreatePackageInput.parse(rawInput);

  const id = await withTenant(ctx, async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: input.orderId, tenantId: ctx.tenantId },
      select: { id: true, orderNumber: true, status: true },
    });
    if (!order) throw new InventoryNotFoundError('Order', input.orderId);
    if (order.status === 'cancelled' || order.status === 'refunded') {
      throw new InventoryValidationError(
        `Order ${order.orderNumber} is ${order.status} — nothing should be boxed for it.`
      );
    }

    const number = await nextPackageNumber(tx, ctx.tenantId);
    const created = await tx.shipmentPackage.create({
      data: {
        tenantId: ctx.tenantId,
        number,
        orderId: input.orderId,
        pickListId: input.pickListId ?? null,
        packagingType: input.packagingType ?? null,
        weightGrams: input.weightGrams ?? null,
        lengthMm: input.lengthMm ?? null,
        widthMm: input.widthMm ?? null,
        heightMm: input.heightMm ?? null,
        note: input.note ?? null,
      },
      select: { id: true },
    });
    return created.id;
  });

  return getPackage(ctx, id);
}

export async function updatePackage(
  ctx: ServiceContext,
  packageId: string,
  rawInput: unknown
): Promise<PackageDetail> {
  const input = UpdatePackageInput.parse(rawInput);

  await withTenant(ctx, async (tx) => {
    const box = await loadBox(tx, ctx.tenantId, packageId);
    if (box.status === 'cancelled') {
      throw new InventoryConflictError('That box is cancelled.', 'status');
    }
    await tx.shipmentPackage.update({
      where: { id: packageId },
      data: {
        ...(input.packagingType !== undefined ? { packagingType: input.packagingType } : {}),
        ...(input.weightGrams !== undefined ? { weightGrams: input.weightGrams } : {}),
        ...(input.lengthMm !== undefined ? { lengthMm: input.lengthMm } : {}),
        ...(input.widthMm !== undefined ? { widthMm: input.widthMm } : {}),
        ...(input.heightMm !== undefined ? { heightMm: input.heightMm } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
    });
  });

  return getPackage(ctx, packageId);
}

/**
 * Put units of one order line in the box, by hand.
 *
 * Takes an absolute quantity rather than a delta: a pack bench corrects itself by
 * typing the right number, not by working out the difference from the wrong one.
 * Zero removes the line, which is how you take something back out of a box.
 */
export async function packItem(
  ctx: ServiceContext,
  packageId: string,
  rawInput: unknown,
  /** How many of the units in this call were confirmed by a trigger pull. Set
   *  only by the scan path; a typed correction leaves the previously scanned
   *  units scanned and adds none. */
  options: { scannedDelta?: number } = {}
): Promise<PackageDetail> {
  const input = PackItemInput.parse(rawInput);

  await withTenant(ctx, async (tx) => {
    const box = await loadBox(tx, ctx.tenantId, packageId);
    if (box.status !== 'open') {
      throw new InventoryConflictError(
        `Box ${box.number} is ${box.status} and can no longer be changed.`,
        'status'
      );
    }

    const item = await tx.orderItem.findFirst({
      where: { id: input.orderItemId, tenantId: ctx.tenantId, orderId: box.orderId },
      select: { id: true, sku: true, name: true, quantity: true, variantId: true },
    });
    if (!item) {
      throw new InventoryValidationError(
        'That line is not on this order, so it must not go in this box.'
      );
    }

    const elsewhere = await tx.$queryRaw<{ units: number }[]>`
      SELECT COALESCE(SUM(pl.quantity), 0)::int AS units
        FROM inventory_shipment_package_lines pl
        JOIN inventory_shipment_packages pk ON pk.id = pl.package_id
       WHERE pl.tenant_id     = ${ctx.tenantId}::uuid
         AND pl.order_item_id = ${input.orderItemId}::uuid
         AND pk.status <> 'cancelled'
         AND pk.id <> ${packageId}::uuid
    `;
    const packedElsewhere = elsewhere[0]?.units ?? 0;
    const room = item.quantity - packedElsewhere;

    if (input.quantity > room) {
      throw new InventoryValidationError(
        packedElsewhere > 0
          ? `${item.sku}: the order is for ${item.quantity} and ${packedElsewhere} are already in another box, so at most ${room} can go in this one.`
          : `${item.sku}: the order is only for ${item.quantity}.`
      );
    }

    if (input.quantity === 0) {
      await tx.shipmentPackageLine.deleteMany({
        where: { packageId, orderItemId: input.orderItemId },
      });
      return;
    }

    const existing = await tx.shipmentPackageLine.findFirst({
      where: { packageId, orderItemId: input.orderItemId },
      select: { id: true, scannedQuantity: true },
    });

    if (existing) {
      await tx.shipmentPackageLine.update({
        where: { id: existing.id },
        data: {
          quantity: input.quantity,
          // Scanned can never exceed the line. A bench that corrects a scanned
          // line DOWNWARD by hand loses the verification for the units it
          // removed, which is the honest reading: those units are no longer in
          // the box, so nothing about them was verified.
          scannedQuantity: Math.min(
            existing.scannedQuantity + (options.scannedDelta ?? 0),
            input.quantity
          ),
        },
      });
      return;
    }

    await tx.shipmentPackageLine.create({
      data: {
        tenantId: ctx.tenantId,
        packageId,
        orderItemId: input.orderItemId,
        variantId: item.variantId,
        quantity: input.quantity,
        scannedQuantity: Math.min(options.scannedDelta ?? 0, input.quantity),
      },
    });
  });

  return getPackage(ctx, packageId);
}

// ─── Close / cancel ────────────────────────────────────────────────────────────

/**
 * Seal the box.
 *
 * Refuses an EMPTY box outright — there is no legitimate reading of a sealed box
 * with nothing in it, and letting one through produces a fulfillment with no
 * lines that a carrier is then asked to quote.
 *
 * Refuses a box that does not complete the order UNLESS `allowPartial`. A partial
 * shipment is legitimate and common; it just has to be a decision rather than
 * something that happens by tapping through. The refusal names exactly what is
 * missing, so the answer is visible at the moment the question is asked.
 */
export async function closePackage(
  ctx: ServiceContext,
  packageId: string,
  rawInput: unknown = {}
): Promise<PackageDetail> {
  const input = ClosePackageInput.parse(rawInput ?? {});
  const detail = await getPackage(ctx, packageId);

  if (detail.status !== 'open') {
    throw new InventoryConflictError(`Box ${detail.number} is already ${detail.status}.`, 'status');
  }
  if (detail.unitCount === 0) {
    throw new InventoryValidationError('There is nothing in this box yet.');
  }
  if (!detail.orderFullyPacked && !input.allowPartial) {
    const missing = detail.outstanding
      .map((o) => `${o.remaining} × ${o.sku}`)
      .slice(0, 5)
      .join(', ');
    throw new InventoryValidationError(
      `This box does not complete order ${detail.orderNumber} — still to pack: ${missing}. Close it as a partial shipment if that is deliberate.`
    );
  }

  await withTenant(ctx, async (tx) => {
    await tx.shipmentPackage.update({
      where: { id: packageId },
      data: {
        status: 'packed',
        packedAt: new Date(),
        packedBy: ctx.userId ?? null,
        ...(input.weightGrams !== undefined ? { weightGrams: input.weightGrams } : {}),
        ...(input.lengthMm !== undefined ? { lengthMm: input.lengthMm } : {}),
        ...(input.widthMm !== undefined ? { widthMm: input.widthMm } : {}),
        ...(input.heightMm !== undefined ? { heightMm: input.heightMm } : {}),
        ...(input.packagingType !== undefined ? { packagingType: input.packagingType } : {}),
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.package.packed',
      entityType: 'ShipmentPackage',
      entityId: packageId,
      diff: {
        after: {
          number: detail.number,
          orderId: detail.orderId,
          units: detail.unitCount,
          scanned: detail.scannedCount,
          partial: !detail.orderFullyPacked,
        },
      },
    });
  });

  await publishInventoryEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'inventory.package.packed',
    data: {
      packageId,
      number: detail.number,
      orderId: detail.orderId,
      units: detail.unitCount,
      scannedUnits: detail.scannedCount,
      partial: !detail.orderFullyPacked,
    },
  });

  return getPackage(ctx, packageId);
}

/** Open the box back up. Contents stay recorded and become available to other
 *  boxes again, because a cancelled box is a repack, not a loss. */
export async function cancelPackage(
  ctx: ServiceContext,
  packageId: string
): Promise<PackageDetail> {
  await withTenant(ctx, async (tx) => {
    const box = await loadBox(tx, ctx.tenantId, packageId);
    if (box.fulfillmentId) {
      throw new InventoryConflictError(
        'This box has already been handed to shipping. Cancel the shipment first.',
        'status'
      );
    }
    await tx.shipmentPackage.update({
      where: { id: packageId },
      data: { status: 'cancelled' },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.package.cancelled',
      entityType: 'ShipmentPackage',
      entityId: packageId,
      diff: { after: { number: box.number } },
    });
  });
  return getPackage(ctx, packageId);
}

/** Stamp the shipping record onto the box. Called by the pack → fulfillment
 *  hand-off in @wizeworks/commerce, which is the only place that can see both. */
export async function attachFulfillment(
  ctx: ServiceContext,
  packageId: string,
  fulfillmentId: string
): Promise<void> {
  await withTenant(ctx, (tx) =>
    tx.shipmentPackage.update({ where: { id: packageId }, data: { fulfillmentId } })
  );
}

// ─── Read ──────────────────────────────────────────────────────────────────────

export async function listPackages(
  ctx: ServiceContext,
  rawQuery: unknown = {}
): Promise<{ items: PackageRow[]; total: number }> {
  const query = ListPackagesQuery.parse(rawQuery ?? {});
  const take = query.take ?? 50;
  const skip = query.skip ?? 0;

  return withTenant(ctx, async (tx) => {
    const rows = await tx.$queryRaw<RawPackage[]>`
      ${PACKAGE_SELECT}
       WHERE pk.tenant_id = ${ctx.tenantId}::uuid
         AND (${query.orderId ?? null}::uuid IS NULL OR pk.order_id = ${query.orderId ?? null}::uuid)
         AND (${query.pickListId ?? null}::uuid IS NULL OR pk.pick_list_id = ${query.pickListId ?? null}::uuid)
         AND (${query.status ?? null}::text IS NULL OR pk.status = ${query.status ?? null})
       ORDER BY pk.created_at DESC
       LIMIT ${take} OFFSET ${skip}
    `;
    const totals = await tx.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*)::int AS total
        FROM inventory_shipment_packages pk
       WHERE pk.tenant_id = ${ctx.tenantId}::uuid
         AND (${query.orderId ?? null}::uuid IS NULL OR pk.order_id = ${query.orderId ?? null}::uuid)
         AND (${query.pickListId ?? null}::uuid IS NULL OR pk.pick_list_id = ${query.pickListId ?? null}::uuid)
         AND (${query.status ?? null}::text IS NULL OR pk.status = ${query.status ?? null})
    `;
    return { items: rows.map(serializePackage), total: totals[0]?.total ?? 0 };
  });
}

export async function getPackage(ctx: ServiceContext, packageId: string): Promise<PackageDetail> {
  return withTenant(ctx, (tx) => loadPackageDetail(tx, ctx.tenantId, packageId));
}

export async function loadPackageDetail(
  tx: TxClient,
  tenantId: string,
  packageId: string
): Promise<PackageDetail> {
  const rows = await tx.$queryRaw<RawPackage[]>`
    ${PACKAGE_SELECT}
     WHERE pk.tenant_id = ${tenantId}::uuid
       AND pk.id = ${packageId}::uuid
  `;
  const header = rows[0];
  if (!header) throw new InventoryNotFoundError('ShipmentPackage', packageId);

  // Every line of the order, with where its units currently are. One query
  // answers both "what is in this box" and "what does the order still owe",
  // which are the two halves of the pack bench's screen.
  const lines = await tx.$queryRaw<
    {
      id: string | null;
      orderItemId: string;
      variantId: string | null;
      sku: string;
      name: string;
      quantity: number;
      scannedQuantity: number;
      ordered: number;
      packedElsewhere: number;
    }[]
  >`
    SELECT pl.id                            AS "id",
           oi.id                            AS "orderItemId",
           oi.variant_id                    AS "variantId",
           oi.sku                           AS "sku",
           oi.name                          AS "name",
           COALESCE(pl.quantity, 0)         AS "quantity",
           COALESCE(pl.scanned_quantity, 0) AS "scannedQuantity",
           oi.quantity                      AS "ordered",
           COALESCE(other.units, 0)::int    AS "packedElsewhere"
      FROM order_items oi
      LEFT JOIN inventory_shipment_package_lines pl
             ON pl.order_item_id = oi.id AND pl.package_id = ${packageId}::uuid
      LEFT JOIN LATERAL (
        SELECT SUM(x.quantity) AS units
          FROM inventory_shipment_package_lines x
          JOIN inventory_shipment_packages xp ON xp.id = x.package_id
         WHERE x.order_item_id = oi.id
           AND xp.status <> 'cancelled'
           AND xp.id <> ${packageId}::uuid
      ) other ON TRUE
     WHERE oi.tenant_id = ${tenantId}::uuid
       AND oi.order_id  = ${header.orderId}::uuid
     ORDER BY oi.created_at ASC
  `;

  const inBox = lines.filter((l) => l.id !== null || l.quantity > 0);
  const outstanding = lines
    .map((l) => ({
      orderItemId: l.orderItemId,
      sku: l.sku,
      name: l.name,
      remaining: l.ordered - l.packedElsewhere - l.quantity,
    }))
    .filter((l) => l.remaining > 0);

  return {
    ...serializePackage(header),
    lines: inBox.map((l) => ({
      id: l.id ?? l.orderItemId,
      orderItemId: l.orderItemId,
      variantId: l.variantId,
      sku: l.sku,
      name: l.name,
      quantity: l.quantity,
      scannedQuantity: l.scannedQuantity,
      ordered: l.ordered,
      packedElsewhere: l.packedElsewhere,
    })),
    outstanding,
    orderFullyPacked: outstanding.length === 0,
  };
}

/** The shared header SELECT. One definition so the list and the detail can never
 *  drift into disagreeing about what a package row is. */
const PACKAGE_SELECT = Prisma.sql`
  SELECT pk.id             AS "id",
         pk.number         AS "number",
         pk.order_id       AS "orderId",
         ord.order_number  AS "orderNumber",
         pk.pick_list_id   AS "pickListId",
         plst.number       AS "pickListNumber",
         pk.status         AS "status",
         pk.weight_grams   AS "weightGrams",
         pk.length_mm      AS "lengthMm",
         pk.width_mm       AS "widthMm",
         pk.height_mm      AS "heightMm",
         pk.packaging_type AS "packagingType",
         pk.fulfillment_id AS "fulfillmentId",
         pk.note           AS "note",
         COALESCE(agg.units, 0)::int   AS "unitCount",
         COALESCE(agg.scanned, 0)::int AS "scannedCount",
         pk.packed_at      AS "packedAt",
         pk.packed_by      AS "packedBy",
         pk.created_at     AS "createdAt"
    FROM inventory_shipment_packages pk
    JOIN orders ord                     ON ord.id = pk.order_id
    LEFT JOIN inventory_pick_lists plst  ON plst.id = pk.pick_list_id
    LEFT JOIN LATERAL (
      SELECT SUM(pl.quantity) AS units, SUM(pl.scanned_quantity) AS scanned
        FROM inventory_shipment_package_lines pl
       WHERE pl.package_id = pk.id
    ) agg ON TRUE
`;

type RawPackage = Omit<PackageRow, 'packedAt' | 'createdAt'> & {
  packedAt: Date | null;
  createdAt: Date;
};

function serializePackage(row: RawPackage): PackageRow {
  return {
    ...row,
    packedAt: row.packedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function loadBox(
  tx: TxClient,
  tenantId: string,
  packageId: string
): Promise<{
  id: string;
  number: string;
  status: string;
  orderId: string;
  fulfillmentId: string | null;
}> {
  const box = await tx.shipmentPackage.findFirst({
    where: { id: packageId, tenantId },
    select: { id: true, number: true, status: true, orderId: true, fulfillmentId: true },
  });
  if (!box) throw new InventoryNotFoundError('ShipmentPackage', packageId);
  return box;
}

export async function nextPackageNumber(tx: TxClient, tenantId: string): Promise<string> {
  const count = await tx.shipmentPackage.count({ where: { tenantId } });
  return `PKG-${(count + 1).toString().padStart(6, '0')}`;
}
