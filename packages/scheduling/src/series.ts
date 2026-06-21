// Recurring booking series (docs/79 §7.6). A series is an RFC 5545 RRULE + a
// first-occurrence anchor; we MATERIALIZE it into child bookings (each a normal
// Booking with `seriesId` set) rather than store a virtual rule — so every
// occurrence is a real, individually-manageable booking that flows through the
// same allocation + no-overlap guarantee + notification ledger. Unbounded rules
// materialize to a rolling horizon that the api-rest tick extends over time.
//
// Per-occurrence allocation reuses createBooking: a slot that's taken (or lost the
// EXCLUDE race) is SKIPPED, not forced — one conflicting week never fails the
// series. A misconfigured service (no eligible resource at all) fails loudly.

import { withTenant, type Booking, type BookingSeries, type TxClient } from '@sparx/db';
import type { CancelBookingSeriesInput, CreateBookingSeriesInput } from '@sparx/scheduling-schemas';

import { cancelBooking, createBooking } from './booking-service';
import {
  BookingSeriesNotFoundError,
  InvalidRecurrenceError,
  ServiceNotFoundError,
  SlotUnavailableError,
} from './errors';
import { expandRecurrence, parseRRule } from './rrule';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
/** How far ahead we materialize at once; the tick rolls this forward. */
export const SERIES_HORIZON_DAYS = 180;

function defaultHorizon(): number {
  return Date.now() + SERIES_HORIZON_DAYS * DAY_MS;
}

export interface SkippedOccurrence {
  startAt: string;
  reason: string;
}

export interface MaterializeResult {
  created: Booking[];
  skipped: SkippedOccurrence[];
}

export interface CreatedSeries extends MaterializeResult {
  series: BookingSeries;
}

/** A normalized RRULE (no leading `RRULE:`) — stored so re-expansion is stable. */
function normalizeRule(rrule: string): string {
  return rrule.replace(/^RRULE:/i, '').trim();
}

/** The CreateBookingInput for a single occurrence — derived entirely from the
 *  series so the initial create and the rolling tick produce identical bookings. */
function occurrenceInput(
  series: BookingSeries,
  startMs: number
): Parameters<typeof createBooking>[1] {
  return {
    serviceId: series.serviceId,
    startAt: new Date(startMs).toISOString(),
    customerId: series.customerId ?? undefined,
    resourceIds: series.resourceIds,
    partsLinked: [],
    attendees: [],
    source: 'dashboard',
  };
}

interface SeriesContext {
  series: BookingSeries;
  durationMs: number;
  existingStarts: number[];
}

async function loadSeriesContext(tenantId: string, seriesId: string): Promise<SeriesContext> {
  return withTenant({ tenantId }, async (tx) => {
    const series = await tx.bookingSeries.findUnique({ where: { id: seriesId } });
    if (!series) throw new BookingSeriesNotFoundError(seriesId);
    const service = await tx.schedulingService.findFirst({
      where: { id: series.serviceId },
      select: { durationMinutes: true },
    });
    if (!service) throw new ServiceNotFoundError(series.serviceId);
    const existing = await tx.booking.findMany({
      where: { seriesId, deletedAt: null },
      select: { startAt: true },
      orderBy: { startAt: 'asc' },
    });
    return {
      series,
      durationMs: service.durationMinutes * MINUTE_MS,
      existingStarts: existing.map((b) => b.startAt.getTime()),
    };
  });
}

export interface MaterializeOptions {
  /** The DTSTART anchor; defaults to the earliest existing child (for the tick). */
  dtstartMs?: number;
  /** Materialize occurrences starting up to this instant; defaults to +180d. */
  horizonEnd?: number;
  createdByUserId?: string;
}

/** Create any not-yet-materialized occurrences of a series up to the horizon.
 *  Idempotent: occurrences already booked (matched by start instant) are skipped,
 *  so re-running never double-books. */
export async function materializeSeries(
  tenantId: string,
  seriesId: string,
  opts: MaterializeOptions = {}
): Promise<MaterializeResult> {
  const ctx = await loadSeriesContext(tenantId, seriesId);
  if (ctx.series.status !== 'active') return { created: [], skipped: [] };

  const rule = parseRRule(ctx.series.rrule);
  if (!rule) throw new InvalidRecurrenceError(ctx.series.rrule);

  const dtstartMs = opts.dtstartMs ?? ctx.existingStarts[0];
  if (dtstartMs == null) return { created: [], skipped: [] }; // active but no anchor yet

  const horizonEnd = opts.horizonEnd ?? defaultHorizon();
  const occ = expandRecurrence(dtstartMs, ctx.durationMs, rule, dtstartMs, horizonEnd).map(
    (i) => i.start
  );
  const existingSet = new Set(ctx.existingStarts);

  const created: Booking[] = [];
  const skipped: SkippedOccurrence[] = [];
  let confirmationDone = ctx.existingStarts.length > 0;
  for (const start of occ) {
    if (existingSet.has(start)) continue;
    try {
      const r = await createBooking(
        tenantId,
        occurrenceInput(ctx.series, start),
        opts.createdByUserId,
        {
          seriesId,
          skipConfirmation: confirmationDone,
        }
      );
      created.push(r.booking);
      confirmationDone = true;
    } catch (err) {
      if (err instanceof SlotUnavailableError) {
        skipped.push({ startAt: new Date(start).toISOString(), reason: err.message });
        continue;
      }
      throw err; // NoEligibleResource / ServiceNotFound — a config error, fail loudly
    }
  }

  // A bounded rule whose final occurrence is already in the past is finished —
  // mark it completed so the tick stops revisiting it.
  const lastOcc = occ[occ.length - 1];
  const bounded = rule.count != null || rule.until != null;
  const done = bounded && lastOcc != null && lastOcc < Date.now();
  await withTenant({ tenantId }, (tx) =>
    tx.bookingSeries.update({
      where: { id: seriesId },
      data: { materializedThrough: new Date(horizonEnd), ...(done ? { status: 'completed' } : {}) },
    })
  );

  return { created, skipped };
}

export async function createBookingSeries(
  tenantId: string,
  input: CreateBookingSeriesInput,
  createdByUserId?: string
): Promise<CreatedSeries> {
  const rule = parseRRule(input.rrule);
  if (!rule) throw new InvalidRecurrenceError(input.rrule);

  const series = await withTenant({ tenantId }, async (tx) => {
    const service = await tx.schedulingService.findFirst({
      where: { id: input.serviceId, deletedAt: null },
      select: { id: true },
    });
    if (!service) throw new ServiceNotFoundError(input.serviceId);
    return tx.bookingSeries.create({
      data: {
        tenantId,
        serviceId: input.serviceId,
        rrule: normalizeRule(input.rrule),
        customerId: input.customerId ?? null,
        resourceIds: input.resourceIds,
        status: 'active',
      },
    });
  });

  const result = await materializeSeries(tenantId, series.id, {
    dtstartMs: new Date(input.startAt).getTime(),
    createdByUserId,
  });
  return { series, ...result };
}

export interface BookingSeriesSummary {
  series: BookingSeries;
  serviceName: string | null;
  totalBookings: number;
  upcomingBookings: number;
}

export async function listBookingSeries(tenantId: string): Promise<BookingSeriesSummary[]> {
  return withTenant({ tenantId }, async (tx) => {
    const rows = await tx.bookingSeries.findMany({ orderBy: { createdAt: 'desc' } });
    const now = new Date();
    return Promise.all(
      rows.map(async (series) => {
        const [service, totalBookings, upcomingBookings] = await Promise.all([
          tx.schedulingService.findUnique({
            where: { id: series.serviceId },
            select: { name: true },
          }),
          tx.booking.count({ where: { seriesId: series.id, deletedAt: null } }),
          tx.booking.count({
            where: {
              seriesId: series.id,
              deletedAt: null,
              startAt: { gt: now },
              status: { notIn: ['cancelled', 'no_show'] },
            },
          }),
        ]);
        return { series, serviceName: service?.name ?? null, totalBookings, upcomingBookings };
      })
    );
  });
}

export interface BookingSeriesDetail extends BookingSeriesSummary {
  bookings: Booking[];
}

export async function getBookingSeries(tenantId: string, id: string): Promise<BookingSeriesDetail> {
  return withTenant({ tenantId }, async (tx) => {
    const series = await tx.bookingSeries.findUnique({ where: { id } });
    if (!series) throw new BookingSeriesNotFoundError(id);
    const [service, bookings] = await Promise.all([
      tx.schedulingService.findUnique({ where: { id: series.serviceId }, select: { name: true } }),
      tx.booking.findMany({
        where: { seriesId: id, deletedAt: null },
        orderBy: { startAt: 'asc' },
      }),
    ]);
    const now = Date.now();
    const upcoming = bookings.filter(
      (b) => b.startAt.getTime() > now && !['cancelled', 'no_show'].includes(b.status)
    ).length;
    return {
      series,
      serviceName: service?.name ?? null,
      totalBookings: bookings.length,
      upcomingBookings: upcoming,
      bookings,
    };
  });
}

export interface CancelledSeries {
  id: string;
  cancelled: number;
}

/** Cancel a series and its still-cancellable child bookings. `future` (default)
 *  cancels only not-yet-started occurrences; `all` also cancels upcoming/in-progress
 *  ones. The series is marked cancelled either way so the tick stops materializing. */
export async function cancelBookingSeries(
  tenantId: string,
  input: CancelBookingSeriesInput
): Promise<CancelledSeries> {
  const targetIds = await withTenant({ tenantId }, async (tx: TxClient) => {
    const series = await tx.bookingSeries.findUnique({ where: { id: input.id } });
    if (!series) throw new BookingSeriesNotFoundError(input.id);
    const rows = await tx.booking.findMany({
      where: {
        seriesId: input.id,
        deletedAt: null,
        status: { notIn: ['cancelled', 'completed', 'no_show'] },
        ...(input.scope === 'future' ? { startAt: { gt: new Date() } } : {}),
      },
      select: { id: true },
    });
    await tx.bookingSeries.update({ where: { id: input.id }, data: { status: 'cancelled' } });
    return rows.map((r) => r.id);
  });

  // Reuse cancelBooking per child (its own tx) so each releases its allocation +
  // gets a cancellation notice through the normal lifecycle.
  let cancelled = 0;
  for (const id of targetIds) {
    await cancelBooking(tenantId, {
      id,
      reason: input.reason ?? null,
      waiveFee: false,
      notifyCustomer: true,
    });
    cancelled += 1;
  }
  return { id: input.id, cancelled };
}
