'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE SCHEDULING REPORTS DATA LAYER
//
// One read powers the whole surface: GET /v1/scheduling/reports?from=&to=. It
// returns booking volume broken down by outcome, the no-show rate, revenue from
// completed bookings, the load still on the books, how full the diary ran
// (utilisation), when the diary is busiest (by weekday + by hour), and the
// most-booked services over a date range (packages/scheduling/src/reports.ts).
//
// ── The window is a client concern, the maths is a server one ─────────────
//
// `from`/`to` are the only inputs. Every total, rate and ranking is summed on
// the server across ALL of a tenant's bookings in the window — never a page the
// browser happened to load. `upcomingCount` deliberately ignores the window: it
// is "what is on the books from now on", which is a question about the future,
// not the reporting period.
//
// ── The report follows the active site ────────────────────────────────────
//
// It is SITE-SCOPED on the server ("site IS the business"): the api client
// attaches `x-sparx-property-id` to every request, so the report is always the
// active site's, and switching site reloads the app (resetting this cache). No
// property is threaded through here — the header does it.
//
// ── Utilisation can be genuinely unknowable ───────────────────────────────
//
// `utilisation` is booked minutes ÷ available minutes. When a business has set
// no opening hours there is no capacity to divide by, so the server returns
// `null` rather than a fabricated figure — the surface then asks the owner to
// set their hours instead of showing a number that isn't real.
// ══════════════════════════════════════════════════════════════════════════

import { useQuery } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';

/* ── Shapes (mirror packages/scheduling/src/reports.ts) ─────────────────── */

/** Booking counts in the window, split by the status a booking ended up in. */
export interface SchedulingReportTotals {
  all: number;
  requested: number;
  confirmed: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

/** One row of the "what people book you for most" ranking. */
export interface TopService {
  serviceId: string;
  name: string;
  count: number;
}

/** How full the diary ran over the window. `null` on the report when a business
 *  has no opening hours set (no capacity to divide by). */
export interface Utilisation {
  /** Booked minutes ÷ available minutes as an integer 0–100, capped at 100. */
  pct: number;
  /** Minutes of booked appointments that consumed the diary in the window. */
  bookedMinutes: number;
  /** Open opening-hours minutes over the window, minus one-off closures. */
  availableMinutes: number;
}

/** One weekday bucket of the "busiest days" histogram. `weekday` is Monday-first
 *  (0 = Monday … 6 = Sunday); the array always carries all 7, zeros included. */
export interface WeekdayBucket {
  weekday: number;
  count: number;
}

/** One hour-of-day bucket of the "busiest hours" histogram. `hour` is 0–23 in
 *  the booking's local time; the array always carries all 24, zeros included. */
export interface HourBucket {
  hour: number;
  count: number;
}

export interface SchedulingReport {
  from: string;
  to: string;
  totals: SchedulingReportTotals;
  /** no_show / (completed + no_show), 0–100. Zero when nothing has finished. */
  noShowRatePct: number;
  /** Sum of the service price of completed bookings in the window, in cents.
   *  NB the endpoint returns no currency — see `formatMoney` below. */
  revenueCents: number;
  /** Future, non-terminal bookings — the load on the books right now, which does
   *  NOT depend on the reporting window. */
  upcomingCount: number;
  /** How full the diary ran, or `null` when no opening hours are configured. */
  utilisation: Utilisation | null;
  /** Bookings by weekday (Monday-first) — always 7 buckets. */
  byWeekday: WeekdayBucket[];
  /** Bookings by hour of day (0–23) — always 24 buckets. */
  byHour: HourBucket[];
  topServices: TopService[];
}

/* ── The reporting window ───────────────────────────────────────────────── */

export interface ReportRange {
  from: string;
  to: string;
  /** The preset that produced this window, carried so callers can label it. */
  days: number;
}

export interface RangePreset {
  days: number;
  label: string;
}

/** The windows on offer. Kept short and rolling — "the last N days" is how an
 *  owner thinks about how trade is going, not calendar months. */
export const RANGE_PRESETS: readonly RangePreset[] = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 3 months' },
  { days: 365, label: 'Last 12 months' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A rolling window ending now.
 *
 * Reads the clock, so a caller MUST memoise it on `days` alone — recomputing it
 * every render would mint a fresh `to` each time and refetch forever.
 */
export function rangeForDays(days: number): ReportRange {
  const to = new Date();
  const from = new Date(to.getTime() - days * DAY_MS);
  return { from: from.toISOString(), to: to.toISOString(), days };
}

/* ── Query keys ─────────────────────────────────────────────────────────── */

export const reportKeys = {
  all: ['scheduling', 'reports'] as const,
  range: (range: ReportRange) => [...reportKeys.all, { from: range.from, to: range.to }] as const,
};

/* ── The read ───────────────────────────────────────────────────────────── */

export function useSchedulingReport(range: ReportRange) {
  return useQuery({
    queryKey: reportKeys.range(range),
    queryFn: () =>
      api.get<SchedulingReport>('/v1/scheduling/reports', { from: range.from, to: range.to }),
    // Keeps the previous window on screen while a new one loads, so switching
    // period doesn't blink the whole surface out to a spinner and back.
    placeholderData: (previous) => previous,
    // A 4xx here (module off, bad range) is an answer, not a blip — retrying it
    // three times just delays saying so. A 5xx is worth a couple of goes.
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status >= 400 && error.status < 500
        ? false
        : failureCount < 2,
  });
}

/** True when the scheduling module is switched off for this account — a
 *  different thing from "the server broke", and it wants different words. */
export function isModuleDisabled(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'MODULE_DISABLED';
}

/* ── Saying what the numbers mean ───────────────────────────────────────── */

const NUMBER = new Intl.NumberFormat();

export function formatCount(value: number): string {
  return NUMBER.format(value);
}

/**
 * Completed-booking revenue as money.
 *
 * The endpoint returns cents WITHOUT a currency (it sums across services that
 * may each carry their own), so this formats in the account's assumed currency.
 * A genuinely multi-currency tenant would see mixed amounts added together —
 * a limitation of the endpoint, noted rather than hidden.
 */
export function formatMoney(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}

export function plural(count: number, one: string, many: string): string {
  return `${NUMBER.format(count)} ${count === 1 ? one : many}`;
}

/** Short weekday labels, Monday-first — indexed by `WeekdayBucket.weekday`. */
export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/**
 * An hour bucket (0–23) as a plain-English clock label.
 *
 * Non-technical owners don't read a 24-hour axis, so a bar at 15 reads "3pm",
 * not "15:00". Only whole hours occur here, so no minutes.
 */
export function formatHour(hour: number): string {
  const period = hour < 12 ? 'am' : 'pm';
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}${period}`;
}

/**
 * A minutes figure as hours for a caption — "12.5 hrs", "45 mins".
 *
 * Utilisation is worked in minutes on the server; an owner thinks in hours, so
 * the raw booked/available figures read as hours unless they're under one.
 */
export function formatHours(minutes: number): string {
  if (minutes < 60) return plural(minutes, 'min', 'mins');
  const hours = minutes / 60;
  const rounded = Math.round(hours * 10) / 10;
  return `${NUMBER.format(rounded)} ${rounded === 1 ? 'hr' : 'hrs'}`;
}

export type NoShowTone = 'success' | 'warning' | 'danger';

/**
 * How the no-show rate should read.
 *
 * A few missed appointments are unavoidable; a growing share is a business
 * problem (lost time that can't be resold), so the thresholds escalate the
 * colour rather than treating every rate the same.
 */
export function noShowTone(pct: number): NoShowTone {
  if (pct >= 15) return 'danger';
  if (pct >= 5) return 'warning';
  return 'success';
}
