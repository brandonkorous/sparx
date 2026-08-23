// Booking read-path (docs/79 §7) — the staff-facing queries the dashboard,
// REST list/detail endpoints, and MCP read-tools share. Writes live in
// booking-service.ts; this file only reads, always under tenant RLS.

import { withTenant, type TxClient } from '@wizeworks/db';

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

/**
 * WHO THE BOOKINGS ARE FOR, named.
 *
 * A second read rather than an `include`, because `Booking.customerId` is a bare
 * column with no Prisma relation on it — deliberately, since a booking is the
 * record of an appointment a real person made and outlives the site and the
 * account (see the schema's note beside it). So the name cannot be joined; it
 * has to be fetched.
 *
 * It was not fetched at all, which is why every staff surface printed the words
 * "A customer" beside a booking whose customer the database can name: a diary
 * block, a list row, a day's roster. One query per page, keyed by id.
 */
async function customersFor(
  tx: TxClient,
  bookings: { customerId: string | null }[]
): Promise<Map<string, BookedCustomer>> {
  const ids = [...new Set(bookings.map((b) => b.customerId).filter((id): id is string => !!id))];
  if (ids.length === 0) return new Map();
  const rows = await tx.customer.findMany({
    where: { id: { in: ids } },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
  });
  return new Map(rows.map((row) => [row.id, row]));
}

/** The part of a customer a booking surface needs to say who is coming. */
export interface BookedCustomer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
}

export type BookingWithRelations = Awaited<ReturnType<typeof getBooking>>;

export async function getBooking(tenantId: string, id: string) {
  return withTenant({ tenantId }, async (tx) => {
    const booking = await tx.booking.findFirst({
      where: { id, deletedAt: null },
      include: bookingInclude,
    });
    if (!booking) throw new BookingNotFoundError(id);
    const customers = await customersFor(tx, [booking]);
    // Null means "nobody is on this booking", which is a walk-in and a real
    // answer. It is never the same thing as "not loaded".
    return { ...booking, customer: customers.get(booking.customerId ?? '') ?? null };
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
  companyId?: string;
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
    ...(opts.companyId ? { companyId: opts.companyId } : {}),
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
    const customers = await customersFor(tx, rows);
    return {
      rows: rows.map((row) => ({
        ...row,
        customer: customers.get(row.customerId ?? '') ?? null,
      })),
      total,
    };
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
  /**
   * Who the booking is for, named — the guest name written on it, else the
   * linked customer's own name, else null for a booking with nobody recorded.
   *
   * Resolved here rather than in each diary, because the fallback ladder is a
   * fact about the data and not about any one grid, and because the id alone was
   * useless: a block could show a service and a chair and never the person.
   */
  customerName: string | null;
  resourceIds: string[];
  resourceNames: string[];
  partySize: number | null;
}

/** The name to print on a diary block: what was written down, then who is
 *  linked, then nothing. Null is a real answer — nobody was recorded — and is
 *  never dressed up as a name. */
function whoFor(
  booking: { attendees: { guestName: string | null }[] },
  customer: BookedCustomer | null
): string | null {
  const written = booking.attendees.find((a) => a.guestName?.trim())?.guestName?.trim();
  if (written) return written;
  if (!customer) return null;
  const full = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  if (full !== '') return full;
  // An empty string is a real answer here and must fall through, so this is not
  // a nullish check: a customer row with a blank name and a blank email names
  // nobody, and the caller's ladder moves on to a count or an admission.
  const email = customer.email?.trim();
  return email !== undefined && email !== '' ? email : null;
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
    /** The active site(s) the diary is scoped to; undefined = every site (an
     *  unrestricted caller who asked for `?property=all`). A diary must not merge
     *  two businesses' bookings — see "site IS the business". A booking's
     *  `propertyId` is denormalized from its service and is only stamped once a
     *  tenant runs MORE than one site, so a single-site tenant's bookings are all
     *  null-property: the filter is "this site OR unscoped" (see below), not a bare
     *  `IN`, so scoping never hides a single-site tenant's whole diary. */
    propertyIds?: string[];
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
        // Active-site OR unscoped: a multi-site tenant's other businesses (their own
        // non-null propertyId) drop out, while single-site / genuinely-shared
        // (null-property) bookings always stay on the diary.
        ...(range.propertyIds
          ? { OR: [{ propertyId: { in: range.propertyIds } }, { propertyId: null }] }
          : {}),
        ...(range.includeReleased ? {} : { status: { notIn: ['cancelled', 'no_show'] } }),
        ...(range.resourceId ? { resources: { some: { resourceId: range.resourceId } } } : {}),
        ...(range.serviceId ? { serviceId: range.serviceId } : {}),
      },
      include: {
        service: { select: { name: true, color: true } },
        resources: { select: { resource: { select: { id: true, name: true, color: true } } } },
        attendees: { select: { guestName: true } },
      },
      orderBy: { startAt: 'asc' },
    });
    const customers = await customersFor(tx, bookings);
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
      customerName: whoFor(b, customers.get(b.customerId ?? '') ?? null),
      resourceIds: b.resources.map((r) => r.resource.id),
      resourceNames: b.resources.map((r) => r.resource.name),
      partySize: b.partySize,
    }));
  });
}
