// Booking read-path (docs/79 §7) — the staff-facing queries the dashboard,
// REST list/detail endpoints, and MCP read-tools share. Writes live in
// booking-service.ts; this file only reads, always under tenant RLS.

import { withTenant, type TxClient } from '@sparx/db';

import { BookingNotFoundError } from './errors';

// Shape the relations once so list + detail return the same nested data.
const bookingInclude = {
  service: {
    select: {
      id: true,
      name: true,
      bookingType: true,
      durationMinutes: true,
      priceCents: true,
      currency: true,
      color: true,
    },
  },
  resources: {
    select: {
      id: true,
      role: true,
      startAt: true,
      endAt: true,
      status: true,
      resource: { select: { id: true, name: true, kind: true, color: true } },
    },
  },
  attendees: {
    select: {
      id: true,
      customerId: true,
      guestName: true,
      partySize: true,
      status: true,
      waitlistPosition: true,
    },
  },
} as const;

export type BookingWithRelations = Awaited<ReturnType<typeof getBooking>>;

export async function getBooking(tenantId: string, id: string) {
  return withTenant({ tenantId }, async (tx) => {
    const booking = await tx.booking.findFirst({
      where: { id, deletedAt: null },
      include: bookingInclude,
    });
    if (!booking) throw new BookingNotFoundError(id);
    return booking;
  });
}

export interface ListBookingsOptions {
  /** Free-text search — notes, staff notes, and guest name (there's no
   *  denormalized customer name on Booking; a linked-account customer's name
   *  isn't searchable here without a Customer join). */
  q?: string;
  status?: string;
  /** Any of these statuses (takes precedence over `status`). */
  statusIn?: string[];
  bookingType?: string;
  serviceId?: string;
  resourceId?: string;
  customerId?: string;
  b2bAccountId?: string;
  locationId?: string;
  /** The member's reachable sites (docs/131 §3.3); undefined = unrestricted. A
   *  booking's `propertyId` is denormalized from its service and SetNull on site
   *  delete, so null = ORPHANED (not shared): a restricted member sees only
   *  their granted sites' bookings, never orphaned ones. */
  propertyIds?: string[];
  /** ISO instant — only bookings whose start is at/after this. */
  from?: string;
  /** ISO instant — only bookings whose start is before this. */
  to?: string;
  take?: number;
  skip?: number;
  order?: 'asc' | 'desc';
}

function buildWhere(opts: ListBookingsOptions): Record<string, unknown> {
  const startAt: Record<string, Date> = {};
  if (opts.from) startAt.gte = new Date(opts.from);
  if (opts.to) startAt.lt = new Date(opts.to);
  return {
    deletedAt: null,
    ...(opts.propertyIds ? { propertyId: { in: opts.propertyIds } } : {}),
    ...(opts.statusIn?.length
      ? { status: { in: opts.statusIn } }
      : opts.status
        ? { status: opts.status }
        : {}),
    ...(opts.bookingType ? { bookingType: opts.bookingType } : {}),
    ...(opts.serviceId ? { serviceId: opts.serviceId } : {}),
    ...(opts.customerId ? { customerId: opts.customerId } : {}),
    ...(opts.b2bAccountId ? { b2bAccountId: opts.b2bAccountId } : {}),
    ...(opts.locationId ? { locationId: opts.locationId } : {}),
    ...(opts.resourceId ? { resources: { some: { resourceId: opts.resourceId } } } : {}),
    ...(Object.keys(startAt).length ? { startAt } : {}),
    ...(opts.q
      ? {
          OR: [
            { notes: { contains: opts.q, mode: 'insensitive' } },
            { staffNotes: { contains: opts.q, mode: 'insensitive' } },
            { attendees: { some: { guestName: { contains: opts.q, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };
}

export async function listBookings(
  tenantId: string,
  opts: ListBookingsOptions = {}
): Promise<{ rows: BookingWithRelations[]; total: number }> {
  const take = Math.min(Math.max(opts.take ?? 50, 1), 250);
  const skip = Math.max(opts.skip ?? 0, 0);
  const where = buildWhere(opts);
  return withTenant({ tenantId }, async (tx) => {
    const [rows, total] = await Promise.all([
      tx.booking.findMany({
        where,
        include: bookingInclude,
        orderBy: { startAt: opts.order ?? 'desc' },
        take,
        skip,
      }),
      tx.booking.count({ where }),
    ]);
    return { rows, total };
  });
}

export interface CalendarEvent {
  id: string;
  serviceId: string;
  serviceName: string;
  bookingType: string;
  status: string;
  startAt: string;
  endAt: string;
  color: string | null;
  customerId: string | null;
  resourceIds: string[];
  resourceNames: string[];
  partySize: number | null;
}

/** Bookings overlapping a window, flattened for a calendar grid. Excludes
 *  cancelled/no-show so the calendar shows only live commitments. */
export async function getCalendar(
  tenantId: string,
  range: {
    from: string;
    to: string;
    resourceId?: string;
    serviceId?: string;
    includeReleased?: boolean;
  }
): Promise<CalendarEvent[]> {
  const from = new Date(range.from);
  const to = new Date(range.to);
  return withTenant({ tenantId }, async (tx: TxClient) => {
    const bookings = await tx.booking.findMany({
      where: {
        deletedAt: null,
        startAt: { lt: to },
        endAt: { gt: from },
        ...(range.includeReleased ? {} : { status: { notIn: ['cancelled', 'no_show'] } }),
        ...(range.resourceId ? { resources: { some: { resourceId: range.resourceId } } } : {}),
        ...(range.serviceId ? { serviceId: range.serviceId } : {}),
      },
      include: {
        service: { select: { name: true, color: true } },
        resources: { select: { resource: { select: { id: true, name: true, color: true } } } },
      },
      orderBy: { startAt: 'asc' },
    });
    return bookings.map((b) => ({
      id: b.id,
      serviceId: b.serviceId,
      serviceName: b.service.name,
      bookingType: b.bookingType,
      status: b.status,
      startAt: b.startAt.toISOString(),
      endAt: b.endAt.toISOString(),
      color: b.service.color ?? b.resources[0]?.resource.color ?? null,
      customerId: b.customerId,
      resourceIds: b.resources.map((r) => r.resource.id),
      resourceNames: b.resources.map((r) => r.resource.name),
      partySize: b.partySize,
    }));
  });
}
