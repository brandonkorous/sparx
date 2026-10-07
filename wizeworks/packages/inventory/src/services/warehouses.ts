// Warehouse CRUD. A warehouse is any stock-holding location — owned, 3PL,
// dropship-virtual, or in-transit. Archival is blocked while stock remains.

import { CreateWarehouseInput, UpdateWarehouseInput } from '@wizeworks/commerce-schemas';
import { isSampleRow, withTenant } from '@wizeworks/db';
import type { Prisma, TxClient, Warehouse } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import {
  InventoryConflictError,
  InventoryNotFoundError,
  InventoryValidationError,
} from '../errors';
import type { ServiceContext } from '../errors';
import { indexInventoryEntity } from '../events';
import { CHANNEL_CANDIDATE_SELECT, channelDefaultId } from './channel-default';

export interface WarehouseRow {
  id: string;
  name: string;
  code: string;
  type: string;
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  defaultForChannel: string[];
  isActive: boolean;
  /**
   * This location came from a sample pack rather than from the owner.
   *
   * Clearing sample data deliberately LEAVES locations behind, because a tenant
   * may have renamed one and made it theirs. That is defensible only if the
   * screen can still say where it came from — otherwise a warehouse nobody
   * opened sits in the list looking exactly like one they did.
   */
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
  /**
   * Units on hand here, and how many shelves this location has.
   *
   * Carried on the LIST because two screens read the same fact and neither had
   * it. The Shelves list showed a column of zeros on every row while 491 units
   * sat at another location entirely, and the Locations list did not say which
   * location held anything — so a wall of zeros was indistinguishable from an
   * empty warehouse. Counted once, here, rather than probed per row.
   *
   * NULL when the caller did not ask for it, never 0: "nobody counted" and
   * "nothing here" are different answers and a zero would assert the second.
   * The list and a single read both count; an audit snapshot does not. The
   * single read did not either, until its pane had to say what is there
   * (issue 929).
   */
  onHand: number | null;
  binCount: number | null;
  /**
   * Online orders ship from here: postage is priced from this address and a
   * label is bought from it. The same answer `resolveDefaultWarehouseId` gives,
   * so the screen and the courier cannot disagree (issue 929). The column it
   * mostly comes from, `defaultForChannel`, is not enough on its own: with no
   * location named, a fallback still ships, and the screen has to say which.
   *
   * NULL when the caller did not work it out (an audit snapshot).
   */
  shipsOnline: boolean | null;
}

/** The location online orders ship from, by the resolver's own rule. */
async function storefrontShipFromIdOnTx(tx: TxClient): Promise<string | null> {
  const candidates = await tx.warehouse.findMany({
    where: { isActive: true, deletedAt: null },
    select: CHANNEL_CANDIDATE_SELECT,
  });
  return channelDefaultId(candidates, 'storefront');
}

/**
 * A channel ships from ONE place. Naming a location for a channel takes the
 * channel off every other location, in the same transaction, with an audit line
 * for each. Without this, two locations could both claim it and the resolver
 * would pick the older without a word.
 */
async function releaseChannelsOnTx(
  tx: TxClient,
  ctx: ServiceContext,
  keepId: string,
  channels: readonly string[]
): Promise<void> {
  if (channels.length === 0) return;
  const others = await tx.warehouse.findMany({
    where: { deletedAt: null, NOT: { id: keepId } },
  });
  for (const other of others) {
    const list = Array.isArray(other.defaultForChannel)
      ? (other.defaultForChannel as string[])
      : [];
    const kept = list.filter((channel) => !channels.includes(channel));
    if (kept.length === list.length) continue;
    const updated = await tx.warehouse.update({
      where: { id: other.id },
      data: { defaultForChannel: kept },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.warehouse.updated',
      entityType: 'Warehouse',
      entityId: other.id,
      diff: {
        before: serializeWarehouse(other) as unknown as Record<string, unknown>,
        after: serializeWarehouse(updated) as unknown as Record<string, unknown>,
      },
    });
  }
}

export async function listWarehouses(
  ctx: ServiceContext,
  filter: {
    q?: string;
    /** Narrow to one warehouse type (owned / 3pl / dropship / virtual). */
    type?: string;
    includeInactive?: boolean;
    includeSystem?: boolean;
    take?: number;
    skip?: number;
  } = {}
): Promise<{ items: WarehouseRow[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const where: Prisma.WarehouseWhereInput = {
      deletedAt: null,
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.includeInactive ? {} : { isActive: true }),
      // The in-transit holding location is a system warehouse — keep it out of the
      // ordinary list/pickers unless a caller explicitly opts in.
      ...(filter.includeSystem ? {} : { isSystem: false }),
      ...(filter.q
        ? {
            OR: [
              { name: { contains: filter.q, mode: 'insensitive' } },
              { code: { contains: filter.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      tx.warehouse.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
        take: Math.min(filter.take ?? 50, 250),
        skip: filter.skip ?? 0,
      }),
      tx.warehouse.count({ where }),
    ]);

    // Two grouped queries over the page's warehouses, rather than two per row.
    // A location with nothing in it returns no group, which is why the maps
    // below default to 0 HERE and not in the serializer: a warehouse on this
    // page was counted and genuinely holds nothing, while a warehouse reached
    // through `getWarehouse` was never counted at all.
    const ids = rows.map((row) => row.id);
    const [levels, bins] = await Promise.all([
      ids.length === 0
        ? []
        : tx.inventoryLevel.groupBy({
            by: ['warehouseId'],
            where: { warehouseId: { in: ids } },
            _sum: { onHand: true },
          }),
      ids.length === 0
        ? []
        : tx.inventoryBin.groupBy({
            by: ['warehouseId'],
            where: { warehouseId: { in: ids } },
            _count: { _all: true },
          }),
    ]);
    const onHandBy = new Map<string, number>(
      levels.map((row) => [row.warehouseId, row._sum.onHand ?? 0])
    );
    const binsBy = new Map<string, number>(bins.map((row) => [row.warehouseId, row._count._all]));
    const shipsFrom = await storefrontShipFromIdOnTx(tx);

    return {
      items: rows.map((row) =>
        serializeWarehouse(
          row,
          {
            onHand: onHandBy.get(row.id) ?? 0,
            binCount: binsBy.get(row.id) ?? 0,
          },
          row.id === shipsFrom
        )
      ),
      total,
    };
  });
}

export async function getWarehouse(
  ctx: ServiceContext,
  warehouseId: string
): Promise<WarehouseRow> {
  const found = await withTenant(ctx, async (tx) => {
    const row = await tx.warehouse.findFirst({ where: { id: warehouseId, deletedAt: null } });
    if (!row) return null;
    const [levels, binCount, shipsFrom] = await Promise.all([
      tx.inventoryLevel.aggregate({ where: { warehouseId }, _sum: { onHand: true } }),
      tx.inventoryBin.count({ where: { warehouseId } }),
      storefrontShipFromIdOnTx(tx),
    ]);
    return { row, counts: { onHand: levels._sum.onHand ?? 0, binCount }, shipsFrom };
  });
  if (!found) throw new InventoryNotFoundError('Warehouse', warehouseId);
  return serializeWarehouse(found.row, found.counts, found.row.id === found.shipsFrom);
}

export async function createWarehouse(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ id: string }> {
  const input = CreateWarehouseInput.parse(rawInput);

  const result = await withTenant(ctx, async (tx) => {
    const existing = await tx.warehouse.findFirst({
      where: { code: input.code, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      throw new InventoryConflictError(`Warehouse code "${input.code}" is already in use`, 'code');
    }

    const warehouse = await tx.warehouse.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name,
        code: input.code,
        type: input.type,
        line1: input.address.line1,
        line2: input.address.line2 ?? null,
        city: input.address.city,
        region: input.address.region ?? null,
        postalCode: input.address.postalCode ?? null,
        country: input.address.country,
        phone: input.address.phone ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        defaultForChannel: input.defaultForChannel,
        hoursOfOperation: input.hoursOfOperation ?? [],
        isActive: input.isActive,
      },
    });
    await releaseChannelsOnTx(tx, ctx, warehouse.id, input.defaultForChannel);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.warehouse.created',
      entityType: 'Warehouse',
      entityId: warehouse.id,
      diff: { after: serializeWarehouse(warehouse) as unknown as Record<string, unknown> },
    });

    return warehouse;
  });

  await indexInventoryEntity(ctx, 'warehouse', result.id);

  return { id: result.id };
}

export async function updateWarehouse(
  ctx: ServiceContext,
  warehouseId: string,
  rawInput: unknown
): Promise<WarehouseRow> {
  const input = UpdateWarehouseInput.parse(rawInput);

  const result = await withTenant(ctx, async (tx) => {
    const before = await tx.warehouse.findFirst({
      where: { id: warehouseId, deletedAt: null },
    });
    if (!before) throw new InventoryNotFoundError('Warehouse', warehouseId);

    if (input.code !== undefined && input.code !== before.code) {
      const collision = await tx.warehouse.findFirst({
        where: { code: input.code, deletedAt: null, NOT: { id: warehouseId } },
        select: { id: true },
      });
      if (collision) {
        throw new InventoryConflictError(
          `Warehouse code "${input.code}" is already in use`,
          'code'
        );
      }
    }

    const updated = await tx.warehouse.update({
      where: { id: warehouseId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.address
          ? {
              line1: input.address.line1,
              line2: input.address.line2 ?? null,
              city: input.address.city,
              region: input.address.region ?? null,
              postalCode: input.address.postalCode ?? null,
              country: input.address.country,
              phone: input.address.phone ?? null,
            }
          : {}),
        ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
        ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
        ...(input.defaultForChannel !== undefined
          ? { defaultForChannel: input.defaultForChannel }
          : {}),
        ...(input.hoursOfOperation !== undefined
          ? { hoursOfOperation: input.hoursOfOperation }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    await releaseChannelsOnTx(tx, ctx, updated.id, input.defaultForChannel ?? []);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.warehouse.updated',
      entityType: 'Warehouse',
      entityId: updated.id,
      diff: {
        before: serializeWarehouse(before) as unknown as Record<string, unknown>,
        after: serializeWarehouse(updated) as unknown as Record<string, unknown>,
      },
    });

    return { updated, shipsFrom: await storefrontShipFromIdOnTx(tx) };
  });

  await indexInventoryEntity(ctx, 'warehouse', warehouseId);

  return serializeWarehouse(result.updated, undefined, result.updated.id === result.shipsFrom);
}

export async function archiveWarehouse(ctx: ServiceContext, warehouseId: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const before = await tx.warehouse.findFirst({
      where: { id: warehouseId, deletedAt: null },
    });
    if (!before) throw new InventoryNotFoundError('Warehouse', warehouseId);
    if (before.isSystem) {
      throw new InventoryValidationError('The in-transit location is managed by the platform');
    }

    const activeStock = await tx.inventoryLevel.findFirst({
      where: { warehouseId, onHand: { gt: 0 } },
      select: { variantId: true, onHand: true },
    });
    if (activeStock) {
      throw new InventoryValidationError(
        'Cannot archive a warehouse that still holds stock: transfer or zero out levels first'
      );
    }

    await tx.warehouse.update({
      where: { id: warehouseId },
      data: { deletedAt: new Date(), isActive: false },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.warehouse.archived',
      entityType: 'Warehouse',
      entityId: warehouseId,
      diff: { before: serializeWarehouse(before) as unknown as Record<string, unknown> },
    });
  });

  await indexInventoryEntity(ctx, 'warehouse', warehouseId, 'delete');
}

// ─── Activation default (docs/104 L2) ─────────────────────────────────
//
// On `module.activated(inventory)` — and when inventory rides free with
// Commerce/B2B — a tenant needs at least one stock-holding location, or stock
// has nowhere to live and the allocator has nothing to resolve to. Find-or-
// create by "any non-system operating warehouse exists" (NOT by a fixed code):
// a tenant that renamed/replaced the default keeps their own, and only a tenant
// with zero locations gets `MAIN` seeded. Idempotent + kept on deactivate
// (docs/104 R1–R4). `tenantId` is scoped explicitly (not just RLS) because the
// local superuser bypasses RLS — a tenant-wide scan would otherwise see other
// tenants' warehouses and wrongly skip seeding (the reorder-engine precedent).
export async function bootstrapDefaultWarehouse(
  ctx: ServiceContext
): Promise<{ id: string; created: boolean }> {
  const result = await withTenant(ctx, async (tx) => {
    const existing = await tx.warehouse.findFirst({
      where: { tenantId: ctx.tenantId, isSystem: false, deletedAt: null },
      select: { id: true },
    });
    if (existing) return { id: existing.id, created: false };

    // Seed the ship-from from the business's registered/trading address
    // (tenant_businesses — the same block invoices/POs use), so a tenant that
    // filled in Business details during onboarding gets LIVE carrier rates out
    // of the box. Without this the Main Warehouse was created address-less, and
    // resolveShipFromAddress then threw "incomplete", which tryLiveRates
    // swallows — so every new physical-goods tenant silently got manual rates
    // only until they hand-filled the warehouse (see docs/bugs/BUG-010). A
    // partial/absent business address just seeds what exists; the merchant-facing
    // "ship-from incomplete" prompt covers the rest.
    const business = await tx.tenantBusiness.findUnique({
      where: { tenantId: ctx.tenantId },
      select: {
        addressLine1: true,
        addressLine2: true,
        city: true,
        region: true,
        postalCode: true,
        country: true,
        phone: true,
      },
    });

    const warehouse = await tx.warehouse.create({
      data: {
        tenantId: ctx.tenantId,
        name: 'Main Warehouse',
        code: 'MAIN',
        type: 'owned',
        line1: business?.addressLine1 ?? null,
        line2: business?.addressLine2 ?? null,
        city: business?.city ?? null,
        region: business?.region ?? null,
        postalCode: business?.postalCode ?? null,
        // Fall back to US only when the business gave no country, preserving the
        // prior default while honoring an explicitly-set one.
        country: business?.country ?? 'US',
        phone: business?.phone ?? null,
        defaultForChannel: ['storefront'],
      },
      select: { id: true },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'system',
      action: 'inventory.warehouse.bootstrapped',
      entityType: 'Warehouse',
      entityId: warehouse.id,
      diff: { after: { code: 'MAIN', name: 'Main Warehouse' } },
    });
    return { id: warehouse.id, created: true };
  });

  // Index best-effort — a search hiccup must never fail module activation.
  if (result.created) {
    try {
      await indexInventoryEntity(ctx, 'warehouse', result.id);
    } catch {
      // The warehouse is created; it indexes on the next update / reindex pass.
    }
  }
  return result;
}

export function serializeWarehouse(
  w: Warehouse,
  counts?: { onHand: number; binCount: number },
  shipsOnline?: boolean
): WarehouseRow {
  return {
    onHand: counts?.onHand ?? null,
    binCount: counts?.binCount ?? null,
    shipsOnline: shipsOnline ?? null,
    id: w.id,
    name: w.name,
    code: w.code,
    type: w.type,
    line1: w.line1,
    line2: w.line2,
    city: w.city,
    region: w.region,
    postalCode: w.postalCode,
    country: w.country,
    phone: w.phone,
    latitude: w.latitude,
    longitude: w.longitude,
    defaultForChannel: Array.isArray(w.defaultForChannel) ? (w.defaultForChannel as string[]) : [],
    isActive: w.isActive,
    isSample: isSampleRow(w.metadata),
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}
