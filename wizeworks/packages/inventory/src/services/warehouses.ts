// Warehouse CRUD. A warehouse is any stock-holding location — owned, 3PL,
// dropship-virtual, or in-transit. Archival is blocked while stock remains.

import { CreateWarehouseInput, UpdateWarehouseInput } from '@wizeworks/commerce-schemas';
import { isSampleRow, withTenant } from '@wizeworks/db';
import type { Prisma, Warehouse } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import {
  InventoryConflictError,
  InventoryNotFoundError,
  InventoryValidationError,
} from '../errors';
import type { ServiceContext } from '../errors';
import { indexInventoryEntity } from '../events';

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
    return { items: rows.map(serializeWarehouse), total };
  });
}

export async function getWarehouse(
  ctx: ServiceContext,
  warehouseId: string
): Promise<WarehouseRow> {
  const row = await withTenant(ctx, (tx) =>
    tx.warehouse.findFirst({ where: { id: warehouseId, deletedAt: null } })
  );
  if (!row) throw new InventoryNotFoundError('Warehouse', warehouseId);
  return serializeWarehouse(row);
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

    return updated;
  });

  await indexInventoryEntity(ctx, 'warehouse', warehouseId);

  return serializeWarehouse(result);
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
        'Cannot archive a warehouse that still holds stock — transfer or zero out levels first'
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

export function serializeWarehouse(w: Warehouse): WarehouseRow {
  return {
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
