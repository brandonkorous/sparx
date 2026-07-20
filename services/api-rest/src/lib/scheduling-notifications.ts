// Scheduling booking-notification dispatch tick (docs/79 §10).
//
// Runs every interval (default 60s) from the api-rest bootstrap. Finds due
// `scheduling_booking_notifications` rows (status='pending', scheduled_for <=
// NOW()) across all tenants via the find_due_booking_notifications(int) SECURITY
// DEFINER function (migration 20260916000000), then sends each on its channel:
//   · email → sendTenantEmailByKey — the tenant's Builder-authored booking tree
//     by key, rendered per-recipient (the SAME path order/shipping confirmations
//     use, so booking email is one authoring system, editable in /builder/email).
//   · sms   → resolveSmsProvider(env).send — Twilio in prod, console in dev.
// and marks the row sent / failed / cancelled.
//
// The rows are SCHEDULED by the Scheduling engine inside the booking lifecycle
// transaction (the ledger gives dedupe + a dispatch audit trail); this tick is the
// SEND side. Mirrors the email-dispatch tick (lib/email-dispatch.ts): singleton
// across pods via a Postgres advisory lock (its own key); the cross-tenant scan
// rides the SECURITY DEFINER function, while per-row work runs under
// withTenant({tenantId}) so every read + the status UPDATE pass tenant_isolation.

import { ADVISORY_LOCKS } from '@sparx/db';
import type { FastifyBaseLogger } from 'fastify';
import { prisma, withTenant } from '@sparx/db';
import {
  BOOKING_EMAIL_KEY,
  renderBookingSms,
  type BookingNotificationType,
} from '@sparx/scheduling';
import { resolveSmsProvider } from '@sparx/sms';

import { env } from '../env.js';
import { resolveActivePropertyName } from './property.js';
import { sendTenantEmailByKey } from './tenant-email.js';

const SCHEDULING_NOTIFICATION_LOCK_KEY = ADVISORY_LOCKS.SCHEDULING_NOTIFICATIONS;
const DEFAULT_INTERVAL_MS = 60_000;

// A booking in one of these states should not fire a stale reminder/change notice
// (a cancellation notice still sends — that IS the message).
const TERMINAL_STATUSES = ['cancelled', 'completed', 'no_show'];
// The dispatchable notification types (== the keys of BOOKING_EMAIL_KEY). A row of
// any other type (a future followup / waitlist_offer) is left for its own handler.
const DISPATCHABLE = new Set<string>(Object.keys(BOOKING_EMAIL_KEY));

interface DueNotification {
  id: string;
  tenant_id: string;
  booking_id: string;
  type: string;
  channel: string;
}

interface Dispatchable {
  type: BookingNotificationType;
  channel: 'email' | 'sms';
  bookingId: string;
  customerId: string | null;
  /** The booking's site (docs/131 §3.4/§4) — sends the reminder under the right
   *  business's sender identity, not the tenant's primary. */
  propertyId: string | null;
  /** Email address or phone number, per channel. */
  recipient: string;
  serviceName: string;
  startAt: Date;
  timezone: string;
}

export interface SchedulingTickResult {
  acquired: boolean;
  processed: number;
  errors: number;
}

/** A wall-clock label in the booking's timezone — the one piece of notification
 *  copy that must read in the customer's local zone. Intl handles DST, no library. */
function whenLabel(d: Date, tz: string): string {
  const fmt = (opts: Intl.DateTimeFormatOptions): string => {
    try {
      return new Intl.DateTimeFormat('en-US', { timeZone: tz || 'UTC', ...opts }).format(d);
    } catch {
      return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...opts }).format(d);
    }
  };
  return `${fmt({ weekday: 'short', month: 'short', day: 'numeric' })} at ${fmt({
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

/** Set a notification's terminal status (failed), RLS-scoped. */
async function markFailed(tenantId: string, id: string): Promise<void> {
  await withTenant({ tenantId }, (tx) =>
    tx.bookingNotification.update({ where: { id }, data: { status: 'failed' } })
  );
}

/**
 * Re-check the row is still pending, validate the booking + recipient, and mark it
 * `sent` OPTIMISTICALLY before the dispatch returns — at-most-once: a crash mid-send
 * loses a single notice rather than double-texting a customer (the safer failure for
 * comms). Returns the descriptor to dispatch, or null when the row was already
 * handled, the booking is gone/terminal, or there's no reachable recipient (those
 * paths mark the row cancelled/failed in-tx).
 */
async function claim(row: DueNotification): Promise<Dispatchable | null> {
  const tenantId = row.tenant_id;
  return withTenant({ tenantId }, async (tx) => {
    const note = await tx.bookingNotification.findUnique({ where: { id: row.id } });
    if (note?.status !== 'pending') return null;

    // An unknown notification type (future followup/waitlist) — leave pending? No:
    // this tick owns the table, so mark failed to avoid a permanent re-scan.
    if (!DISPATCHABLE.has(row.type)) {
      await tx.bookingNotification.update({ where: { id: row.id }, data: { status: 'failed' } });
      return null;
    }

    const booking = await tx.booking.findUnique({
      where: { id: row.booking_id },
      select: {
        startAt: true,
        timezone: true,
        status: true,
        customerId: true,
        propertyId: true,
        service: { select: { name: true } },
      },
    });
    if (!booking) {
      await tx.bookingNotification.update({ where: { id: row.id }, data: { status: 'cancelled' } });
      return null;
    }
    if (
      (row.type === 'reminder' || row.type === 'change') &&
      TERMINAL_STATUSES.includes(booking.status)
    ) {
      await tx.bookingNotification.update({ where: { id: row.id }, data: { status: 'cancelled' } });
      return null;
    }

    const customerId = booking.customerId;
    let recipient = '';
    if (customerId) {
      const c = await tx.customer.findUnique({
        where: { id: customerId },
        select: { email: true, phone: true },
      });
      recipient = (row.channel === 'sms' ? c?.phone : c?.email) ?? '';
    }
    if (!recipient) {
      await tx.bookingNotification.update({ where: { id: row.id }, data: { status: 'failed' } });
      return null;
    }

    await tx.bookingNotification.update({
      where: { id: row.id },
      data: { status: 'sent', sentAt: new Date() },
    });

    return {
      type: row.type as BookingNotificationType,
      channel: row.channel as 'email' | 'sms',
      bookingId: row.booking_id,
      customerId,
      propertyId: booking.propertyId,
      recipient,
      serviceName: booking.service?.name ?? 'your booking',
      startAt: booking.startAt,
      timezone: booking.timezone,
    };
  });
}

/** Send the claimed notification on its channel. Returns whether it was accepted
 *  (false → the caller flips the row back to `failed`). */
async function dispatch(
  tenantId: string,
  d: Dispatchable,
  logger: FastifyBaseLogger
): Promise<boolean> {
  if (d.channel === 'email') {
    const res = await sendTenantEmailByKey(logger, tenantId, {
      key: BOOKING_EMAIL_KEY[d.type],
      to: d.recipient,
      propertyId: d.propertyId,
      ref: { customerId: d.customerId, bookingId: d.bookingId },
      emailType: 'transactional',
      variables: { source: 'scheduling' },
    });
    return res.sent;
  }

  const siteName = await resolveActivePropertyName(tenantId, null);
  const body = renderBookingSms(d.type, {
    serviceName: d.serviceName,
    whenLabel: whenLabel(d.startAt, d.timezone),
    siteName: siteName || 'Your booking',
  });
  const result = await resolveSmsProvider(env).send({ to: d.recipient, body, tenantId });
  if (!result.success) {
    logger.warn(
      { tenantId, bookingId: d.bookingId, type: d.type, error: result.errorMessage },
      'scheduling-notifications: sms send failed'
    );
  }
  return result.success;
}

export async function runBookingNotificationTick(
  logger: FastifyBaseLogger
): Promise<SchedulingTickResult> {
  const lock = await prisma.$queryRaw<{ acquired: boolean }[]>`
    SELECT pg_try_advisory_lock(${SCHEDULING_NOTIFICATION_LOCK_KEY}::int) AS acquired
  `;
  if (!lock[0]?.acquired) {
    logger.debug('scheduling-notifications: lock held by another pod, skipping');
    return { acquired: false, processed: 0, errors: 0 };
  }

  try {
    const due = await prisma.$queryRaw<DueNotification[]>`
      SELECT id, tenant_id, booking_id, type, channel FROM find_due_booking_notifications(100)
    `;
    if (due.length === 0) return { acquired: true, processed: 0, errors: 0 };

    logger.info({ count: due.length }, 'scheduling-notifications: dispatching due notifications');

    let processed = 0;
    let errors = 0;

    for (const row of due) {
      try {
        const claimed = await claim(row);
        if (!claimed) continue;
        const ok = await dispatch(row.tenant_id, claimed, logger);
        if (!ok) await markFailed(row.tenant_id, row.id);
        processed += 1;
      } catch (err) {
        errors += 1;
        logger.error(
          { err, id: row.id },
          'scheduling-notifications: failed to dispatch notification'
        );
        // It was marked `sent` optimistically in claim(); a thrown dispatch means it
        // didn't go out, so flip it to `failed` (best-effort — don't let this throw).
        try {
          await markFailed(row.tenant_id, row.id);
        } catch (markErr) {
          logger.error({ err: markErr, id: row.id }, 'scheduling-notifications: markFailed failed');
        }
      }
    }

    return { acquired: true, processed, errors };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${SCHEDULING_NOTIFICATION_LOCK_KEY}::int)`;
  }
}

export function startBookingNotificationLoop(
  logger: FastifyBaseLogger,
  intervalMs: number = DEFAULT_INTERVAL_MS
): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      await runBookingNotificationTick(logger);
    } catch (err) {
      logger.error({ err }, 'scheduling-notifications: tick threw — will retry next interval');
    }
    if (stopped) return;
    timer = setTimeout(() => void tick(), intervalMs);
  };

  timer = setTimeout(() => void tick(), intervalMs);
  logger.info({ intervalMs }, 'scheduling-notifications: loop started');

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    logger.info('scheduling-notifications: loop stopped');
  };
}
