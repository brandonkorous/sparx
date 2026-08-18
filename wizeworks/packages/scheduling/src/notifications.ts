// Booking notification ledger (docs/79 §10). The Scheduling module schedules its
// own customer notifications — confirmations, reminders, change + cancellation
// notices — as `BookingNotification` rows (one per type × reachable channel),
// which the api-rest scheduling-notification dispatch tick later sends: email via
// the tenant's Builder-authored tree by key (BOOKING_EMAIL_KEY), SMS via the
// configured provider. The ledger gives dedupe + a dispatch audit trail (the
// "dispute evidence" of §10).
//
// These run INSIDE the booking lifecycle transaction (booking-service.ts), so a
// booking and its scheduled reminders commit atomically: a confirmed booking
// never exists without its reminders, and a cancel never leaves an orphan
// reminder pending. Writing the rows is domain state — the SEND (the external
// effect) is deferred to the dispatch tick, so this is not "inlining a side
// effect in a handler."

import type { TxClient } from '@wizeworks/db';

/** The customer-facing booking notifications the module schedules. Each maps 1:1
 *  to a keyed Builder email (BOOKING_EMAIL_KEY) and an SMS body
 *  (renderBookingSms). The `scheduling_booking_notifications.type` column also
 *  permits `followup` / `waitlist_offer` for later phases. */
export type BookingNotificationType = 'confirmation' | 'reminder' | 'change' | 'cancellation';

export type NotificationChannel = 'email' | 'sms';

/** Notification type → the keyed Builder email tree it renders (docs/91). The
 *  dispatch tick resolves the per-site override → tenant default → code fallback. */
export const BOOKING_EMAIL_KEY: Record<BookingNotificationType, string> = {
  confirmation: 'booking-confirmation',
  reminder: 'booking-reminder',
  change: 'booking-rescheduled',
  cancellation: 'booking-cancelled',
};

const MINUTE_MS = 60_000;

/** The minimum subset of a Booking row the ledger needs. Booking (and the engine's
 *  lifecycle return values) are structurally assignable. */
export interface NotifiableBooking {
  id: string;
  startAt: Date;
  customerId: string | null;
  policyId: string | null;
}

/** Which channels can reach this booking's customer right now: email when an
 *  address is on file, SMS when a phone is. A booking with no customer — or no
 *  contact details — schedules nothing (no one to notify). */
async function reachableChannels(
  tx: TxClient,
  customerId: string | null
): Promise<NotificationChannel[]> {
  if (!customerId) return [];
  const customer = await tx.customer.findUnique({
    where: { id: customerId },
    select: { email: true, phone: true },
  });
  if (!customer) return [];
  const channels: NotificationChannel[] = [];
  if (customer.email) channels.push('email');
  if (customer.phone) channels.push('sms');
  return channels;
}

async function reminderOffsets(tx: TxClient, policyId: string | null): Promise<number[]> {
  if (!policyId) return [];
  const policy = await tx.bookingPolicy.findUnique({
    where: { id: policyId },
    select: { reminderOffsetsMin: true },
  });
  return policy?.reminderOffsetsMin ?? [];
}

/** Insert one pending ledger row per channel for a notification due at
 *  `scheduledFor`. */
async function enqueueRows(
  tx: TxClient,
  tenantId: string,
  bookingId: string,
  type: BookingNotificationType,
  channels: NotificationChannel[],
  scheduledFor: Date
): Promise<void> {
  if (channels.length === 0) return;
  await tx.bookingNotification.createMany({
    data: channels.map((channel) => ({
      tenantId,
      bookingId,
      type,
      channel,
      scheduledFor,
      status: 'pending',
    })),
  });
}

/** Lay down a reminder row per channel at each policy offset before start — but
 *  only for offsets still in the future (a booking made inside the reminder window
 *  skips the already-passed reminders; the confirmation already says "it's soon"). */
async function layReminders(
  tx: TxClient,
  tenantId: string,
  booking: NotifiableBooking,
  channels: NotificationChannel[],
  now: Date
): Promise<void> {
  const offsets = await reminderOffsets(tx, booking.policyId);
  for (const minutes of offsets) {
    const when = new Date(booking.startAt.getTime() - minutes * MINUTE_MS);
    if (when.getTime() <= now.getTime()) continue;
    await enqueueRows(tx, tenantId, booking.id, 'reminder', channels, when);
  }
}

/** Cancel still-pending notifications of the given types for a booking (drop
 *  future reminders/changes when it's cancelled, rescheduled, or completed). */
async function cancelPending(
  tx: TxClient,
  bookingId: string,
  types: BookingNotificationType[]
): Promise<void> {
  await tx.bookingNotification.updateMany({
    where: { bookingId, type: { in: types }, status: 'pending' },
    data: { status: 'cancelled' },
  });
}

export interface ScheduleNotificationsOptions {
  /** Skip the immediate confirmation row (still lays reminders). Used for the 2nd+
   *  occurrence of a recurring series so the customer gets ONE confirmation, not
   *  one per session — each occurrence still gets its own reminders. */
  skipConfirmation?: boolean;
}

/**
 * Schedule a confirmed booking's notifications: an immediate confirmation plus a
 * reminder at each of the policy's `reminderOffsetsMin` before start. Idempotent
 * per booking — the confirmation is written only once, so an auto-confirmed
 * create followed by no further transition won't double-send (and a stray
 * re-trigger is a no-op).
 */
export async function scheduleBookingNotifications(
  tx: TxClient,
  tenantId: string,
  booking: NotifiableBooking,
  now: Date = new Date(),
  opts: ScheduleNotificationsOptions = {}
): Promise<void> {
  const channels = await reachableChannels(tx, booking.customerId);
  if (channels.length === 0) return;

  if (!opts.skipConfirmation) {
    const haveConfirmation = await tx.bookingNotification.count({
      where: { bookingId: booking.id, type: 'confirmation' },
    });
    if (haveConfirmation === 0) {
      await enqueueRows(tx, tenantId, booking.id, 'confirmation', channels, now);
    }
  }
  await layReminders(tx, tenantId, booking, channels, now);
}

/** A reschedule: drop the now-stale pending reminders/changes, send a change
 *  notice now, and lay fresh reminders for the new start time. */
export async function rescheduleBookingNotifications(
  tx: TxClient,
  tenantId: string,
  booking: NotifiableBooking,
  now: Date = new Date()
): Promise<void> {
  await cancelPending(tx, booking.id, ['reminder', 'change']);
  const channels = await reachableChannels(tx, booking.customerId);
  if (channels.length === 0) return;
  await enqueueRows(tx, tenantId, booking.id, 'change', channels, now);
  await layReminders(tx, tenantId, booking, channels, now);
}

/** A cancellation: drop pending reminders/changes + send a cancellation notice now. */
export async function cancelBookingNotifications(
  tx: TxClient,
  tenantId: string,
  booking: NotifiableBooking,
  now: Date = new Date()
): Promise<void> {
  await cancelPending(tx, booking.id, ['reminder', 'change']);
  const channels = await reachableChannels(tx, booking.customerId);
  if (channels.length === 0) return;
  await enqueueRows(tx, tenantId, booking.id, 'cancellation', channels, now);
}

/** A booking reaching a terminal non-cancelled state (completed / no_show): no
 *  more reminders needed, and no customer notice (followups are a later phase). */
export async function dropPendingBookingNotifications(
  tx: TxClient,
  bookingId: string
): Promise<void> {
  await cancelPending(tx, bookingId, ['reminder', 'change']);
}
