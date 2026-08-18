// Bins — the service layer (docs/146 Phase 2).
//
// CRUD over shelves, the put-away suggester, bin-to-bin moves, and the reads a
// picker and a counter make ("what is on this shelf", "which shelves hold this
// item"). The ledger half lives in ./bin-ledger.ts; this is everything around it.
//
// ── Turning bins ON is a real operation, not a checkbox ──────────────────────
//
// `enableBinsForWarehouse` provisions the three system shelves and seats every
// existing quantity in DEFAULT, so `Σ(bin levels) == level.on_hand` holds from
// the instant the invariant starts applying. A tenant who flipped a flag and then
// found every shelf empty while the location said four thousand units would
// rightly conclude the feature was broken.

import { Prisma, withTenant } from '@wizeworks/db';
import type { TxClient } from '@wizeworks/db';
import {
  CreateBinInput,
  MoveBetweenBinsInput,
  UpdateBinInput,
  type BinType,
} from '@wizeworks/commerce-schemas';

import { writeAuditLog } from '../audit';
import {
  InventoryConflictError,
  InventoryNotFoundError,
  InventoryValidationError,
} from '../errors';
import type { ServiceContext } from '../errors';
import { publishInventoryEvent } from '../events';

import { applyBinMovement, defaultBinFor } from './bin-ledger';

// ─── Row shapes ────────────────────────────────────────────────────────────────

export interface BinRow {
  id: string;
  warehouseId: string;
  warehouseName: string | null;
  code: string;
  name: string | null;
  zone: string | null;
  aisle: string | null;
  rack: string | null;
  shelf: string | null;
  type: string;
  isSellable: boolean;
  pickSequence: number | null;
  capacityUnits: number | null;
  isDefault: boolean;
  isSystem: boolean;
  isActive: boolean;
  notes: string | null;
  /** Distinct items on this shelf, and the total units. The two numbers anyone
   *  asks about a bin, so the list never needs a second request per row. */
  itemCount: number;
  unitCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BinContentRow {
  variantId: string;
  sku: string | null;
  productId: string | null;
  productTitle: string | null;
  onHand: number;
  lastCountedAt: string | null;
  asOf: string;
}

/** Where one item sits across a location's shelves. */
export interface VariantBinRow {
  binId: string;
  binCode: string;
  binName: string | null;
  zone: string | null;
  type: string;
  isSellable: boolean;
  pickSequence: number | null;
  onHand: number;
  lastCountedAt: string | null;
}

export interface ListBinsFilter {
  /** One bin by id. Exists so `getBin` reuses this query rather than a second
   *  one — the per-row aggregates are the whole reason a caller wants a bin, and
   *  two code paths computing them is two chances to compute them differently. */
  id?: string;
  warehouseId?: string;
  zone?: string;
  type?: string;
  /** Free text over code, name and zone. */
  q?: string;
  /** Include the platform-provisioned shelves (DEFAULT / QUARANTINE / DAMAGED).
   *  Off by default: they are not shelves anyone chose, and in a picker they are
   *  usually the wrong answer. */
  includeSystem?: boolean;
  includeInactive?: boolean;
  /** Only shelves currently holding something. The counter's filter. */
  nonEmptyOnly?: boolean;
  take?: number;
  skip?: number;
}

// ─── The system shelves ────────────────────────────────────────────────────────

/**
 * The three shelves every bin-enabled location gets, and why each exists.
 *
 * They are provisioned rather than left to the tenant because each one is load
 * bearing: DEFAULT is where the ledger lands when nobody named a shelf,
 * QUARANTINE is where a failed receipt or an inspected return goes, DAMAGED is
 * where a write-off physically sits, and REPAIR is where returned goods wait for
 * the work that will make them sellable again (docs/146 Phase 9.7). Code that
 * needs "the quarantine shelf" cannot cope with it not existing, and asking a
 * merchant to create four shelves before they can receive anything is a setup
 * wizard nobody finishes.
 */
const SYSTEM_BINS = [
  {
    code: 'DEFAULT',
    name: 'Unspecified',
    type: 'pick' as const,
    isSellable: true,
    isDefault: true,
  },
  {
    code: 'QUARANTINE',
    name: 'Quarantine',
    type: 'quarantine' as const,
    isSellable: false,
    isDefault: false,
  },
  {
    code: 'DAMAGED',
    name: 'Damaged goods',
    type: 'damaged' as const,
    isSellable: false,
    isDefault: false,
  },
  {
    code: 'REPAIR',
    name: 'Awaiting repair',
    type: 'repair' as const,
    isSellable: false,
    isDefault: false,
  },
];

/** Whether stock on a shelf of this type counts toward what a customer may buy.
 *  Seeded onto the row at creation; the tenant may then override it, because the
 *  two genuinely come apart (a bulk shelf pulled from the pick face while it is
 *  reorganised, a quarantine shelf reopened once its batch clears). */
export function defaultSellableFor(type: BinType): boolean {
  return type !== 'quarantine' && type !== 'damaged' && type !== 'repair';
}

/**
 * Turn bins on for a location: provision the system shelves and seat everything
 * already there in DEFAULT.
 *
 * Idempotent — re-running provisions nothing new and re-seats nothing, so a
 * double click or a retried request is harmless.
 */
export async function enableBinsForWarehouse(
  ctx: ServiceContext,
  warehouseId: string
): Promise<{ binsCreated: number; levelsSeated: number }> {
  return withTenant(ctx, async (tx) => {
    const warehouse = await tx.warehouse.findFirst({
      where: { id: warehouseId, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true, usesBins: true },
    });
    if (!warehouse) throw new InventoryNotFoundError('Warehouse', warehouseId);

    const { binsCreated } = await provisionSystemBins(tx, ctx.tenantId, warehouseId);

    // Seat every existing quantity in DEFAULT. Without this the shelves read
    // empty while the location says four thousand units, and a tenant would
    // rightly conclude the feature was broken.
    //
    // No bin movements are written. A movement row asserts something HAPPENED at
    // a time, and nothing happened here — this is the opening position. Writing a
    // fabricated put-away for every level would put a lie in an append-only log.
    const defaultBinId = await defaultBinFor(tx, warehouseId);
    const seated = await tx.$executeRaw`
      INSERT INTO inventory_bin_levels
        (tenant_id, variant_id, bin_id, warehouse_id, on_hand, as_of, updated_at)
      SELECT l.tenant_id, l.variant_id, ${defaultBinId}::uuid, l.warehouse_id, l.on_hand, l.as_of, now()
        FROM inventory_levels l
       WHERE l.tenant_id = ${ctx.tenantId}::uuid
         AND l.warehouse_id = ${warehouseId}::uuid
      ON CONFLICT (variant_id, bin_id) DO NOTHING
    `;

    await tx.warehouse.update({ where: { id: warehouseId }, data: { usesBins: true } });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.warehouse.bins_enabled',
      entityType: 'Warehouse',
      entityId: warehouseId,
      diff: { before: { usesBins: warehouse.usesBins }, after: { usesBins: true } },
    });

    return { binsCreated, levelsSeated: seated };
  });
}

/** Create the three system shelves if they are missing. Called on enable, and by
 *  warehouse creation so a location born bin-enabled is ready immediately. */
export async function provisionSystemBins(
  tx: TxClient,
  tenantId: string,
  warehouseId: string
): Promise<{ binsCreated: number }> {
  let binsCreated = 0;
  for (const bin of SYSTEM_BINS) {
    const created = await tx.$executeRaw`
      INSERT INTO inventory_bins
        (tenant_id, warehouse_id, code, name, type, is_sellable, is_default, is_system)
      VALUES (${tenantId}::uuid, ${warehouseId}::uuid, ${bin.code}, ${bin.name}, ${bin.type},
              ${bin.isSellable}, ${bin.isDefault}, true)
      ON CONFLICT (warehouse_id, code) DO NOTHING
    `;
    binsCreated += created;
  }
  return { binsCreated };
}

/** Turn bins off. The shelves and their history are KEPT, not deleted — a tenant
 *  trying the feature and switching back should not lose a week of put-aways, and
 *  turning it on again should find the shelves where they left them. */
export async function disableBinsForWarehouse(
  ctx: ServiceContext,
  warehouseId: string
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const warehouse = await tx.warehouse.findFirst({
      where: { id: warehouseId, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!warehouse) throw new InventoryNotFoundError('Warehouse', warehouseId);

    await tx.warehouse.update({ where: { id: warehouseId }, data: { usesBins: false } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.warehouse.bins_disabled',
      entityType: 'Warehouse',
      entityId: warehouseId,
      diff: { before: { usesBins: true }, after: { usesBins: false } },
    });
  });
}

// ─── CRUD ──────────────────────────────────────────────────────────────────────

interface BinQueryRow {
  id: string;
  warehouseId: string;
  warehouseName: string | null;
  code: string;
  name: string | null;
  zone: string | null;
  aisle: string | null;
  rack: string | null;
  shelf: string | null;
  type: string;
  isSellable: boolean;
  pickSequence: number | null;
  capacityUnits: number | null;
  isDefault: boolean;
  isSystem: boolean;
  isActive: boolean;
  notes: string | null;
  itemCount: number;
  unitCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export async function listBins(
  ctx: ServiceContext,
  filter: ListBinsFilter = {}
): Promise<{ items: BinRow[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const take = Math.min(filter.take ?? 100, 500);
    const skip = filter.skip ?? 0;

    // Raw SQL because every row carries two aggregates over bin levels, and the
    // list is sorted by the pick walk order with NULLS LAST — neither of which
    // Prisma expresses. One query, no N+1.
    const where = buildBinWhere(ctx.tenantId, filter);
    const rows = await tx.$queryRaw<BinQueryRow[]>`
      SELECT b.id                AS "id",
             b.warehouse_id      AS "warehouseId",
             w.name              AS "warehouseName",
             b.code              AS "code",
             b.name              AS "name",
             b.zone              AS "zone",
             b.aisle             AS "aisle",
             b.rack              AS "rack",
             b.shelf             AS "shelf",
             b.type              AS "type",
             b.is_sellable       AS "isSellable",
             b.pick_sequence     AS "pickSequence",
             b.capacity_units    AS "capacityUnits",
             b.is_default        AS "isDefault",
             b.is_system         AS "isSystem",
             b.is_active         AS "isActive",
             b.notes             AS "notes",
             COALESCE(c.item_count, 0)::int AS "itemCount",
             COALESCE(c.unit_count, 0)::int AS "unitCount",
             b.created_at        AS "createdAt",
             b.updated_at        AS "updatedAt"
        FROM inventory_bins b
        JOIN inventory_warehouses w ON w.id = b.warehouse_id
        LEFT JOIN LATERAL (
          SELECT COUNT(*) FILTER (WHERE bl.on_hand <> 0) AS item_count,
                 SUM(bl.on_hand)                          AS unit_count
            FROM inventory_bin_levels bl
           WHERE bl.bin_id = b.id
        ) c ON TRUE
       WHERE ${where}
       ORDER BY w.name ASC, b.pick_sequence ASC NULLS LAST, b.code ASC
       LIMIT ${take} OFFSET ${skip}
    `;

    const totals = await tx.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*)::int AS total
        FROM inventory_bins b
        JOIN inventory_warehouses w ON w.id = b.warehouse_id
        LEFT JOIN LATERAL (
          SELECT SUM(bl.on_hand) AS unit_count
            FROM inventory_bin_levels bl
           WHERE bl.bin_id = b.id
        ) c ON TRUE
       WHERE ${where}
    `;

    return {
      items: rows.map(serializeBin),
      total: totals[0]?.total ?? 0,
    };
  });
}

/** The WHERE shared by the page query and its count. Composed once rather than
 *  written twice, because two literals is how a list and its total drift apart
 *  and a paginator starts lying about how many pages there are. */
function buildBinWhere(tenantId: string, filter: ListBinsFilter): Prisma.Sql {
  return Prisma.join(
    [
      Prisma.sql`b.tenant_id = ${tenantId}::uuid`,
      filter.id ? Prisma.sql`AND b.id = ${filter.id}::uuid` : Prisma.empty,
      filter.includeInactive
        ? Prisma.empty
        : Prisma.sql`AND b.is_active = true AND b.deleted_at IS NULL`,
      filter.includeSystem ? Prisma.empty : Prisma.sql`AND b.is_system = false`,
      filter.warehouseId
        ? Prisma.sql`AND b.warehouse_id = ${filter.warehouseId}::uuid`
        : Prisma.empty,
      filter.zone ? Prisma.sql`AND b.zone = ${filter.zone}` : Prisma.empty,
      filter.type ? Prisma.sql`AND b.type = ${filter.type}` : Prisma.empty,
      filter.nonEmptyOnly ? Prisma.sql`AND COALESCE(c.unit_count, 0) <> 0` : Prisma.empty,
      filter.q
        ? Prisma.sql`AND (b.code ILIKE ${`%${filter.q}%`} OR b.name ILIKE ${`%${filter.q}%`} OR b.zone ILIKE ${`%${filter.q}%`})`
        : Prisma.empty,
    ],
    ' '
  );
}

export async function getBin(ctx: ServiceContext, id: string): Promise<BinRow> {
  // System and archived shelves included: this is a lookup by id, and a caller
  // holding an id is entitled to what it points at. The exclusions on the LIST
  // exist to keep a picker sensible, not to hide rows.
  const { items } = await listBins(ctx, {
    id,
    includeSystem: true,
    includeInactive: true,
    take: 1,
  });
  const found = items[0];
  if (!found) throw new InventoryNotFoundError('InventoryBin', id);
  return found;
}

export async function createBin(ctx: ServiceContext, rawInput: unknown): Promise<BinRow> {
  const input = CreateBinInput.parse(rawInput);

  const id = await withTenant(ctx, async (tx) => {
    const warehouse = await tx.warehouse.findFirst({
      where: { id: input.warehouseId, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!warehouse) throw new InventoryNotFoundError('Warehouse', input.warehouseId);

    const clash = await tx.inventoryBin.findFirst({
      where: { warehouseId: input.warehouseId, code: input.code },
      select: { id: true },
    });
    if (clash) {
      throw new InventoryConflictError(
        `This location already has a shelf labelled ${input.code}.`,
        'code'
      );
    }

    const bin = await tx.inventoryBin.create({
      data: {
        tenantId: ctx.tenantId,
        warehouseId: input.warehouseId,
        code: input.code,
        name: input.name ?? null,
        zone: input.zone ?? null,
        aisle: input.aisle ?? null,
        rack: input.rack ?? null,
        shelf: input.shelf ?? null,
        type: input.type,
        isSellable: input.isSellable ?? defaultSellableFor(input.type),
        pickSequence: input.pickSequence ?? null,
        capacityUnits: input.capacityUnits ?? null,
        notes: input.notes ?? null,
      },
      select: { id: true },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.bin.created',
      entityType: 'InventoryBin',
      entityId: bin.id,
      diff: { before: null, after: { code: input.code, type: input.type } },
    });

    return bin.id;
  });

  return getBin(ctx, id);
}

export async function updateBin(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<BinRow> {
  const input = UpdateBinInput.parse(rawInput);

  await withTenant(ctx, async (tx) => {
    const existing = await tx.inventoryBin.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, code: true, warehouseId: true, isSystem: true, type: true },
    });
    if (!existing) throw new InventoryNotFoundError('InventoryBin', id);

    // A system shelf may be renamed, re-sequenced and re-noted, but its CODE and
    // TYPE are load-bearing: code is how `defaultBinFor` and the quarantine
    // routing find it, and type is what makes it not sellable.
    if (existing.isSystem && (input.code !== undefined || input.type !== undefined)) {
      throw new InventoryValidationError(
        'This shelf is provisioned by sparx — its label and kind cannot be changed. You can rename it and set where it falls in the pick order.',
        [{ field: 'code', message: 'Not editable on a system shelf' }]
      );
    }

    if (input.code !== undefined && input.code !== existing.code) {
      const clash = await tx.inventoryBin.findFirst({
        where: { warehouseId: existing.warehouseId, code: input.code, id: { not: id } },
        select: { id: true },
      });
      if (clash) {
        throw new InventoryConflictError(
          `This location already has a shelf labelled ${input.code}.`,
          'code'
        );
      }
    }

    await tx.inventoryBin.update({
      where: { id },
      data: {
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.zone !== undefined ? { zone: input.zone } : {}),
        ...(input.aisle !== undefined ? { aisle: input.aisle } : {}),
        ...(input.rack !== undefined ? { rack: input.rack } : {}),
        ...(input.shelf !== undefined ? { shelf: input.shelf } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.isSellable !== undefined ? { isSellable: input.isSellable } : {}),
        ...(input.pickSequence !== undefined ? { pickSequence: input.pickSequence } : {}),
        ...(input.capacityUnits !== undefined ? { capacityUnits: input.capacityUnits } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.bin.updated',
      entityType: 'InventoryBin',
      entityId: id,
      diff: { before: { code: existing.code, type: existing.type }, after: { ...input } },
    });
  });

  return getBin(ctx, id);
}

/**
 * Archive a shelf.
 *
 * Refused while it still holds stock. The alternative — archiving it anyway —
 * makes the units invisible while still counting toward the location total, so
 * `Σ(bins) == level` still holds but nobody can find the difference. Empty it
 * first; the error says so.
 */
export async function archiveBin(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const bin = await tx.inventoryBin.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, code: true, isSystem: true },
    });
    if (!bin) throw new InventoryNotFoundError('InventoryBin', id);
    if (bin.isSystem) {
      throw new InventoryValidationError(
        'This shelf is provisioned by sparx and cannot be removed. Turn bins off for the location instead.'
      );
    }

    const held = await tx.inventoryBinLevel.aggregate({
      where: { binId: id, tenantId: ctx.tenantId },
      _sum: { onHand: true },
    });
    const units = held._sum.onHand ?? 0;
    if (units !== 0) {
      throw new InventoryConflictError(
        `${bin.code} still holds ${String(units)} ${units === 1 ? 'unit' : 'units'}. Move them to another shelf first, so the stock stays findable.`
      );
    }

    await tx.inventoryBin.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.bin.archived',
      entityType: 'InventoryBin',
      entityId: id,
      diff: { before: { code: bin.code, isActive: true }, after: { isActive: false } },
    });
  });
}

// ─── Contents ──────────────────────────────────────────────────────────────────

/** What is on this shelf. The picker's and the counter's read. */
export async function binContents(
  ctx: ServiceContext,
  binId: string,
  opts: { includeEmpty?: boolean; take?: number } = {}
): Promise<BinContentRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.inventoryBinLevel.findMany({
      where: {
        tenantId: ctx.tenantId,
        binId,
        ...(opts.includeEmpty ? {} : { onHand: { not: 0 } }),
      },
      include: {
        variant: {
          select: { sku: true, title: true, productId: true, product: { select: { title: true } } },
        },
      },
      orderBy: { onHand: 'desc' },
      take: Math.min(opts.take ?? 250, 1000),
    });
    return rows.map((r) => ({
      variantId: r.variantId,
      sku: r.variant?.sku ?? null,
      productId: r.variant?.productId ?? null,
      productTitle: r.variant?.product?.title ?? r.variant?.title ?? null,
      onHand: r.onHand,
      lastCountedAt: r.lastCountedAt?.toISOString() ?? null,
      asOf: r.asOf.toISOString(),
    }));
  });
}

/** Where one item sits across a location. The answer to "go and get me one". */
export async function binsForVariant(
  ctx: ServiceContext,
  variantId: string,
  opts: { warehouseId?: string; includeEmpty?: boolean } = {}
): Promise<VariantBinRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.inventoryBinLevel.findMany({
      where: {
        tenantId: ctx.tenantId,
        variantId,
        ...(opts.warehouseId ? { warehouseId: opts.warehouseId } : {}),
        ...(opts.includeEmpty ? {} : { onHand: { not: 0 } }),
      },
      include: {
        bin: {
          select: {
            code: true,
            name: true,
            zone: true,
            type: true,
            isSellable: true,
            pickSequence: true,
          },
        },
      },
      // Pick order, so the list reads as a route rather than a set.
      orderBy: [{ bin: { pickSequence: 'asc' } }, { onHand: 'desc' }],
    });
    return rows.map((r) => ({
      binId: r.binId,
      binCode: r.bin.code,
      binName: r.bin.name,
      zone: r.bin.zone,
      type: r.bin.type,
      isSellable: r.bin.isSellable,
      pickSequence: r.bin.pickSequence,
      onHand: r.onHand,
      lastCountedAt: r.lastCountedAt?.toISOString() ?? null,
    }));
  });
}

// ─── Moving between shelves ────────────────────────────────────────────────────

/**
 * Move stock from one shelf to another within a location.
 *
 * Writes a −N/+N pair to the BIN ledger and nothing at all to the warehouse
 * ledger, because the warehouse quantity did not change. That is the honest
 * record: nothing entered or left the building.
 *
 * Both halves carry `fromBinId`/`toBinId`, so one query reconstructs "5 went from
 * A-01 to B-04" rather than leaving a reader to pair two rows by timestamp.
 */
export async function moveBetweenBins(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ from: VariantBinRow[]; moved: number }> {
  const input = MoveBetweenBinsInput.parse(rawInput);

  await withTenant(ctx, async (tx) => {
    if (input.fromBinId === input.toBinId) {
      throw new InventoryValidationError('That is the same shelf — nothing to move.');
    }

    const bins = await tx.inventoryBin.findMany({
      where: {
        id: { in: [input.fromBinId, input.toBinId] },
        tenantId: ctx.tenantId,
        deletedAt: null,
      },
      select: { id: true, code: true, warehouseId: true, isActive: true },
    });
    const from = bins.find((b) => b.id === input.fromBinId);
    const to = bins.find((b) => b.id === input.toBinId);
    if (!from) throw new InventoryNotFoundError('InventoryBin', input.fromBinId);
    if (!to) throw new InventoryNotFoundError('InventoryBin', input.toBinId);
    if (!to.isActive) {
      throw new InventoryValidationError(`${to.code} is archived — pick a shelf that is in use.`);
    }
    // Across locations is a TRANSFER, not a bin move: it changes both warehouse
    // quantities and needs the in-transit custody the transfer flow provides.
    // Silently doing it here would leave the warehouse ledger untouched while the
    // stock physically moved buildings.
    if (from.warehouseId !== to.warehouseId) {
      throw new InventoryValidationError(
        'Those shelves are in different locations. Use a transfer, so the stock is tracked while it is in transit.'
      );
    }

    const common = {
      tenantId: ctx.tenantId,
      variantId: input.variantId,
      warehouseId: from.warehouseId,
      reason: 'bin_move',
      fromBinId: input.fromBinId,
      toBinId: input.toBinId,
      actorType: ctx.userId ? 'user' : 'system',
      actorId: ctx.userId ?? null,
      note: input.note ?? null,
    };

    // Out first: if the source cannot cover it, `applyBinMovement` refuses and the
    // whole transaction rolls back with nothing half-moved.
    await applyBinMovement(tx, {
      ...common,
      binId: input.fromBinId,
      delta: -input.quantity,
      ...(input.idempotencyKey ? { idempotencyKey: `${input.idempotencyKey}:out` } : {}),
    });
    await applyBinMovement(tx, {
      ...common,
      binId: input.toBinId,
      delta: input.quantity,
      confirmsPhysicalCount: true,
      ...(input.idempotencyKey ? { idempotencyKey: `${input.idempotencyKey}:in` } : {}),
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.bin.moved',
      entityType: 'InventoryBinLevel',
      entityId: input.variantId,
      diff: {
        before: { binId: input.fromBinId },
        after: { binId: input.toBinId, quantity: input.quantity },
      },
    });
  });

  // Post-commit, like every other event in this module. Deliberately NOT one of
  // the `inventory.adjusted` family: no location quantity changed, so a consumer
  // that re-prices or re-indexes on stock movement must not wake up for this.
  await publishInventoryEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'inventory.bin.moved',
    data: {
      variantId: input.variantId,
      fromBinId: input.fromBinId,
      toBinId: input.toBinId,
      quantity: input.quantity,
    },
  });

  return {
    from: await binsForVariant(ctx, input.variantId),
    moved: input.quantity,
  };
}

// ─── Put-away ──────────────────────────────────────────────────────────────────

export interface PutAwaySuggestion {
  binId: string;
  binCode: string;
  binName: string | null;
  zone: string | null;
  /** Why this shelf — shown to the person, not just used to sort. A suggestion
   *  nobody can second-guess is one people override blindly or follow blindly,
   *  and both are worse than a reason. */
  reason: 'home_shelf' | 'already_here' | 'has_room' | 'default';
  explanation: string;
  onHand: number;
  capacityUnits: number | null;
  /** Units this shelf could still take, when a capacity is set. */
  headroom: number | null;
}

/**
 * Where should this go?
 *
 * Ordered by how strong the evidence is, not by cleverness: its declared home
 * shelf, then a shelf that already holds it, then any pick shelf with room, then
 * the default. Returns several so the person on the floor can disagree — the
 * suggestion is advice, and a warehouse always has reasons the system does not
 * know.
 */
export async function suggestPutAway(
  ctx: ServiceContext,
  input: { variantId: string; warehouseId: string; quantity?: number }
): Promise<PutAwaySuggestion[]> {
  return withTenant(ctx, async (tx) => {
    const quantity = input.quantity ?? 0;
    const suggestions: PutAwaySuggestion[] = [];
    const seen = new Set<string>();

    const push = (
      bin: {
        id: string;
        code: string;
        name: string | null;
        zone: string | null;
        capacityUnits: number | null;
      },
      onHand: number,
      reason: PutAwaySuggestion['reason'],
      explanation: string
    ) => {
      if (seen.has(bin.id)) return;
      seen.add(bin.id);
      suggestions.push({
        binId: bin.id,
        binCode: bin.code,
        binName: bin.name,
        zone: bin.zone,
        reason,
        explanation,
        onHand,
        capacityUnits: bin.capacityUnits,
        headroom: bin.capacityUnits === null ? null : Math.max(0, bin.capacityUnits - onHand),
      });
    };

    const binSelect = {
      id: true,
      code: true,
      name: true,
      zone: true,
      capacityUnits: true,
    } as const;

    // 1. Its declared home shelf — in THIS location, live, and still SELLABLE.
    //
    // All three conditions matter and the third is the one that is easy to
    // forget: a home shelf since turned into a quarantine or damaged shelf must
    // not be suggested, because availability reads the LOCATION total, so stock
    // put there would go on being sold while a picker sent to fetch it finds a
    // box marked "on hold". The same guard is in `mirrorMovementToBins` and
    // `resolvePutAwayBin` — three resolvers, deliberately, because each returns
    // a different shape, but they must agree on WHICH shelf.
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
          isSellable: true,
        },
        select: binSelect,
      });
      if (home) {
        const level = await tx.inventoryBinLevel.findFirst({
          where: { variantId: input.variantId, binId: home.id },
          select: { onHand: true },
        });
        push(home, level?.onHand ?? 0, 'home_shelf', 'This is where you keep this item.');
      }
    }

    // 2. Shelves that already hold it — the strongest free signal, and it keeps
    //    one item in one place instead of scattering it.
    const holding = await tx.inventoryBinLevel.findMany({
      where: {
        tenantId: ctx.tenantId,
        variantId: input.variantId,
        warehouseId: input.warehouseId,
        onHand: { gt: 0 },
        bin: { isActive: true, deletedAt: null, isSellable: true },
      },
      orderBy: { onHand: 'desc' },
      take: 3,
      include: { bin: { select: binSelect } },
    });
    for (const level of holding) {
      push(
        level.bin,
        level.onHand,
        'already_here',
        `Already holds ${String(level.onHand)} of these.`
      );
    }

    // 3. Pick shelves with headroom, emptiest first — spreading new lines across
    //    empty space rather than cramming the first shelf in the aisle.
    if (suggestions.length < 4) {
      const roomy = await tx.inventoryBin.findMany({
        where: {
          tenantId: ctx.tenantId,
          warehouseId: input.warehouseId,
          type: 'pick',
          isActive: true,
          isSystem: false,
          deletedAt: null,
          id: { notIn: [...seen] },
        },
        orderBy: { pickSequence: 'asc' },
        take: 20,
        select: binSelect,
      });
      const loads = await tx.inventoryBinLevel.groupBy({
        by: ['binId'],
        where: { tenantId: ctx.tenantId, binId: { in: roomy.map((b) => b.id) } },
        _sum: { onHand: true },
      });
      const loadBy = new Map(loads.map((l) => [l.binId, l._sum.onHand ?? 0]));
      const fits = roomy
        .map((bin) => ({ bin, load: loadBy.get(bin.id) ?? 0 }))
        .filter(
          ({ bin, load }) => bin.capacityUnits === null || bin.capacityUnits - load >= quantity
        )
        .sort((a, b) => a.load - b.load)
        .slice(0, 4 - suggestions.length);
      for (const { bin, load } of fits) {
        push(bin, load, 'has_room', load === 0 ? 'Empty shelf.' : 'Has room for these.');
      }
    }

    // 4. The default, always last and always present — a put-away screen with no
    //    answer is a screen someone abandons, and stock that is recorded
    //    imprecisely is worth far more than stock that is not recorded.
    if (suggestions.length === 0) {
      const fallbackId = await defaultBinFor(tx, input.warehouseId);
      const fallback = await tx.inventoryBin.findFirstOrThrow({
        where: { id: fallbackId },
        select: binSelect,
      });
      const level = await tx.inventoryBinLevel.findFirst({
        where: { variantId: input.variantId, binId: fallbackId },
        select: { onHand: true },
      });
      push(
        fallback,
        level?.onHand ?? 0,
        'default',
        'No shelf chosen yet — this keeps it recorded until you decide.'
      );
    }

    return suggestions;
  });
}

/** Pin an item's home shelf, so put-away leads with it from now on. */
export async function setVariantHomeBin(
  ctx: ServiceContext,
  variantId: string,
  binId: string | null
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    if (binId) {
      const bin = await tx.inventoryBin.findFirst({
        where: { id: binId, tenantId: ctx.tenantId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (!bin) throw new InventoryNotFoundError('InventoryBin', binId);
    }
    await tx.productVariant.update({ where: { id: variantId }, data: { defaultBinId: binId } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.variant.home_bin_set',
      entityType: 'ProductVariant',
      entityId: variantId,
      diff: { before: null, after: { defaultBinId: binId } },
    });
  });
}

function serializeBin(r: BinQueryRow): BinRow {
  return {
    id: r.id,
    warehouseId: r.warehouseId,
    warehouseName: r.warehouseName,
    code: r.code,
    name: r.name,
    zone: r.zone,
    aisle: r.aisle,
    rack: r.rack,
    shelf: r.shelf,
    type: r.type,
    isSellable: r.isSellable,
    pickSequence: r.pickSequence,
    capacityUnits: r.capacityUnits,
    isDefault: r.isDefault,
    isSystem: r.isSystem,
    isActive: r.isActive,
    notes: r.notes,
    itemCount: r.itemCount,
    unitCount: r.unitCount,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
