// Availability setup — recurring weekly windows (replace-all per resource) and
// one-off exceptions (time off / custom hours / blackout / special pricing).

import type { Prisma } from '@sparx/db';
import { withTenant, type AvailabilityException, type AvailabilityWindow } from '@sparx/db';
import type {
  AvailabilityExceptionInput,
  SetAvailabilityWindowsInput,
} from '@sparx/scheduling-schemas';

/** Replace a resource's entire weekly schedule in one transaction (the editor
 *  saves the whole week at once). */
export async function setAvailabilityWindows(
  tenantId: string,
  input: SetAvailabilityWindowsInput
): Promise<AvailabilityWindow[]> {
  return withTenant({ tenantId }, async (tx) => {
    await tx.availabilityWindow.deleteMany({ where: { resourceId: input.resourceId } });
    if (input.windows.length > 0) {
      await tx.availabilityWindow.createMany({
        data: input.windows.map((w) => ({
          tenantId,
          resourceId: input.resourceId,
          dayOfWeek: w.dayOfWeek,
          startMinute: w.startMinute,
          endMinute: w.endMinute,
          validFrom: w.validFrom ? new Date(w.validFrom) : null,
          validTo: w.validTo ? new Date(w.validTo) : null,
        })),
      });
    }
    return tx.availabilityWindow.findMany({
      where: { resourceId: input.resourceId },
      orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
    });
  });
}

export async function listAvailabilityWindows(
  tenantId: string,
  resourceId: string
): Promise<AvailabilityWindow[]> {
  return withTenant({ tenantId }, (tx) =>
    tx.availabilityWindow.findMany({
      where: { resourceId },
      orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
    })
  );
}

export async function createAvailabilityException(
  tenantId: string,
  input: AvailabilityExceptionInput
): Promise<AvailabilityException> {
  return withTenant({ tenantId }, (tx) =>
    tx.availabilityException.create({
      data: {
        tenantId,
        resourceId: input.resourceId ?? null,
        locationId: input.locationId ?? null,
        kind: input.kind,
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
        reason: input.reason ?? null,
        meta: (input.meta ?? {}) as Prisma.InputJsonValue,
      },
    })
  );
}

export async function listAvailabilityExceptions(
  tenantId: string,
  opts: { resourceId?: string; from?: string; to?: string } = {}
): Promise<AvailabilityException[]> {
  return withTenant({ tenantId }, (tx) =>
    tx.availabilityException.findMany({
      where: {
        ...(opts.resourceId ? { OR: [{ resourceId: opts.resourceId }, { resourceId: null }] } : {}),
        ...(opts.from ? { endAt: { gt: new Date(opts.from) } } : {}),
        ...(opts.to ? { startAt: { lt: new Date(opts.to) } } : {}),
      },
      orderBy: { startAt: 'asc' },
    })
  );
}

export async function deleteAvailabilityException(tenantId: string, id: string): Promise<void> {
  await withTenant({ tenantId }, (tx) => tx.availabilityException.deleteMany({ where: { id } }));
}
