// Class-seat notifications (docs/79 §7.2). A class session is one booking with many
// attendees, so the per-booking BookingNotification ledger (one confirmation per
// booking) can't address each attendee — instead we send each seat's confirmation
// DIRECTLY at book time (and on waitlist promotion), reusing the tenant's
// booking-confirmation tree. A guest with no email on file is simply skipped.
//
// Per-attendee REMINDERS would need an attendeeId on the ledger (a follow-up); the
// session-level reminder still fires to the session's own customer.

import type { FastifyBaseLogger } from 'fastify';
import { withTenant, type BookingAttendee } from '@sparx/db';

import { sendTenantEmailByKey } from './tenant-email.js';

/** Send a booking confirmation to one class attendee (no-op for a guest without an
 *  account email). Best-effort — never throws. */
export async function sendSeatConfirmation(
  logger: FastifyBaseLogger,
  tenantId: string,
  bookingId: string,
  attendee: Pick<BookingAttendee, 'customerId'>
): Promise<void> {
  if (!attendee.customerId) return;
  const [customer, booking] = await withTenant({ tenantId }, (tx) =>
    Promise.all([
      tx.customer.findUnique({ where: { id: attendee.customerId! }, select: { email: true } }),
      // The booking's site (docs/131 §3.4/§4) — so this confirmation goes out
      // under the business the class belongs to, not the tenant's primary.
      tx.booking.findUnique({ where: { id: bookingId }, select: { propertyId: true } }),
    ])
  );
  if (!customer?.email) return;
  await sendTenantEmailByKey(logger, tenantId, {
    key: 'booking-confirmation',
    to: customer.email,
    propertyId: booking?.propertyId ?? null,
    ref: { customerId: attendee.customerId, bookingId },
    emailType: 'transactional',
    variables: { source: 'scheduling-class' },
  }).catch((err: unknown) => {
    logger.warn({ tenantId, bookingId, err }, 'class: seat confirmation failed');
    return undefined;
  });
}

/** Confirm each attendee promoted off the waitlist into a freed seat. */
export async function notifyPromotedAttendees(
  logger: FastifyBaseLogger,
  tenantId: string,
  bookingId: string,
  promoted: BookingAttendee[]
): Promise<void> {
  for (const attendee of promoted) {
    await sendSeatConfirmation(logger, tenantId, bookingId, attendee);
  }
}
