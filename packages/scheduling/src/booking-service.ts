// Booking write-path + lifecycle (docs/79 §7.3–§7.5). createBooking resolves the
// required resource roles per the service's assignment strategy, then allocates
// them in a single transaction. The btree_gist no-overlap EXCLUDE constraint on
// booking_resources (migration §7.4) is the AUTHORITATIVE guard: even if two
// requests race past the in-app free check, the second INSERT fails and we
// translate it into a clean SlotUnavailableError instead of a 500.

import type { Prisma } from '@sparx/db';
import { withTenant, type Booking, type TxClient } from '@sparx/db';
import type {
  CancelBookingInput,
  CheckInInput,
  CreateBookingInput,
  NoShowBookingInput,
  RescheduleBookingInput,
  UpdateBookingInput,
} from '@sparx/scheduling-schemas';

import {
  BookingNotFoundError,
  InvalidBookingStateError,
  isExclusionViolation,
  NoEligibleResourceError,
  ServiceNotFoundError,
  SlotUnavailableError,
} from './errors';
import {
  cancelBookingNotifications,
  dropPendingBookingNotifications,
  rescheduleBookingNotifications,
  scheduleBookingNotifications,
} from './notifications';
import type { Interval } from './time';

const MINUTE_MS = 60 * 1000;
const RELEASED = ['cancelled', 'no_show'] as const;

interface ResourceRequirement {
  role: string;
  kind: string;
  skillTags?: string[];
  count?: number;
}

interface AllocationPick {
  resourceId: string;
  role: string;
  exclusive: boolean;
}

/** Resource ids with a LIVE allocation overlapping `span` (so they're taken). */
async function busyResourceIds(
  tx: TxClient,
  candidateIds: string[],
  span: Interval
): Promise<Set<string>> {
  if (candidateIds.length === 0) return new Set();
  const [allocations, busyBlocks, closures] = await Promise.all([
    tx.bookingResource.findMany({
      where: {
        resourceId: { in: candidateIds },
        status: { notIn: [...RELEASED] },
        startAt: { lt: new Date(span.end) },
        endAt: { gt: new Date(span.start) },
      },
      select: { resourceId: true },
    }),
    tx.externalBusyBlock.findMany({
      where: {
        resourceId: { in: candidateIds },
        startAt: { lt: new Date(span.end) },
        endAt: { gt: new Date(span.start) },
      },
      select: { resourceId: true },
    }),
    tx.availabilityException.findMany({
      where: {
        kind: { in: ['closed', 'blackout'] },
        startAt: { lt: new Date(span.end) },
        endAt: { gt: new Date(span.start) },
        OR: [{ resourceId: { in: candidateIds } }, { resourceId: null }],
      },
      select: { resourceId: true },
    }),
  ]);
  const taken = new Set<string>();
  for (const a of allocations) taken.add(a.resourceId);
  for (const b of busyBlocks) taken.add(b.resourceId);
  // A tenant/location-wide closure (resourceId null) blocks every candidate.
  if (closures.some((c) => c.resourceId === null)) return new Set(candidateIds);
  for (const c of closures) if (c.resourceId) taken.add(c.resourceId);
  return taken;
}

/** Pick `count` free resources for one role per the assignment strategy. */
async function pickForRole(
  tx: TxClient,
  req: ResourceRequirement,
  span: Interval,
  opts: { explicitIds: string[]; locationId?: string; partySize?: number; strategy: string }
): Promise<AllocationPick[]> {
  const count = req.count ?? 1;
  const candidates = await tx.schedulingResource.findMany({
    where: {
      kind: req.kind,
      isActive: true,
      deletedAt: null,
      ...(req.skillTags?.length ? { skillTags: { hasEvery: req.skillTags } } : {}),
      ...(opts.locationId ? { locationId: opts.locationId } : {}),
      ...(opts.explicitIds.length ? { id: { in: opts.explicitIds } } : { bookableOnline: true }),
      ...(opts.partySize
        ? {
            AND: [
              { OR: [{ capacityMin: null }, { capacityMin: { lte: opts.partySize } }] },
              { OR: [{ capacityMax: null }, { capacityMax: { gte: opts.partySize } }] },
            ],
          }
        : {}),
    },
    select: { id: true, exclusive: true },
  });
  if (candidates.length === 0) throw new NoEligibleResourceError(req.role);

  const taken = await busyResourceIds(
    tx,
    candidates.map((c) => c.id),
    span
  );
  let free = candidates.filter((c) => !taken.has(c.id));

  if (opts.strategy === 'round_robin' && free.length > 1) {
    // Balance load: prefer the resource with the fewest live future allocations.
    const loads = await tx.bookingResource.groupBy({
      by: ['resourceId'],
      where: { resourceId: { in: free.map((f) => f.id) }, status: { notIn: [...RELEASED] } },
      _count: { resourceId: true },
    });
    const loadBy = new Map(loads.map((l) => [l.resourceId, l._count.resourceId]));
    free = [...free].sort((a, b) => (loadBy.get(a.id) ?? 0) - (loadBy.get(b.id) ?? 0));
  }

  if (free.length < count) throw new SlotUnavailableError();
  return free
    .slice(0, count)
    .map((r) => ({ resourceId: r.id, role: req.role, exclusive: r.exclusive }));
}

export interface CreatedBooking {
  booking: Booking;
  resourceIds: string[];
}

/** Series-aware create options. `seriesId` links the booking to its recurring
 *  series; `skipConfirmation` suppresses the immediate confirmation (the series
 *  sends one confirmation across all occurrences) while still laying reminders. */
export interface CreateBookingOptions {
  seriesId?: string;
  skipConfirmation?: boolean;
}

export async function createBooking(
  tenantId: string,
  input: CreateBookingInput,
  createdByUserId?: string,
  opts: CreateBookingOptions = {}
): Promise<CreatedBooking> {
  return withTenant({ tenantId }, async (tx) => {
    const service = await tx.schedulingService.findFirst({
      where: { id: input.serviceId, deletedAt: null },
    });
    if (!service) throw new ServiceNotFoundError(input.serviceId);

    const startAt = new Date(input.startAt);
    const endAt = new Date(startAt.getTime() + service.durationMinutes * MINUTE_MS);
    const span: Interval = {
      start: startAt.getTime() - service.bufferBeforeMin * MINUTE_MS,
      end: endAt.getTime() + service.bufferAfterMin * MINUTE_MS,
    };

    const requirements = (service.resourceRequirements as unknown as ResourceRequirement[]) ?? [];
    const roleSpecs: ResourceRequirement[] =
      requirements.length > 0 ? requirements : [{ role: 'staff', kind: 'staff' }];
    const locationId = input.locationId ?? service.locationId ?? undefined;

    const picks: AllocationPick[] = [];
    for (const req of roleSpecs) {
      const rolePicks = await pickForRole(tx, req, span, {
        explicitIds: input.resourceIds,
        locationId,
        partySize: input.partySize,
        strategy: service.assignmentStrategy,
      });
      picks.push(...rolePicks);
    }

    const status = service.requiresApproval ? 'requested' : 'confirmed';

    let booking: Booking;
    try {
      booking = await tx.booking.create({
        data: {
          tenantId,
          serviceId: service.id,
          bookingType: service.bookingType,
          seriesId: opts.seriesId ?? null,
          status,
          startAt,
          endAt,
          timezone: input.timezone ?? 'UTC',
          capacity: service.capacity,
          partySize: input.partySize ?? null,
          customerId: input.customerId ?? null,
          b2bAccountId: input.b2bAccountId ?? null,
          assetRef: (input.assetRef ?? undefined) as Prisma.InputJsonValue | undefined,
          partsLinked: input.partsLinked,
          workOrderId: input.workOrderId ?? null,
          policyId: service.policyId ?? null,
          intakeSubmissionId: input.intakeSubmissionId ?? null,
          notes: input.notes ?? null,
          source: input.source,
          createdByUserId: createdByUserId ?? null,
          resources: {
            create: picks.map((p) => ({
              tenantId,
              resourceId: p.resourceId,
              role: p.role,
              startAt: new Date(span.start),
              endAt: new Date(span.end),
              exclusive: p.exclusive,
              status,
            })),
          },
          attendees: {
            create: buildAttendees(tenantId, input),
          },
        },
      });
    } catch (err) {
      if (isExclusionViolation(err)) throw new SlotUnavailableError();
      throw err;
    }
    // Auto-confirmed bookings (no approval gate) notify immediately + schedule
    // reminders; a `requested` booking waits for confirmBooking to notify.
    if (status === 'confirmed') {
      await scheduleBookingNotifications(tx, tenantId, booking, new Date(), {
        skipConfirmation: opts.skipConfirmation,
      });
    }
    return { booking, resourceIds: picks.map((p) => p.resourceId) };
  });
}

function buildAttendees(
  tenantId: string,
  input: CreateBookingInput
): {
  tenantId: string;
  customerId: string | null;
  guestName: string | null;
  partySize: number;
  intakeSubmissionId: string | null;
}[] {
  if (input.attendees.length > 0) {
    return input.attendees.map((a) => ({
      tenantId,
      customerId: a.customerId ?? null,
      guestName: a.guestName ?? null,
      partySize: a.partySize,
      intakeSubmissionId: a.intakeSubmissionId ?? null,
    }));
  }
  // 1:1 appointment / reservation — one attendee from the booking's customer.
  if (input.customerId) {
    return [
      {
        tenantId,
        customerId: input.customerId,
        guestName: null,
        partySize: input.partySize ?? 1,
        intakeSubmissionId: input.intakeSubmissionId ?? null,
      },
    ];
  }
  return [];
}

async function loadBooking(tx: TxClient, id: string): Promise<Booking> {
  const booking = await tx.booking.findFirst({ where: { id, deletedAt: null } });
  if (!booking) throw new BookingNotFoundError(id);
  return booking;
}

/** Sync the booking's allocations to a terminal/active status so the partial
 *  EXCLUDE index releases (cancelled / no_show) or keeps holding the slot. */
async function setAllocationStatus(tx: TxClient, bookingId: string, status: string): Promise<void> {
  await tx.bookingResource.updateMany({ where: { bookingId }, data: { status } });
}

export async function confirmBooking(
  tenantId: string,
  id: string,
  userId?: string
): Promise<Booking> {
  return withTenant({ tenantId }, async (tx) => {
    const booking = await loadBooking(tx, id);
    if (booking.status !== 'requested') {
      throw new InvalidBookingStateError(`Cannot confirm a booking that is ${booking.status}`);
    }
    await setAllocationStatus(tx, id, 'confirmed');
    const confirmed = await tx.booking.update({
      where: { id },
      data: { status: 'confirmed', confirmedAt: new Date(), confirmedByUserId: userId ?? null },
    });
    await scheduleBookingNotifications(tx, tenantId, confirmed);
    return confirmed;
  });
}

export async function cancelBooking(tenantId: string, input: CancelBookingInput): Promise<Booking> {
  return withTenant({ tenantId }, async (tx) => {
    const booking = await loadBooking(tx, input.id);
    if (['cancelled', 'completed', 'no_show'].includes(booking.status)) {
      throw new InvalidBookingStateError(`Cannot cancel a booking that is ${booking.status}`);
    }
    // Release the resources so the slot frees immediately (partial EXCLUDE drops them).
    await setAllocationStatus(tx, input.id, 'cancelled');
    const cancelled = await tx.booking.update({
      where: { id: input.id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: input.reason ?? null,
      },
    });
    await cancelBookingNotifications(tx, tenantId, cancelled);
    return cancelled;
  });
}

/** Staff-side edits that don't move the booking in time (notes, parts, asset,
 *  location). Time changes go through rescheduleBooking so the EXCLUDE re-checks. */
export async function updateBooking(tenantId: string, input: UpdateBookingInput): Promise<Booking> {
  const { id, assetRef, partsLinked, ...rest } = input;
  return withTenant({ tenantId }, async (tx) => {
    await loadBooking(tx, id);
    return tx.booking.update({
      where: { id },
      data: {
        ...rest,
        ...(assetRef !== undefined
          ? { assetRef: (assetRef ?? undefined) as Prisma.InputJsonValue | undefined }
          : {}),
        ...(partsLinked !== undefined ? { partsLinked } : {}),
      },
    });
  });
}

export async function rescheduleBooking(
  tenantId: string,
  input: RescheduleBookingInput
): Promise<Booking> {
  return withTenant({ tenantId }, async (tx) => {
    const booking = await loadBooking(tx, input.id);
    if (['cancelled', 'completed', 'no_show'].includes(booking.status)) {
      throw new InvalidBookingStateError(`Cannot reschedule a booking that is ${booking.status}`);
    }
    const service = await tx.schedulingService.findFirst({ where: { id: booking.serviceId } });
    if (!service) throw new ServiceNotFoundError(booking.serviceId);

    const startAt = new Date(input.startAt);
    const endAt = new Date(startAt.getTime() + service.durationMinutes * MINUTE_MS);
    const span: Interval = {
      start: startAt.getTime() - service.bufferBeforeMin * MINUTE_MS,
      end: endAt.getTime() + service.bufferAfterMin * MINUTE_MS,
    };

    const existing = await tx.bookingResource.findMany({ where: { bookingId: input.id } });
    // Keep the same resources unless the caller re-picks; the EXCLUDE guards the move.
    const keepResourceIds = input.resourceIds.length
      ? input.resourceIds
      : existing.map((e) => e.resourceId);

    try {
      // Drop old allocations, recreate at the new span (one transaction).
      await tx.bookingResource.deleteMany({ where: { bookingId: input.id } });
      await tx.bookingResource.createMany({
        data: keepResourceIds.map((resourceId, i) => ({
          tenantId,
          bookingId: input.id,
          resourceId,
          role: existing[i]?.role ?? 'staff',
          startAt: new Date(span.start),
          endAt: new Date(span.end),
          exclusive: existing[i]?.exclusive ?? true,
          status: booking.status,
        })),
      });
      const moved = await tx.booking.update({
        where: { id: input.id },
        data: { startAt, endAt },
      });
      await rescheduleBookingNotifications(tx, tenantId, moved);
      return moved;
    } catch (err) {
      if (isExclusionViolation(err)) throw new SlotUnavailableError();
      throw err;
    }
  });
}

export async function checkInBooking(tenantId: string, input: CheckInInput): Promise<Booking> {
  return withTenant({ tenantId }, async (tx) => {
    const booking = await loadBooking(tx, input.bookingId);
    if (!['confirmed', 'requested', 'in_progress'].includes(booking.status)) {
      throw new InvalidBookingStateError(`Cannot check in a booking that is ${booking.status}`);
    }
    if (input.attendeeId) {
      await tx.bookingAttendee.update({
        where: { id: input.attendeeId },
        data: { status: 'checked_in' },
      });
    }
    return tx.booking.update({
      where: { id: input.bookingId },
      data: { status: 'in_progress', checkedInAt: booking.checkedInAt ?? new Date() },
    });
  });
}

export async function completeBooking(tenantId: string, id: string): Promise<Booking> {
  return withTenant({ tenantId }, async (tx) => {
    const booking = await loadBooking(tx, id);
    if (['cancelled', 'no_show'].includes(booking.status)) {
      throw new InvalidBookingStateError(`Cannot complete a booking that is ${booking.status}`);
    }
    await setAllocationStatus(tx, id, 'completed');
    await dropPendingBookingNotifications(tx, id);
    return tx.booking.update({
      where: { id },
      data: { status: 'completed', completedAt: new Date() },
    });
  });
}

export async function noShowBooking(tenantId: string, input: NoShowBookingInput): Promise<Booking> {
  return withTenant({ tenantId }, async (tx) => {
    const booking = await loadBooking(tx, input.id);
    if (['cancelled', 'completed'].includes(booking.status)) {
      throw new InvalidBookingStateError(
        `Cannot mark no-show on a booking that is ${booking.status}`
      );
    }
    await setAllocationStatus(tx, input.id, 'no_show');
    await dropPendingBookingNotifications(tx, input.id);
    return tx.booking.update({
      where: { id: input.id },
      data: { status: 'no_show', noShowAt: new Date() },
    });
  });
}
