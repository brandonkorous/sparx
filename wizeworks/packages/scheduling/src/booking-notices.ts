// What has reached this booking's customer, and what still will.
//
// The notification ledger (`scheduling_booking_notifications`, docs/79 §10) is
// written inside the booking lifecycle transaction and drained by api-rest's
// dispatch tick. It has always been the complete record of every confirmation,
// change, cancellation and reminder — and nothing has ever shown it to the person
// who owns the business, so a booking that will remind nobody looked exactly like
// one that will. This is the read side.
//
// It states rather than judges: a row that says `pending` at a time in the future
// IS a message that has not gone yet, and NO rows is the honest answer "nothing
// will reach them", not a blank.

import { withTenant } from '@wizeworks/db';

/** One entry in a booking's notification ledger, flattened for a caller. */
export interface BookingNotice {
  id: string;
  /** confirmation | reminder | change | cancellation | followup | waitlist_offer */
  type: string;
  /** email | sms | push */
  channel: string;
  /** pending | sent | failed | cancelled */
  status: string;
  /** When it is (or was) due to go out. */
  scheduledFor: string;
  /** When the dispatch tick actually handed it over; null while pending. */
  sentAt: string | null;
}

/** Every notice ever scheduled for one booking, oldest due first. */
export async function getBookingNotices(
  tenantId: string,
  bookingId: string
): Promise<BookingNotice[]> {
  return withTenant({ tenantId }, async (tx) => {
    const rows = await tx.bookingNotification.findMany({
      where: { bookingId },
      orderBy: { scheduledFor: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      channel: row.channel,
      status: row.status,
      scheduledFor: row.scheduledFor.toISOString(),
      sentAt: row.sentAt?.toISOString() ?? null,
    }));
  });
}
