// Scheduling analytics (docs/79 §12). A single read that powers the dashboard
// Reports view — booking volume + outcome mix, no-show rate, completed revenue,
// upcoming load, how full the diary runs (utilisation), when the diary is
// busiest, and the busiest services over a date range. Pure aggregation in JS
// over tenant-scoped queries (modest booking volumes; revisit with SQL rollups
// if a tenant's range ever spans tens of thousands).
//
// Every figure is SITE-SCOPED (docs/131 §3.7 "site IS the business"): a report
// must never merge two businesses that share a billing account. Absence of a
// scope means "unscoped" (single-site tenants, or an explicit cross-site read).
//
// Two scoping mechanisms, because two different things are being measured:
//   • Booking-outcome metrics (totals, revenue, no-show, busiest, top services)
//     scope on the denormalized `Booking.propertyId` — active site OR unscoped
//     (`propertyId IS NULL`), because a single-site tenant's bookings are all
//     null-property (docs/49 `defaultPropertyIdsToActiveSite` no-ops at 1 site).
//   • Utilisation scopes on the RESOURCE set, because availability windows carry
//     no propertyId — they hang off a resource, which maps to sites only via the
//     SchedulingResourceProperty join. Numerator and denominator therefore share
//     one resource set (or both fall back tenant-wide), so the ratio is honest.

import { withTenant, type TxClient } from '@wizeworks/db';

import {
  buildResourceOverrides,
  resourceFreeIntervals,
  type ResourceAvailability,
  type ResourceOverride,
} from './availability';
import { tzOffsetMs, type Interval } from './time';

const TERMINAL = ['cancelled', 'no_show', 'completed'];
const MINUTE_MS = 60 * 1000;
// Statuses that didn't consume the diary — a cancellation or no-show freed the
// slot, so neither is booked time.
const NOT_BOOKED = ['cancelled', 'no_show'];

export interface SchedulingReportTotals {
  all: number;
  requested: number;
  confirmed: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

export interface TopService {
  serviceId: string;
  name: string;
  count: number;
}

/** How full the diary ran over the window: booked minutes ÷ available minutes. */
export interface Utilisation {
  /** Integer 0–100, capped at 100 (over-booked past nominal hours still reads full). */
  pct: number;
  /** Σ(endAt−startAt) of bookings that consumed the diary in the window. */
  bookedMinutes: number;
  /** Open availability-window minutes over the window, minus closures. */
  availableMinutes: number;
}

/** One weekday bucket, Monday-first (weekday 0 = Mon … 6 = Sun). */
export interface WeekdayBucket {
  weekday: number;
  count: number;
}

/** One hour-of-day bucket (hour 0–23, business-local wall clock). */
export interface HourBucket {
  hour: number;
  count: number;
}

export interface SchedulingReport {
  from: string;
  to: string;
  totals: SchedulingReportTotals;
  /** no_show / (completed + no_show), as a 0–100 percentage (0 when no finished bookings). */
  noShowRatePct: number;
  /** Sum of the service price of completed bookings in the range (cents). */
  revenueCents: number;
  /** Future, non-terminal bookings (load on the books right now). */
  upcomingCount: number;
  /** How full the diary ran, or `null` when no availability windows are configured
   *  (no capacity to divide by — the UI asks the owner to set their hours). */
  utilisation: Utilisation | null;
  /** Bookings by weekday, Monday-first — always 7 buckets, zeros included. */
  byWeekday: WeekdayBucket[];
  /** Bookings by hour of day — always 24 buckets, zeros included. */
  byHour: HourBucket[];
  topServices: TopService[];
}

export interface SchedulingReportQuery {
  from: string;
  to: string;
  /** The sites this report is confined to (docs/131 §3.7). Undefined = unscoped
   *  (single-site tenants, or an explicit cross-site read). */
  propertyIds?: string[];
}

/** Booking-outcome scope fragment: active site OR unscoped (null-property). An
 *  `AND` wrapper, NOT a second top-level `OR` key — the booking query already has
 *  an `OR` (start-in-range OR cancelled-in-range) and a sibling `OR` would collide.
 *  The `propertyId: null` branch is REQUIRED: single-site tenants stamp no
 *  property, so `IN [primaryId]` alone would hide their entire report. */
function bookingScope(propertyIds?: string[]) {
  return propertyIds
    ? { AND: [{ OR: [{ propertyId: { in: propertyIds } }, { propertyId: null }] }] }
    : {};
}

/**
 * How full the diary ran over [fromUtc, toUtc) for the site's resources.
 *
 * Availability windows have no propertyId, so the site scope is resolved to a
 * RESOURCE set via the SchedulingResourceProperty join, and BOTH sides of the
 * ratio use it:
 *   • denominator — each resource's weekly windows expanded across the range (via
 *     the availability engine's `resourceFreeIntervals`, so the recurrence maths
 *     is not re-derived), minus one-off `closed`/`blackout` closures. Existing
 *     bookings are deliberately NOT subtracted; they are the numerator.
 *   • numerator — bookings in range that touch one of those resources, minus
 *     cancellations/no-shows (a freed slot isn't booked time).
 * When the join yields no resources for the site (single-site tenants have no
 * link rows), BOTH sides fall back tenant-wide — never a scoped numerator over a
 * tenant-wide denominator.
 *
 * Returns `null` when there are no resources or no availability windows at all
 * (utilisation is unknowable, not zero), or when capacity works out to zero.
 */
async function computeUtilisation(
  tx: TxClient,
  fromUtc: number,
  toUtc: number,
  propertyIds?: string[]
): Promise<Utilisation | null> {
  // The site's resource set, or null for tenant-wide. A scoped set with no link
  // rows (single-site tenant) collapses to null → tenant-wide for both sides.
  let resourceIds: string[] | null = null;
  if (propertyIds) {
    const links = await tx.schedulingResourceProperty.findMany({
      where: { propertyId: { in: propertyIds } },
      select: { resourceId: true },
    });
    const ids = [...new Set(links.map((l) => l.resourceId))];
    if (ids.length > 0) resourceIds = ids;
  }

  const resources = await tx.schedulingResource.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      ...(resourceIds ? { id: { in: resourceIds } } : {}),
    },
    select: { id: true, timezone: true },
  });
  if (resources.length === 0) return null;
  const scopedIds = resources.map((r) => r.id);

  const [windows, exceptions, customHours, bookedBookings] = await Promise.all([
    tx.availabilityWindow.findMany({
      where: { resourceId: { in: scopedIds } },
      select: {
        resourceId: true,
        dayOfWeek: true,
        startMinute: true,
        endMinute: true,
        validFrom: true,
        validTo: true,
      },
    }),
    // Closures / blackouts carve capacity OUT of the denominator.
    tx.availabilityException.findMany({
      where: {
        kind: { in: ['closed', 'blackout'] },
        startAt: { lt: new Date(toUtc) },
        endAt: { gt: new Date(fromUtc) },
        OR: [{ resourceId: { in: scopedIds } }, { resourceId: null }],
      },
      select: { resourceId: true, startAt: true, endAt: true },
    }),
    // Custom-hours REPLACE weekly hours for the days they cover, so capacity
    // reflects what is actually bookable (the follow-up that motivated all this).
    tx.availabilityException.findMany({
      where: {
        kind: 'custom_hours',
        startAt: { lt: new Date(toUtc) },
        endAt: { gt: new Date(fromUtc) },
        OR: [{ resourceId: { in: scopedIds } }, { resourceId: null }],
      },
      select: { resourceId: true, startAt: true, endAt: true, meta: true },
    }),
    // Booked minutes over the SAME resource set: bookings in range that allocate
    // one of these resources, excluding cancellations/no-shows. Booking-level
    // minutes (docs/79 §12), matched to the resource-summed denominator below.
    tx.booking.findMany({
      where: {
        deletedAt: null,
        status: { notIn: NOT_BOOKED },
        startAt: { gte: new Date(fromUtc), lt: new Date(toUtc) },
        resources: { some: { resourceId: { in: scopedIds } } },
      },
      select: { startAt: true, endAt: true },
    }),
  ]);

  // No hours configured anywhere → utilisation is unknowable, not zero.
  if (windows.length === 0) return null;

  const windowsByResource = new Map<string, ResourceAvailability['windows']>();
  for (const w of windows) {
    const list = windowsByResource.get(w.resourceId) ?? [];
    list.push({
      dayOfWeek: w.dayOfWeek,
      startMinute: w.startMinute,
      endMinute: w.endMinute,
      validFrom: w.validFrom ? w.validFrom.getTime() : null,
      validTo: w.validTo ? w.validTo.getTime() : null,
    });
    windowsByResource.set(w.resourceId, list);
  }

  const tenantWideClosures: Interval[] = [];
  const closuresByResource = new Map<string, Interval[]>();
  for (const e of exceptions) {
    const iv: Interval = { start: e.startAt.getTime(), end: e.endAt.getTime() };
    if (e.resourceId === null) {
      tenantWideClosures.push(iv);
    } else {
      const list = closuresByResource.get(e.resourceId) ?? [];
      list.push(iv);
      closuresByResource.set(e.resourceId, list);
    }
  }

  // Custom-hours overrides, split the same way: a null-resource one is business-
  // wide (applies to every scoped resource), a resource-scoped one to just that
  // resource. Malformed meta is dropped by buildResourceOverrides.
  const tenantWideOverrides = buildResourceOverrides(
    customHours.filter((e) => e.resourceId === null)
  );
  const overridesByResource = new Map<string, ResourceOverride[]>();
  for (const e of customHours) {
    if (e.resourceId === null) continue;
    const list = overridesByResource.get(e.resourceId) ?? [];
    list.push(...buildResourceOverrides([e]));
    overridesByResource.set(e.resourceId, list);
  }

  let availableMs = 0;
  for (const res of resources) {
    const resWindows = windowsByResource.get(res.id);
    if (!resWindows || resWindows.length === 0) continue;
    const busy = [...tenantWideClosures, ...(closuresByResource.get(res.id) ?? [])];
    const overrides = [...tenantWideOverrides, ...(overridesByResource.get(res.id) ?? [])];
    const free = resourceFreeIntervals(
      { resourceId: res.id, timezone: res.timezone, windows: resWindows, busy, overrides },
      fromUtc,
      toUtc
    );
    for (const iv of free) availableMs += iv.end - iv.start;
  }

  const availableMinutes = Math.round(availableMs / MINUTE_MS);
  if (availableMinutes <= 0) return null;

  let bookedMs = 0;
  for (const b of bookedBookings) {
    bookedMs += Math.max(0, b.endAt.getTime() - b.startAt.getTime());
  }
  const bookedMinutes = Math.round(bookedMs / MINUTE_MS);

  return {
    pct: Math.min(100, Math.round((bookedMinutes / availableMinutes) * 100)),
    bookedMinutes,
    availableMinutes,
  };
}

export async function getSchedulingReport(
  tenantId: string,
  query: SchedulingReportQuery,
  nowUtc: number
): Promise<SchedulingReport> {
  return withTenant({ tenantId }, async (tx) => {
    const fromDate = new Date(query.from);
    const toDate = new Date(query.to);
    const fromUtc = fromDate.getTime();
    const toUtc = toDate.getTime();
    const inRange = { gte: fromDate, lt: toDate };
    const scope = bookingScope(query.propertyIds);

    const rows = await tx.booking.findMany({
      where: {
        deletedAt: null,
        ...scope,
        // A cancelled booking's startAt is often a future appointment slot that
        // will now never happen — the event actually worth reporting is the
        // cancellation itself, so that bucket keys off cancelledAt instead.
        OR: [{ startAt: inRange }, { status: 'cancelled', cancelledAt: inRange }],
      },
      select: {
        status: true,
        serviceId: true,
        startAt: true,
        timezone: true,
        service: { select: { name: true, priceCents: true } },
      },
    });

    const totals: SchedulingReportTotals = {
      all: rows.length,
      requested: 0,
      confirmed: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      noShow: 0,
    };
    let revenueCents = 0;
    // Monday-first (0=Mon … 6=Sun) and hour-of-day (0–23) histograms, in the
    // booking's own wall-clock time — "busiest" is a local-time question.
    const weekday = new Array<number>(7).fill(0);
    const hour = new Array<number>(24).fill(0);
    const byService = new Map<string, TopService>();

    for (const b of rows) {
      if (b.status === 'requested') totals.requested += 1;
      else if (b.status === 'confirmed') totals.confirmed += 1;
      else if (b.status === 'in_progress') totals.inProgress += 1;
      else if (b.status === 'completed') totals.completed += 1;
      else if (b.status === 'cancelled') totals.cancelled += 1;
      else if (b.status === 'no_show') totals.noShow += 1;

      if (b.status === 'completed') revenueCents += b.service?.priceCents ?? 0;

      // Busiest-times histograms: every booking that was going to happen, keyed
      // off when it starts. A cancelled slot never happened, so it is excluded;
      // its row is here only because it was cancelled in-range (start elsewhere).
      const startMs = b.startAt.getTime();
      if (b.status !== 'cancelled' && startMs >= fromUtc && startMs < toUtc) {
        const local = new Date(startMs + tzOffsetMs(startMs, b.timezone));
        // JS getUTCDay: 0=Sun … 6=Sat → Monday-first index. Both indices are
        // in-bounds by construction; the `!` satisfies noUncheckedIndexedAccess.
        const weekdayIndex = (local.getUTCDay() + 6) % 7;
        const hourIndex = local.getUTCHours();
        weekday[weekdayIndex]! += 1;
        hour[hourIndex]! += 1;
      }

      const entry = byService.get(b.serviceId) ?? {
        serviceId: b.serviceId,
        name: b.service?.name ?? 'Service',
        count: 0,
      };
      entry.count += 1;
      byService.set(b.serviceId, entry);
    }

    const finished = totals.completed + totals.noShow;
    const noShowRatePct = finished > 0 ? Math.round((totals.noShow / finished) * 100) : 0;

    const utilisation = await computeUtilisation(tx, fromUtc, toUtc, query.propertyIds);

    const upcomingCount = await tx.booking.count({
      where: {
        deletedAt: null,
        ...scope,
        startAt: { gt: new Date(nowUtc) },
        status: { notIn: TERMINAL },
      },
    });

    const topServices = [...byService.values()].sort((a, b) => b.count - a.count).slice(0, 8);

    return {
      from: query.from,
      to: query.to,
      totals,
      noShowRatePct,
      revenueCents,
      upcomingCount,
      utilisation,
      byWeekday: weekday.map((count, weekdayIndex) => ({ weekday: weekdayIndex, count })),
      byHour: hour.map((count, hourIndex) => ({ hour: hourIndex, count })),
      topServices,
    };
  });
}
