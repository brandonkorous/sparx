// Resource setup CRUD (staff / assets / tables / spaces / equipment). Soft-delete
// so historical bookings keep a valid resource reference.

import type { Prisma } from '@sparx/db';
import { withTenant, type SchedulingResource } from '@sparx/db';
import type { CreateResourceInput, UpdateResourceInput } from '@sparx/scheduling-schemas';

import { ResourceNotFoundError } from './errors';

export async function createResource(
  tenantId: string,
  input: CreateResourceInput
): Promise<SchedulingResource> {
  return withTenant({ tenantId }, (tx) =>
    tx.schedulingResource.create({
      data: {
        tenantId,
        kind: input.kind,
        userId: input.userId ?? null,
        locationId: input.locationId ?? null,
        name: input.name,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        color: input.color ?? null,
        timezone: input.timezone,
        exclusive: input.exclusive,
        capacity: input.capacity,
        capacityMin: input.capacityMin ?? null,
        capacityMax: input.capacityMax ?? null,
        skillTags: input.skillTags,
        bookableOnline: input.bookableOnline,
        isActive: input.isActive,
        settings: (input.settings ?? {}) as Prisma.InputJsonValue,
      },
    })
  );
}

export async function updateResource(
  tenantId: string,
  input: UpdateResourceInput
): Promise<SchedulingResource> {
  const { id, settings, ...rest } = input;
  return withTenant({ tenantId }, async (tx) => {
    const existing = await tx.schedulingResource.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new ResourceNotFoundError(id);
    return tx.schedulingResource.update({
      where: { id },
      data: {
        ...rest,
        ...(settings !== undefined ? { settings: settings as Prisma.InputJsonValue } : {}),
      },
    });
  });
}

export async function getResource(tenantId: string, id: string): Promise<SchedulingResource> {
  return withTenant({ tenantId }, async (tx) => {
    const res = await tx.schedulingResource.findFirst({ where: { id, deletedAt: null } });
    if (!res) throw new ResourceNotFoundError(id);
    return res;
  });
}

export async function listResources(
  tenantId: string,
  opts: { kind?: string; locationId?: string; activeOnly?: boolean } = {}
): Promise<SchedulingResource[]> {
  return withTenant({ tenantId }, (tx) =>
    tx.schedulingResource.findMany({
      where: {
        deletedAt: null,
        ...(opts.kind ? { kind: opts.kind } : {}),
        ...(opts.locationId ? { locationId: opts.locationId } : {}),
        ...(opts.activeOnly ? { isActive: true } : {}),
      },
      orderBy: { name: 'asc' },
    })
  );
}

export async function deleteResource(tenantId: string, id: string): Promise<void> {
  await withTenant({ tenantId }, async (tx) => {
    const existing = await tx.schedulingResource.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new ResourceNotFoundError(id);
    await tx.schedulingResource.update({ where: { id }, data: { deletedAt: new Date() } });
  });
}
