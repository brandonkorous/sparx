// Warehouse CRUD. A warehouse is any stock-holding location — owned, 3PL,
// dropship-virtual, or in-transit. Archival is blocked while stock remains.

import { CreateWarehouseInput, UpdateWarehouseInput } from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import type { Warehouse } from '@sparx/db';

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
  createdAt: string;
  updatedAt: string;
}

export async function listWarehouses(
  ctx: ServiceContext,
  filter: { includeInactive?: boolean; take?: number; skip?: number } = {}
): Promise<{ items: WarehouseRow[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const where = {
      deletedAt: null,
      ...(filter.includeInactive ? {} : { isActive: true }),
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
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}
