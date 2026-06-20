// Service setup CRUD — what can be booked. resourceRequirements + settings are
// JSONB; soft-delete keeps historical bookings' service reference valid.

import type { Prisma } from '@sparx/db';
import { withTenant, type SchedulingService } from '@sparx/db';
import type { CreateServiceInput, UpdateServiceInput } from '@sparx/scheduling-schemas';

import { ServiceNotFoundError } from './errors';

export async function createService(
  tenantId: string,
  input: CreateServiceInput
): Promise<SchedulingService> {
  return withTenant({ tenantId }, (tx) =>
    tx.schedulingService.create({
      data: {
        tenantId,
        bookingType: input.bookingType,
        name: input.name,
        description: input.description ?? null,
        durationMinutes: input.durationMinutes,
        bufferBeforeMin: input.bufferBeforeMin,
        bufferAfterMin: input.bufferAfterMin,
        priceCents: input.priceCents,
        currency: input.currency,
        capacity: input.capacity,
        assignmentStrategy: input.assignmentStrategy,
        resourceRequirements: input.resourceRequirements,
        policyId: input.policyId ?? null,
        intakeFormId: input.intakeFormId ?? null,
        locationId: input.locationId ?? null,
        minLeadMinutes: input.minLeadMinutes,
        maxAdvanceDays: input.maxAdvanceDays,
        slotIntervalMin: input.slotIntervalMin,
        color: input.color ?? null,
        imageUrl: input.imageUrl ?? null,
        bookableOnline: input.bookableOnline,
        requiresApproval: input.requiresApproval,
        isActive: input.isActive,
        requiresAsset: input.requiresAsset,
        settings: (input.settings ?? {}) as Prisma.InputJsonValue,
      },
    })
  );
}

export async function updateService(
  tenantId: string,
  input: UpdateServiceInput
): Promise<SchedulingService> {
  const { id, resourceRequirements, settings, ...rest } = input;
  return withTenant({ tenantId }, async (tx) => {
    const existing = await tx.schedulingService.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new ServiceNotFoundError(id);
    return tx.schedulingService.update({
      where: { id },
      data: {
        ...rest,
        ...(resourceRequirements !== undefined
          ? { resourceRequirements: resourceRequirements }
          : {}),
        ...(settings !== undefined ? { settings: settings as Prisma.InputJsonValue } : {}),
      },
    });
  });
}

export async function getService(tenantId: string, id: string): Promise<SchedulingService> {
  return withTenant({ tenantId }, async (tx) => {
    const svc = await tx.schedulingService.findFirst({ where: { id, deletedAt: null } });
    if (!svc) throw new ServiceNotFoundError(id);
    return svc;
  });
}

export async function listServices(
  tenantId: string,
  opts: { bookingType?: string; activeOnly?: boolean } = {}
): Promise<SchedulingService[]> {
  return withTenant({ tenantId }, (tx) =>
    tx.schedulingService.findMany({
      where: {
        deletedAt: null,
        ...(opts.bookingType ? { bookingType: opts.bookingType } : {}),
        ...(opts.activeOnly ? { isActive: true } : {}),
      },
      orderBy: { name: 'asc' },
    })
  );
}

export async function deleteService(tenantId: string, id: string): Promise<void> {
  await withTenant({ tenantId }, async (tx) => {
    const existing = await tx.schedulingService.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new ServiceNotFoundError(id);
    await tx.schedulingService.update({ where: { id }, data: { deletedAt: new Date() } });
  });
}
