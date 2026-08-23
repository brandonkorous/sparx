// Service setup CRUD — what can be booked. resourceRequirements + settings are
// JSONB; soft-delete keeps historical bookings' service reference valid.

import type { Prisma } from '@wizeworks/db';
import { withTenant, type SchedulingService } from '@wizeworks/db';
import type { CreateServiceInput, UpdateServiceInput } from '@wizeworks/scheduling-schemas';

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
    /** Include services that have been removed. Off by default; the services list
     *  turns it on so a removal can be undone (issue 145). */
    includeRemoved?: boolean;
    /** The member's reachable sites (docs/131 §3.3); undefined = unrestricted. A
     *  service's null property means tenant-wide (shared), so a restricted member
     *  sees their businesses' services PLUS tenant-wide ones. */
    propertyIds?: string[];
    take?: number;
    skip?: number;
  } = {}
): Promise<{ items: SchedulingService[]; total: number }> {
  return withTenant({ tenantId }, async (tx) => {
    const where: Prisma.SchedulingServiceWhereInput = {
      ...(opts.includeRemoved ? {} : { deletedAt: null }),
      ...(opts.propertyIds
        ? { OR: [{ propertyId: { in: opts.propertyIds } }, { propertyId: null }] }
        : {}),
      ...(opts.bookingType ? { bookingType: opts.bookingType } : {}),
      ...(opts.activeOnly ? { isActive: true } : {}),
      ...(opts.q
        ? {
            // Nested under AND so the text search composes with the site OR
            // above instead of clobbering it (two top-level ORs collide).
            AND: [
              {
                OR: [
                  { name: { contains: opts.q, mode: 'insensitive' } },
                  { description: { contains: opts.q, mode: 'insensitive' } },
                ],
              },
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

/**
 * Put a removed service back.
 *
 * `deleteService` only stamps `deletedAt`, so nothing was ever lost — but every
 * read filtered the row out and no route could reach it, which made a soft
 * delete behave like a hard one (issue 145). Restoring matters more than the
 * usual undo here: rebuilding the service by hand mints a NEW id, and the
 * bookings already taken keep pointing at the old one.
 */
export async function restoreService(tenantId: string, id: string): Promise<SchedulingService> {
  return withTenant({ tenantId }, async (tx) => {
    const existing = await tx.schedulingService.findFirst({ where: { id } });
    if (!existing) throw new ServiceNotFoundError(id);
    return tx.schedulingService.update({ where: { id }, data: { deletedAt: null } });
  });
}

export async function deleteService(tenantId: string, id: string): Promise<void> {
  await withTenant({ tenantId }, async (tx) => {
    const existing = await tx.schedulingService.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new ServiceNotFoundError(id);
    await tx.schedulingService.update({ where: { id }, data: { deletedAt: new Date() } });
  });
}
