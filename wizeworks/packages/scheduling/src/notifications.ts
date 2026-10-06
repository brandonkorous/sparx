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

/**
 * Where a notice ended up. ONE status per outcome, because each has a different
 * fix and a count of "failed" has to mean something went wrong (sparx persona
 * issue 086, where a text the shop never switched on was recorded as `failed`):
 *
 *   pending     not due yet
 *   sent        handed to the email or text provider
 *   failed      a real attempt that did not go: the provider refused it, the
 *               email had no template, the business hit its daily text limit
 *   cancelled   called off because the booking moved or ended
 *   not_set_up  texting is not switched on for the business
 *   opted_out   this number replied STOP, or never agreed to be texted
 *   no_address  nothing on the record to reach them at: no number we can text,
 *               or no email or phone left on the customer
 *
 * Only `failed` is a failure. Nothing retries any of them: a notice is sent at
 * most once, and the dispatch tick only ever picks up `pending`.
 */
export type BookingNoticeStatus =
  'pending' | 'sent' | 'failed' | 'cancelled' | 'not_set_up' | 'opted_out' | 'no_address';

/** The ledger status for a guarded text send's outcome (`SmsOutcome` in
 *  @wizeworks/sms). Taken as a string so this package needs no SMS dependency. */
export function smsNoticeStatus(outcome: string): BookingNoticeStatus {
  switch (outcome) {
    case 'sent':
      return 'sent';
    case 'disabled':
      return 'not_set_up';
    case 'suppressed':
    case 'no_consent':
      return 'opted_out';
    case 'invalid':
      return 'no_address';
    default:
      return 'failed';
  }
}

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

/** Whether the business has switched texting on. No settings row is "never set
 *  up", which is off: texting ships switched off. */
async function textingOn(tx: TxClient, tenantId: string): Promise<boolean> {
  const settings = await tx.smsSettings.findUnique({
    where: { tenantId },
    select: { enabled: true },
  });
  return settings?.enabled === true;
}

/** Which channels can reach this booking's customer right now: email when an
 *  address is on file, SMS when a phone is AND the business has texting switched
 *  on. A booking with no customer, or no contact details, schedules nothing.
 *
 *  The texting switch is asked here, not only at send time (sparx persona issue
 *  086): a text queued for a shop that never turned texting on is a promise on
 *  the booking's history that nothing will keep, and the send side then had to
 *  record it as something. If the shop switches texting off AFTER a text was
 *  queued, the send side records `not_set_up` for it. */
async function reachableChannels(
  tx: TxClient,
  tenantId: string,
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
  if (customer.phone && (await textingOn(tx, tenantId))) channels.push('sms');
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
  const channels = await reachableChannels(tx, tenantId, booking.customerId);
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
  const channels = await reachableChannels(tx, tenantId, booking.customerId);
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
  const channels = await reachableChannels(tx, tenantId, booking.customerId);
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
