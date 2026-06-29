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

import type { Prisma } from '@sparx/db';
import { withTenant } from '@sparx/db';

export type BookingAuditAction =
  | 'booking.created'
  | 'booking.confirmed'
  | 'booking.rescheduled'
  | 'booking.cancelled'
  | 'booking.checked_in'
  | 'booking.completed'
  | 'booking.no_show';

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
