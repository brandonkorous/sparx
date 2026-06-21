// Class sessions + roster (docs/79 §7.2). A class is one session Booking
// (bookingType 'class', capacity N) that many customers join as BookingAttendee
// rows — the roster. Capacity is enforced here in app logic (the session's resource
// is non-exclusive, so the DB EXCLUDE doesn't gate seats); seats beyond capacity
// are accepted as `waitlisted` and auto-promoted when a booked seat frees.
//
// Sessions themselves are created the normal way — a staff booking, or (for a
// recurring class) a BookingSeries that materializes session bookings. This module
// only adds the seat/roster layer on top.

import { withTenant, type BookingAttendee, type TxClient } from '@sparx/db';
import type { JoinSessionInput, UpdateAttendeeInput } from '@sparx/scheduling-schemas';

import { BookingNotFoundError, InvalidBookingStateError } from './errors';

/** Attendee statuses that consume a seat (a waitlisted/cancelled/no_show one does not). */
const SEAT_CONSUMING = ['booked', 'checked_in', 'attended'];
const TERMINAL = ['cancelled', 'completed', 'no_show'];

export interface ClassSessionSummary {
  bookingId: string;
  serviceId: string;
  serviceName: string | null;
  startAt: Date;
  endAt: Date;
  capacity: number;
  /** Seats taken (sum of booked/checked-in/attended party sizes). */
  booked: number;
  remaining: number;
  waitlisted: number;
  status: string;
}

function seatsTaken(attendees: { status: string; partySize: number }[]): number {
  return attendees
    .filter((a) => SEAT_CONSUMING.includes(a.status))
    .reduce((n, a) => n + a.partySize, 0);
}

export interface ListClassSessionsOptions {
  serviceId?: string;
  from: string;
  to: string;
  /** Only sessions with at least one open seat. */
  openOnly?: boolean;
}

export async function listClassSessions(
  tenantId: string,
  opts: ListClassSessionsOptions
): Promise<ClassSessionSummary[]> {
  return withTenant({ tenantId }, async (tx) => {
    const rows = await tx.booking.findMany({
      where: {
        bookingType: 'class',
        deletedAt: null,
        status: { notIn: ['cancelled'] },
        startAt: { gte: new Date(opts.from), lt: new Date(opts.to) },
        ...(opts.serviceId ? { serviceId: opts.serviceId } : {}),
      },
      orderBy: { startAt: 'asc' },
      select: {
        id: true,
        serviceId: true,
        startAt: true,
        endAt: true,
        capacity: true,
        status: true,
        service: { select: { name: true } },
        attendees: { select: { status: true, partySize: true } },
      },
    });
    const sessions = rows.map((b) => {
      const booked = seatsTaken(b.attendees);
      return {
        bookingId: b.id,
        serviceId: b.serviceId,
        serviceName: b.service?.name ?? null,
        startAt: b.startAt,
        endAt: b.endAt,
        capacity: b.capacity,
        booked,
        remaining: Math.max(0, b.capacity - booked),
        waitlisted: b.attendees.filter((a) => a.status === 'waitlisted').length,
        status: b.status,
      };
    });
    return opts.openOnly ? sessions.filter((s) => s.remaining > 0) : sessions;
  });
}

export interface BookedSeat {
  attendee: BookingAttendee;
  /** True when the session was full and the attendee was waitlisted instead. */
  waitlisted: boolean;
}

/** Add a seat to a class session. Within capacity → `booked`; otherwise enrolled as
 *  `waitlisted` with a queue position. */
export async function bookClassSeat(
  tenantId: string,
  input: JoinSessionInput
): Promise<BookedSeat> {
  return withTenant({ tenantId }, async (tx) => {
    const booking = await tx.booking.findFirst({
      where: { id: input.bookingId, deletedAt: null },
      select: { id: true, bookingType: true, status: true, capacity: true },
    });
    if (!booking) throw new BookingNotFoundError(input.bookingId);
    if (booking.bookingType !== 'class') {
      throw new InvalidBookingStateError('This booking is not a class session');
    }
    if (TERMINAL.includes(booking.status)) {
      throw new InvalidBookingStateError(`This session is ${booking.status}`);
    }

    const attendees = await tx.bookingAttendee.findMany({
      where: { bookingId: input.bookingId },
      select: { status: true, partySize: true },
    });
    const party = input.partySize;
    const willWaitlist = seatsTaken(attendees) + party > booking.capacity;
    const waitlistPosition = willWaitlist
      ? attendees.filter((a) => a.status === 'waitlisted').length + 1
      : null;

    const attendee = await tx.bookingAttendee.create({
      data: {
        tenantId,
        bookingId: input.bookingId,
        customerId: input.customerId ?? null,
        guestName: input.guestName ?? null,
        partySize: party,
        status: willWaitlist ? 'waitlisted' : 'booked',
        waitlistPosition,
        intakeSubmissionId: input.intakeSubmissionId ?? null,
      },
    });
    return { attendee, waitlisted: willWaitlist };
  });
}

export async function listSessionAttendees(
  tenantId: string,
  bookingId: string
): Promise<BookingAttendee[]> {
  return withTenant({ tenantId }, (tx) =>
    tx.bookingAttendee.findMany({ where: { bookingId }, orderBy: { createdAt: 'asc' } })
  );
}

/** Promote the oldest waitlisted attendees into freed seats (called after a seat is
 *  released). Returns the attendees newly promoted to `booked` so the caller can
 *  notify them. */
async function promoteWaitlisted(
  tx: TxClient,
  tenantId: string,
  bookingId: string
): Promise<BookingAttendee[]> {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    select: { capacity: true, status: true },
  });
  if (!booking || TERMINAL.includes(booking.status)) return [];
  const attendees = await tx.bookingAttendee.findMany({
    where: { bookingId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, status: true, partySize: true, waitlistPosition: true },
  });
  let taken = seatsTaken(attendees);
  const promoted: BookingAttendee[] = [];
  for (const a of attendees) {
    if (a.status !== 'waitlisted') continue;
    if (taken + a.partySize > booking.capacity) continue;
    const updated = await tx.bookingAttendee.update({
      where: { id: a.id },
      data: { status: 'booked', waitlistPosition: null },
    });
    promoted.push(updated);
    taken += a.partySize;
  }
  return promoted;
}

export interface AttendeeUpdate {
  attendee: BookingAttendee;
  /** Attendees auto-promoted off the waitlist because this change freed seats. */
  promoted: BookingAttendee[];
}

/** Update an attendee (check in, cancel, no-show, resize). Cancelling/no-showing
 *  frees seats and auto-promotes the waitlist. */
export async function updateAttendee(
  tenantId: string,
  input: UpdateAttendeeInput
): Promise<AttendeeUpdate> {
  return withTenant({ tenantId }, async (tx) => {
    const existing = await tx.bookingAttendee.findUnique({
      where: { id: input.id },
      select: { id: true, bookingId: true, status: true },
    });
    if (!existing) throw new BookingNotFoundError(input.id);
    const attendee = await tx.bookingAttendee.update({
      where: { id: input.id },
      data: {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.partySize !== undefined ? { partySize: input.partySize } : {}),
      },
    });
    // A status change that releases a seat lets the waitlist move up.
    const freed =
      input.status !== undefined &&
      ['cancelled', 'no_show'].includes(input.status) &&
      !['cancelled', 'no_show'].includes(existing.status);
    const promoted = freed ? await promoteWaitlisted(tx, tenantId, existing.bookingId) : [];
    return { attendee, promoted };
  });
}
