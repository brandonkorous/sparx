// Booking history (docs/79) — the per-booking audit trail. Every lifecycle
// transition (created / confirmed / rescheduled / cancelled / checked-in /
// completed / no-show) is appended to the generic `audit_logs` table with
// entityType='Booking', so the dashboard can render a real timeline — including
// what a RESCHEDULE moved (old → new time), which the booking row itself no
// longer remembers once `startAt`/`endAt` are overwritten.
//
// Writes are BEST-EFFORT and run in their OWN transaction: an audit failure must
// never roll back the booking change it describes (mirrors the MCP audit writer
// + api-rest's writeAudit). The reschedule diff is captured by the caller inside
// the lifecycle transaction, where the prior time is still known.

import type { Prisma } from '@wizeworks/db';
import { withTenant, type TxClient } from '@wizeworks/db';

export type BookingAuditAction =
  | 'booking.created'
  | 'booking.updated'
  | 'booking.confirmed'
  | 'booking.rescheduled'
  | 'booking.cancelled'
  | 'booking.checked_in'
  | 'booking.completed'
  | 'booking.no_show'
  | typeof BOOKING_PAYMENT_SETTLED
  | typeof BOOKING_PAYMENT_NOT_SETTLED;

/**
 * What happened to the card when the booking ended (sparx persona issue 087).
 * Written by the gateway half (`bookingPayments` in @wizeworks/commerce), which
 * cannot import this package, so the two names are pinned against its copies by
 * a test in api-rest, the one place that carries both.
 *
 * The deposit status alone cannot say it. A fee the card refused leaves the
 * deposit `held`, which is where the money really is, and the console printed
 * "$40.00 is held on their card" over a hold that might have lapsed and a fee
 * nobody collected.
 */
export const BOOKING_PAYMENT_SETTLED = 'booking.payment_settled';
export const BOOKING_PAYMENT_NOT_SETTLED = 'booking.payment_not_settled';

export interface BookingTimelineEntry {
  id: string;
  action: string;
  actorId: string | null;
  actorType: string | null;
  diff: Record<string, unknown> | null;
  createdAt: string;
}

const BOOKING_ENTITY = 'Booking';

/** Append a booking lifecycle event to the audit trail. Never throws — a failed
 *  history write is logged and swallowed so it can't fail the booking action. */
export async function recordBookingEvent(
  tenantId: string,
  bookingId: string,
  action: BookingAuditAction,
  actorId?: string,
  diff?: Record<string, unknown>
): Promise<void> {
  try {
    await withTenant({ tenantId, userId: actorId }, (tx) =>
      tx.auditLog.create({
        data: {
          tenantId,
          actorId: actorId ?? null,
          actorType: actorId ? 'user' : 'system',
          action,
          entityType: BOOKING_ENTITY,
          entityId: bookingId,
          ...(diff ? { diff: diff as Prisma.InputJsonValue } : {}),
        },
      })
    );
  } catch (err) {
    console.error('[scheduling] booking history write failed', err);
  }
}

/** The last word on a booking's card, read off its history. `done` is whether
 *  the gateway did what was asked; `reason` is its words when it did not. */
export interface BookingPaymentRecord {
  done: boolean;
  /** capture_fee | release_hold | call_off | refund_deposit | keep_deposit */
  move: string;
  /** no_show | cancel | complete */
  ending: string;
  amountCents: number;
  currency: string;
  reason: string | null;
  at: string;
}

/** The latest settlement of one booking's card, or null when it has none (not
 *  ended yet, nothing to settle, or ended before settlements were written). */
export async function latestBookingPayment(
  tx: TxClient,
  bookingId: string
): Promise<BookingPaymentRecord | null> {
  const row = await tx.auditLog.findFirst({
    where: {
      entityType: BOOKING_ENTITY,
      entityId: bookingId,
      action: { in: [BOOKING_PAYMENT_SETTLED, BOOKING_PAYMENT_NOT_SETTLED] },
    },
    orderBy: { createdAt: 'desc' },
    select: { action: true, diff: true, createdAt: true },
  });
  if (!row) return null;
  const diff = (row.diff ?? {}) as Record<string, unknown>;
  const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
  const move = text(diff.move);
  const ending = text(diff.ending);
  const currency = text(diff.currency);
  const amountCents = typeof diff.amountCents === 'number' ? diff.amountCents : null;
  // A record missing what it is about is not one: better none than a guess.
  if (!move || !ending || !currency || amountCents == null) return null;
  return {
    done: row.action === BOOKING_PAYMENT_SETTLED,
    move,
    ending,
    amountCents,
    currency,
    reason: text(diff.reason),
    at: row.createdAt.toISOString(),
  };
}

/** Per-customer booking reliability — the "is this a problematic client?" signal.
 *  Computed on read from the bookings table (index-backed by [tenantId, customerId]),
 *  not denormalized: it's shown on a single customer's surfaces, so a grouped count
 *  is cheaper than maintaining counters through a worker. Covers row-owned bookings
 *  (appointment/reservation/rental); class attendance lives on BookingAttendee. */
export interface CustomerBookingStats {
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
  upcoming: number;
  /** No-shows as a % of RESOLVED bookings (completed + no-show + cancelled). */
  noShowRatePct: number;
}

export async function getCustomerBookingStats(
  tenantId: string,
  customerId: string
): Promise<CustomerBookingStats> {
  return withTenant({ tenantId }, async (tx) => {
    const grouped = await tx.booking.groupBy({
      by: ['status'],
      where: { customerId, deletedAt: null },
      _count: { _all: true },
    });
    const by = new Map(grouped.map((g) => [g.status, g._count._all]));
    const n = (s: string): number => by.get(s) ?? 0;
    const completed = n('completed');
    const cancelled = n('cancelled');
    const noShow = n('no_show');
    const upcoming = n('requested') + n('confirmed') + n('in_progress');
    const total = completed + cancelled + noShow + upcoming + n('waitlisted');
    const resolved = completed + noShow + cancelled;
    const noShowRatePct = resolved > 0 ? Math.round((noShow / resolved) * 100) : 0;
    return { total, completed, cancelled, noShow, upcoming, noShowRatePct };
  });
}

/** The ordered (oldest-first) lifecycle trail for one booking. */
export async function getBookingTimeline(
  tenantId: string,
  bookingId: string
): Promise<BookingTimelineEntry[]> {
  return withTenant({ tenantId }, async (tx) => {
    const rows = await tx.auditLog.findMany({
      where: { entityType: BOOKING_ENTITY, entityId: bookingId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      actorId: r.actorId,
      actorType: r.actorType,
      diff: (r.diff as Record<string, unknown> | null) ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  });
}
