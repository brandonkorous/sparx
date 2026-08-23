// What a CUSTOMER sees of her own booking, and what she is allowed to do to it.
//
// There are two doors onto this: the signed-in account portal
// (public/scheduling-account.ts) and the signed-link page a guest reaches from
// her confirmation (public/scheduling-manage.ts). They are ONE set of rules,
// stated here once.
//
// Two doors with their own copies of the rules is exactly how issue 149 happened
// — the website honoured the salon's lunch break and the console did not, on the
// same day, for the same person. So the projection, the cancel and the
// reschedule all live in this file, and a route's only job is to establish who
// is asking.

import type { FastifyBaseLogger } from 'fastify';

import {
  cancelBooking,
  customerFacingPlace,
  findBookingPlace,
  getBooking,
  rescheduleBooking,
  type BookingWithRelations,
} from '@wizeworks/scheduling';

import { bookingCalendarLinks } from './scheduling-ical.js';
import { publishBookingEvent } from './scheduling-events.js';
import { settleBookingPayment } from './scheduling-payments.js';

/** Where the request came from, for the audit trail: the signed-in portal or a
 *  signed link out of an email. */
export type CustomerBookingSource = 'portal' | 'manage-link';

/** Only these can still be moved or called off; anything else is history. */
const MODIFIABLE = ['requested', 'confirmed'];

/** What the record says when a customer called a booking off herself and gave no
 *  reason. It is a placeholder for the absence of one, not a reason — right in
 *  the owner's diary, and nothing to show the person who pressed the button, who
 *  would read "Reason: cancelled by customer" as being told what she just did. */
const NO_REASON_GIVEN = 'Cancelled by customer';

/**
 * A customer-facing projection of a booking — only their-eyes copy (no staff
 * notes). `canCancel`/`canReschedule` drive the buttons; the engine still
 * enforces the real state machine and slot availability on write.
 */
export async function toCustomerBookingDto(
  b: BookingWithRelations,
  now: number,
  tenantId: string
): Promise<Record<string, unknown>> {
  const future = b.startAt.getTime() > now;
  const modifiable = MODIFIABLE.includes(b.status) && future;
  // The same place the confirmation, the email and the `.ics` name (issue 107) —
  // a booking re-added to a calendar from the portal must not be missing the
  // address the one added from the confirmation carried.
  const place = await findBookingPlace(tenantId, {
    locationId: b.locationId,
    serviceId: b.serviceId,
  });
  return {
    id: b.id,
    serviceName: b.service.name,
    bookingType: b.bookingType,
    status: b.status,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    timezone: b.timezone,
    durationMinutes: b.service.durationMinutes,
    partySize: b.partySize,
    staff: b.resources.filter((r) => r.resource.kind === 'staff').map((r) => r.resource.name),
    notes: b.notes,
    cancellationReason: b.cancellationReason === NO_REASON_GIVEN ? null : b.cancellationReason,
    serviceId: b.service.id,
    canCancel: modifiable,
    canReschedule: modifiable,
    // "Add to calendar" — only meaningful for a live (non-cancelled) booking.
    calendar:
      b.status === 'cancelled' || b.status === 'no_show'
        ? null
        : bookingCalendarLinks(tenantId, b.id, {
            summary: b.service.name,
            start: b.startAt,
            end: b.endAt,
            ...(place ? { location: place.line } : {}),
          }),
    where: customerFacingPlace(place),
  };
}

/**
 * Call a booking off on the customer's own behalf. The policy fee is NOT waived
 * — a late cancel captures it from the hold and an on-time one releases it, and
 * `settleBookingPayment` is what decides, so nobody can waive a fee for
 * themselves by clicking their own link.
 */
export async function cancelForCustomer(
  log: FastifyBaseLogger,
  tenantId: string,
  bookingId: string,
  customerId: string | null,
  source: CustomerBookingSource,
  reason?: string
): Promise<Record<string, unknown>> {
  const updated = await cancelBooking(tenantId, {
    id: bookingId,
    reason: reason ?? NO_REASON_GIVEN,
    waiveFee: false,
    notifyCustomer: true,
  });
  await settleBookingPayment(log, tenantId, bookingId, 'cancel');
  await publishBookingEvent('booking.cancelled', tenantId, null, {
    bookingId,
    customerId,
    source,
  });
  return toCustomerBookingDto(await getBooking(tenantId, updated.id), Date.now(), tenantId);
}

/**
 * Move a booking to a new time, keeping the same people and equipment on it.
 * `resourceIds: []` means "whoever has it now, at the new time" — the engine
 * re-checks working hours, closures and clashes and refuses in her own words
 * (issues 149, 150), so a customer gets the same answer the owner would.
 */
export async function rescheduleForCustomer(
  tenantId: string,
  bookingId: string,
  customerId: string | null,
  startAt: string,
  source: CustomerBookingSource
): Promise<Record<string, unknown>> {
  const updated = await rescheduleBooking(tenantId, {
    id: bookingId,
    startAt,
    resourceIds: [],
    notifyCustomer: true,
  });
  await publishBookingEvent('booking.rescheduled', tenantId, null, {
    bookingId,
    customerId,
    startAt,
    source,
  });
  return toCustomerBookingDto(await getBooking(tenantId, updated.id), Date.now(), tenantId);
}
