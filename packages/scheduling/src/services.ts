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
        // The site offering this service (docs/131 §4); undefined leaves it
        // tenant-wide. The route resolves the current site and passes it, so a
        // service authored while working in one business belongs to it.
        propertyId: input.propertyId ?? null,
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
  opts: { bookingType?: string; activeOnly?: boolean; propertyId?: string } = {}
): Promise<SchedulingService[]> {
  return withTenant({ tenantId }, (tx) =>
    tx.schedulingService.findMany({
      where: {
        deletedAt: null,
        // The booking widget shows only THIS site's services plus any tenant-wide
        // ones (docs/131 §4). The public storefront always passes its site; staff
        // callers may omit it to see everything. Without this a donut site's
        // widget offered oil changes.
        ...(opts.propertyId ? { OR: [{ propertyId: opts.propertyId }, { propertyId: null }] } : {}),
        ...(opts.bookingType ? { bookingType: opts.bookingType } : {}),
        ...(opts.activeOnly ? { isActive: true } : {}),
      },
      orderBy: { name: 'asc' },
    })
  );
}

// Paginated/searchable variant for the dashboard's Services list page — kept
// separate from `listServices()` above (an MCP tool + the public storefront
// route depend on it returning a bare, unpaginated array) rather than
// changing that function's shape.
export async function listServicesPaged(
  tenantId: string,
  opts: {
    q?: string;
    bookingType?: string;
    activeOnly?: boolean;
    take?: number;
    skip?: number;
  } = {}
): Promise<{ items: SchedulingService[]; total: number }> {
  return withTenant({ tenantId }, async (tx) => {
    const where: Prisma.SchedulingServiceWhereInput = {
      deletedAt: null,
      ...(opts.bookingType ? { bookingType: opts.bookingType } : {}),
      ...(opts.activeOnly ? { isActive: true } : {}),
      ...(opts.q
        ? {
            OR: [
              { name: { contains: opts.q, mode: 'insensitive' } },
              { description: { contains: opts.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      tx.schedulingService.findMany({
        where,
        orderBy: { name: 'asc' },
        take: Math.min(opts.take ?? 50, 250),
        skip: opts.skip ?? 0,
      }),
      tx.schedulingService.count({ where }),
    ]);
    return { items, total };
  });
}

export async function deleteService(tenantId: string, id: string): Promise<void> {
  await withTenant({ tenantId }, async (tx) => {
    const existing = await tx.schedulingService.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new ServiceNotFoundError(id);
    await tx.schedulingService.update({ where: { id }, data: { deletedAt: new Date() } });
  });
}
